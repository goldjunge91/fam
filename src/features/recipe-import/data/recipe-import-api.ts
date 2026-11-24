import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { getDevAiModelSelection } from '@/features/ai-assistant/data/dev-ai-model-selection';
import { UNKNOWN_INGREDIENT_MAPPING } from '@/features/recipes/domain/ingredient-mapping';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { getDurationBucket } from '@/lib/telemetry/buckets';
import {
  normalizeRecipeImportIngredient,
  type RecipeImportDraft,
  type RecipeImportMethod,
  type RecipeImportSourceType,
} from '../types';

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

export type RecipeImportErrorCode =
  | 'draftInvalid'
  | 'fileUnavailable'
  | 'fileTooLarge'
  | 'aiSubscriptionRequired'
  | 'creditLimitExceeded'
  | 'foodRuleSnapshotUnavailable'
  | 'foodRuleSnapshotChanged'
  | 'unsafeSourceUrl'
  | 'instagramVideoUnavailable'
  | 'instagramRecipeNotFound'
  | 'transcriptionNotConfigured'
  | 'transcriptionRateLimited'
  | 'transcriptionRejected'
  | 'transcriptionUnavailable'
  | 'providerUnavailable'
  | 'draftCreationFailed'
  | 'sourceUnavailable'
  | 'sourceNotWebpage'
  | 'sourceTooLarge'
  | 'sourceNoRecipeText'
  | 'modelUnsupportedInput'
  | 'importFailed'
  | 'invalidResponse';

export class RecipeImportError extends Error {
  readonly code: RecipeImportErrorCode;

  constructor(code: RecipeImportErrorCode) {
    super(code);
    this.name = 'RecipeImportError';
    this.code = code;
  }
}

export function isRecipeImportError(error: unknown): error is RecipeImportError {
  return error instanceof RecipeImportError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function getErrorCode(error: unknown, data: unknown): Promise<string | null> {
  if (isRecord(data) && typeof data.error === 'string') return data.error;
  if (!(error instanceof FunctionsHttpError)) return null;
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
    value.title.trim().length === 0 ||
    !(
      value.servings === null ||
      (typeof value.servings === 'number' && Number.isInteger(value.servings) && value.servings > 0)
    ) ||
    !Array.isArray(value.ingredients) ||
    value.ingredients.length === 0 ||
    !Array.isArray(value.steps) ||
    value.steps.length === 0 ||
    !value.steps.every((step) => typeof step === 'string') ||
    !(value.notes === null || typeof value.notes === 'string') ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === 'string')
  ) {
    throw new RecipeImportError('draftInvalid');
  }

  const ingredients = value.ingredients.flatMap((ingredient) => {
    const normalized = normalizeRecipeImportIngredient(ingredient);
    return normalized ? [normalized] : [];
  });
  if (ingredients.length !== value.ingredients.length) {
    throw new RecipeImportError('draftInvalid');
  }

  return {
    kind: 'recipe_import_draft.v1',
    title: value.title,
    servings: value.servings,
    ingredients: ingredients.map((ingredient) => ({
      ...ingredient,
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
    if (!file.exists) throw new RecipeImportError('fileUnavailable');
    const size = file.size ?? 0;
    totalSize += size;
    if (size <= 0 || size > 5_500_000 || totalSize > 5_500_000) {
      throw new RecipeImportError('fileTooLarge');
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
  const startedAt = Date.now();
  trackAnalyticsEvent('recipe_import.started', { source: input.sourceType });
  let stage: 'media' | 'request' | 'parse' = 'media';

  try {
    const attachments = input.media ? await encodeMedia(input.media) : undefined;
    stage = 'request';
    const modelSelection = getDevAiModelSelection();
    const { data, error } = await getSupabase().functions.invoke('ai-gateway', {
      body: {
        skill: 'fam-recipe-import',
        householdId: input.householdId,
        sourceType: input.sourceType,
        ...(input.sourceText ? { sourceText: input.sourceText } : {}),
        ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
        ...(attachments ? { attachments } : {}),
        ...(modelSelection ?? {}),
      },
    });

    if (error) {
      const detail = await getErrorCode(error, data);
      if (detail === 'ai_subscription_required') {
        throw new RecipeImportError('aiSubscriptionRequired');
      }
      if (detail === 'ai_credit_limit_exceeded') {
        throw new RecipeImportError('creditLimitExceeded');
      }
      if (
        detail === 'food_rule_snapshot_incomplete' ||
        detail === 'food_rule_snapshot_unavailable'
      ) {
        throw new RecipeImportError('foodRuleSnapshotUnavailable');
      }
      if (detail === 'food_rule_snapshot_changed') {
        throw new RecipeImportError('foodRuleSnapshotChanged');
      }
      if (detail === 'unsafe_source_url') {
        throw new RecipeImportError('unsafeSourceUrl');
      }
      if (detail === 'instagram_video_unavailable') {
        throw new RecipeImportError('instagramVideoUnavailable');
      }
      if (detail === 'instagram_recipe_not_found') {
        throw new RecipeImportError('instagramRecipeNotFound');
      }
      if (detail === 'groq_transcription_not_configured') {
        throw new RecipeImportError('transcriptionNotConfigured');
      }
      if (detail === 'groq_transcription_rate_limited') {
        throw new RecipeImportError('transcriptionRateLimited');
      }
      if (detail === 'groq_transcription_rejected') {
        throw new RecipeImportError('transcriptionRejected');
      }
      if (
        detail === 'groq_transcription_unavailable' ||
        detail === 'groq_transcription_invalid_response'
      ) {
        throw new RecipeImportError('transcriptionUnavailable');
      }
      if (detail?.startsWith('provider_')) {
        throw new RecipeImportError('providerUnavailable');
      }
      if (detail === 'invalid_recipe_import_draft') {
        throw new RecipeImportError('draftCreationFailed');
      }
      if (detail === 'source_unavailable') {
        throw new RecipeImportError('sourceUnavailable');
      }
      if (detail === 'source_not_a_webpage') {
        throw new RecipeImportError('sourceNotWebpage');
      }
      if (detail === 'source_too_large') {
        throw new RecipeImportError('sourceTooLarge');
      }
      if (detail === 'source_has_no_recipe_text') {
        throw new RecipeImportError('sourceNoRecipeText');
      }
      if (detail === 'model_unsupported_input') {
        throw new RecipeImportError('modelUnsupportedInput');
      }
      if (error instanceof FunctionsHttpError) {
        throw new RecipeImportError('importFailed');
      }
      if (error.message) throw new Error(error.message);
      throw new RecipeImportError('importFailed');
    }

    stage = 'parse';
    if (!isRecord(data) || (data.source !== 'structured' && data.source !== 'ai')) {
      throw new RecipeImportError('invalidResponse');
    }

    const result = {
      draft: parseRecipeImportDraft(data.result),
      method: data.source,
    } satisfies RecipeImportResult;
    trackAnalyticsEvent('recipe_import.completed', {
      method: result.method,
      duration_bucket: getDurationBucket(Date.now() - startedAt),
    });
    return result;
  } catch (error) {
    trackAnalyticsEvent('recipe_import.failed', { stage });
    throw error;
  }
}
