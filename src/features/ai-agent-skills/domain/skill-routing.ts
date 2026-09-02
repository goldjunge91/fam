export type AgentSkillId = 'fam-cook-from-inventory' | 'fam-inventory-capture';

function containsWord(text: string, words: readonly string[]): boolean {
  return words.some((word) => new RegExp(`\\b${word}\\b`, 'iu').test(text));
}

/** Routes only the two scoped German intents; all other text stays unhandled. */
export function routeSkillIntent(text: string): AgentSkillId | null {
  const normalized = text.trim();
  if (!normalized) return null;

  const cookingIntent =
    containsWord(normalized, ['kochen', 'koch', 'rezept', 'gerichte', 'gericht', 'mahlzeit']) ||
    /was kann ich .*essen/iu.test(normalized);
  if (cookingIntent) return 'fam-cook-from-inventory';

  const captureIntent =
    /\bich habe\b/iu.test(normalized) && !containsWord(normalized, ['frage', 'problem', 'hunger']);
  return captureIntent ? 'fam-inventory-capture' : null;
}
