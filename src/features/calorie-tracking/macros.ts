export type MacroPreset = 'balanced' | 'high_protein' | 'low_carb';

/** Anteil an den Zielkalorien je Makronaehrstoff (#83). */
const PRESET_RATIOS: Record<MacroPreset, { protein: number; carbs: number; fat: number }> = {
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  high_protein: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  low_carb: { protein: 0.3, carbs: 0.2, fat: 0.5 },
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
 * `tdee.ts`) eine Makro-Verteilung in Gramm ab, ueber feste Presets (#83).
 *
 * Rundet je Makro einzeln — die drei Werte summieren sich deshalb kcal-maessig
 * nicht immer exakt auf `targetKcal`, weichen aber nie um mehr als eine
 * Rundungseinheit pro Makro ab.
 */
export function calculateMacroTargets(targetKcal: number, preset: MacroPreset): MacroTargets {
  const ratios = PRESET_RATIOS[preset];
  return {
    proteinG: Math.round((targetKcal * ratios.protein) / KCAL_PER_GRAM.protein),
    carbsG: Math.round((targetKcal * ratios.carbs) / KCAL_PER_GRAM.carbs),
    fatG: Math.round((targetKcal * ratios.fat) / KCAL_PER_GRAM.fat),
  };
}
