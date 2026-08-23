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

/** Summiert Tageswerte und behandelt nicht erfasste Naehrwerte als 0. */
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
