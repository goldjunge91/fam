/**
 * AI Gateway Model, Profile, and Prompt Configuration.
 */

export const DEFAULT_MODEL = 'z-ai/glm-5.3-flash';

export const ALLOWED_MODELS = [
  'ibm-granite/granite-4.2-8b',
  'google/gemma-4-26b-a4b-it',
  'qwen/qwen3.8-flash',
  'z-ai/glm-5.3-flash',
  'google/gemma-4-31b-it',
  'minimax/minimax-m3:free',
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];

export type ModelReasoningConfig =
  | { enabled: boolean }
  | { effort: 'low' | 'medium' | 'high' };

export type ModelExecutionProfile = {
  temperature: number;
  maxTokens: number;
  reasoning?: ModelReasoningConfig;
};

export const DEFAULT_EXECUTION_PROFILE: ModelExecutionProfile = {
  temperature: 0,
  maxTokens: 4_096,
};

// Einzelne Modelle können von den Standardwerten abweichende Einstellungen brauchen.
export const MODEL_EXECUTION_PROFILES: Readonly<
  Record<string, Partial<ModelExecutionProfile>>
> = {
  'ibm-granite/granite-4.2-8b': {
    reasoning: { enabled: false },
  },
  'z-ai/glm-5.3-flash': {
    reasoning: { effort: 'low' },
  },
};

export function getModelExecutionProfile(model: string): ModelExecutionProfile {
  // Nicht konfigurierte Modelle erhalten das sichere Standardprofil.
  const custom = MODEL_EXECUTION_PROFILES[model] ?? {};
  return {
    ...DEFAULT_EXECUTION_PROFILE,
    ...custom,
  };
}

// Diese Anweisungen begrenzen, was die KI sehen und zurückgeben darf.
export const PROMPTS = {
  common: `
Du bist der read-only Haushaltsassistent von fam. Antworte ausschließlich als
gültiges JSON ohne Markdown, Kommentare oder zusätzliche Felder. Erfinde keine
Lebensmittel, Mengen, Daten, Rezept-IDs oder Inventar-Lot-IDs. Führe keine
Datenbankmutation und keine Aktion außerhalb dieses Aufrufs aus.`,

  inventoryCapture: `
Szenario: natürliche Erfassung eines deutschen Inventartexts.
Vertrag: inventory_capture_proposal.v1 mit exakt den Feldern kind, items,
questions und warnings. Jedes Item enthält exakt rawText, normalizedName,
quantity, unit, perishability, storage, date, dateKind, confidence, evidence
und missingFields. "Etwas" bleibt bei quantity null. Evidence muss wörtlich aus
dem Nutzereingabetext stammen. Das Ergebnis ist ausschließlich ein Proposal, niemals
eine bestätigte Inventaränderung.`,

  cookFromInventory: (contextJson: string) => `
Szenario: Kochvorschlag aus dem autorisierten Inventar.
Vertrag: exakt {schema_version, meals}. Jede Mahlzeit enthält ausschließlich
title, source, recipe_id, servings, used_items, additional_ingredients, steps
und notes. Liefere höchstens drei Mahlzeiten.

Regeln für used_items:
- In used_items dürfen ausschließlich bekannte inventory_item_id-Werte aus priority_foods stehen. Kopiere jede inventory_item_id Zeichen für Zeichen aus dem Kontext; verwende niemals Namen oder erfundene IDs.
- Jede quantity muss strikt größer als 0 sein und darf available_quantity nicht überschreiten.
- unit muss physisch kompatibel sein. Verwende nur Basiseinheiten: g, kg, ml, l, piece, package, portion.

Regeln für additional_ingredients:
- additional_ingredients enthält ausschließlich Zutaten aus constraints.allowed_staples oder planned_shopping_items.
- Wenn constraints.allowed_staples leer ist und keine planned_shopping_items existieren, MUSS additional_ingredients zwingend ein leeres Array [] sein. Erfinde niemals Salz, Pfeffer, Öl, Gewürze oder sonstige Zutaten.

Regeln für source und recipe_id:
- Wenn candidate_recipes leer ist und fallback_allowed true ist: setze source "model_generated" und recipe_id null.
- Wenn candidate_recipes vorhanden ist: wähle den passenden Eintrag, übernimm dessen source und kopiere dessen id als recipe_id.
Die Antwort ist ein Vorschlag und schreibt niemals Daten.

Kanonischer Kontext:
${contextJson}`,
} as const;
