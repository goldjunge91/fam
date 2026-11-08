import { File } from 'expo-file-system';
import { AI_CONSENT_VERSION, DEFAULT_AI_MODEL } from '@/features/ai-assistant/types';
import { UNKNOWN_INGREDIENT_MAPPING } from '@/features/recipes/domain/ingredient-mapping';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import type { RecipeImportDraft, RecipeImportMethod, RecipeImportSourceType } from '../types';

type RecipeImportInput = {
  householdId: string;
  sourceType: RecipeImportSourceType;
  sourceText?: string;
  sourceUrl?: string;
  media?: Array<{ uri: string; name: string; mimeType: string }>;
};

export type RecipeImportResult = {
  draft: RecipeImportDraft;
  method: RecipeImportMethod;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getErrorCode(error: unknown, data: unknown): Promise<string | null> {
  if (isRecord(data) && typeof data.error === 'string') return data.error;
  if (!isRecord(error) || !(error.context instanceof Response)) return null;
  try {
    const body: unknown = await error.context.clone().json();
    return isRecord(body) && typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

function parseRecipeImportDraft(value: unknown): RecipeImportDraft {
  if (
    !isRecord(value) ||
    value.kind !== 'recipe_import_draft.v1' ||
    typeof value.title !== 'string' ||
    !(
      value.servings === null ||
      (typeof value.servings === 'number' && Number.isInteger(value.servings))
    ) ||
    !Array.isArray(value.ingredients) ||
    !value.ingredients.every(
      (ingredient) =>
        isRecord(ingredient) &&
        typeof ingredient.text === 'string' &&
        ['high', 'medium', 'low'].includes(String(ingredient.confidence)),
    ) ||
    !Array.isArray(value.steps) ||
    !value.steps.every((step) => typeof step === 'string') ||
    !(value.notes === null || typeof value.notes === 'string') ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === 'string')
  ) {
    throw new Error('Der Rezeptentwurf konnte nicht gelesen werden.');
  }

  return {
    kind: 'recipe_import_draft.v1',
    title: value.title,
    servings: value.servings,
    ingredients: value.ingredients.map((ingredient) => ({
      text: ingredient.text,
      confidence: ingredient.confidence as 'high' | 'medium' | 'low',
      // The model's extraction confidence is never a mapping review.
      mapping: { ...UNKNOWN_INGREDIENT_MAPPING },
    })),
    steps: value.steps,
    notes: value.notes,
    warnings: value.warnings,
  };
}

async function encodeMedia(
  media: NonNullable<RecipeImportInput['media']>,
): Promise<Array<{ filename: string; mimeType: string; data: string }>> {
  let totalSize = 0;
  const attachments = [];
  for (const item of media) {
    const file = new File(item.uri);
    if (!file.exists) throw new Error('Die ausgewählte Datei ist nicht mehr verfügbar.');
    const size = file.size ?? 0;
    totalSize += size;
    if (size <= 0 || size > 5_500_000 || totalSize > 5_500_000) {
      throw new Error('Die Datei ist zu groß. Wähle eine Datei bis 5,5 MB.');
    }
    attachments.push({
      filename: item.name.slice(0, 100),
      mimeType: item.mimeType,
      data: await file.base64(),
    });
  }
  return attachments;
}

export async function importRecipeSource(input: RecipeImportInput): Promise<RecipeImportResult> {
  const attachments = input.media ? await encodeMedia(input.media) : undefined;
  const { data, error } = await getSupabase().functions.invoke('ai-gateway', {
    body: {
      skill: 'fam-recipe-import',
      householdId: input.householdId,
      consentVersion: AI_CONSENT_VERSION,
      sourceType: input.sourceType,
      ...(input.sourceText ? { sourceText: input.sourceText } : {}),
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
      ...(attachments ? { attachments } : {}),
      model: DEFAULT_AI_MODEL,
    },
  });

  if (error) {
    const detail = await getErrorCode(error, data);
    if (detail === 'ai_subscription_required') {
      throw new Error('Für die KI-Auswertung brauchst du das AI-Abo dieses Haushalts.');
    }
    if (detail === 'ai_credit_limit_exceeded') {
      throw new Error('Das monatliche AI-Credit-Limit ist erreicht.');
    }
    if (detail === 'unsafe_source_url') {
      throw new Error('Diese Webadresse kann nicht sicher gelesen werden.');
    }
    if (detail === 'source_unavailable') {
      throw new Error('Die Webseite ist nicht erreichbar. Füge den Rezepttext ein.');
    }
    if (detail === 'source_not_a_webpage') {
      throw new Error('Der Link führt nicht zu einer lesbaren Webseite.');
    }
    if (detail === 'source_too_large') {
      throw new Error('Die Webseite ist zu groß, um sie zu importieren.');
    }
    if (detail === 'source_has_no_recipe_text') {
      throw new Error('Auf der Webseite wurde kein lesbarer Rezeptinhalt gefunden.');
    }
    if (detail === 'model_unsupported_input') {
      throw new Error('Das ausgewählte Modell kann diese Quelle nicht verarbeiten.');
    }
    throw new Error(error.message || 'Der Rezeptimport ist fehlgeschlagen.');
  }

  if (!isRecord(data) || (data.source !== 'structured' && data.source !== 'ai')) {
    throw new Error('Die Importantwort hatte ein ungültiges Format.');
  }
  return {
    draft: parseRecipeImportDraft(data.result),
    method: data.source,
  };
}
