export type NutritionEntry = {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type DailyTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Summiert die Naehrwerte eines Tages ueber alle Tagebucheintraege (#87).
 *
 * Reine Funktion: fehlende Werte (nicht erfasste Naehrwerte an einem
 * Eintrag) zaehlen als 0, statt die Summe auf `NaN` zu ziehen.
 */
export function calculateDailyTotals(entries: NutritionEntry[]): DailyTotals {
  return entries.reduce<DailyTotals>(
    (totals, entry) => ({
      kcal: totals.kcal + (entry.kcal ?? 0),
      proteinG: totals.proteinG + (entry.proteinG ?? 0),
      carbsG: totals.carbsG + (entry.carbsG ?? 0),
      fatG: totals.fatG + (entry.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
