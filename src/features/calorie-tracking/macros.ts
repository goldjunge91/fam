export type MacroPreset = 'balanced' | 'high_protein' | 'low_carb' | 'keto';

export type MacroRatio = { protein: number; carbs: number; fat: number };

/** Anteil an den Zielkalorien je Makronaehrstoff (#83). */
const PRESET_RATIOS: Record<MacroPreset, MacroRatio> = {
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  high_protein: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  low_carb: { protein: 0.4, carbs: 0.2, fat: 0.4 },
  keto: { protein: 0.25, carbs: 0.05, fat: 0.7 },
};

/** kcal pro Gramm, physiologische Brennwerte. */
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export type MacroTargets = {
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Leitet aus einer Ziel-Kalorienzahl (siehe `calculateTargetCalories` in
 * `tdee.ts`) eine Makro-Verteilung in Gramm ab (#83) — entweder ueber eines
 * der festen Presets oder eine benutzerdefinierte Verteilung
 * ({protein,carbs,fat}, Anteile 0-1).
 *
 * Rundet je Makro einzeln — die drei Werte summieren sich deshalb kcal-maessig
 * nicht immer exakt auf `targetKcal`, weichen aber nie um mehr als eine
 * Rundungseinheit pro Makro ab.
 */
export function calculateMacroTargets(
  targetKcal: number,
  preset: MacroPreset | MacroRatio,
): MacroTargets {
  const ratios = typeof preset === 'string' ? PRESET_RATIOS[preset] : preset;
  return {
    proteinG: Math.round((targetKcal * ratios.protein) / KCAL_PER_GRAM.protein),
    carbsG: Math.round((targetKcal * ratios.carbs) / KCAL_PER_GRAM.carbs),
    fatG: Math.round((targetKcal * ratios.fat) / KCAL_PER_GRAM.fat),
  };
}
