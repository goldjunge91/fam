import { rankByName } from '@/lib/rank-by-name';

export type FoodHistoryEntry = {
  name: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  quantity: number;
  unit: string;
};

/** Reduziert eine absteigend sortierte Liste auf den juengsten Eintrag je Name. */
export function dedupeRecentFoods(entriesNewestFirst: FoodHistoryEntry[]): FoodHistoryEntry[] {
  const seen = new Set<string>();
  const result: FoodHistoryEntry[] = [];

  for (const entry of entriesNewestFirst) {
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    result.push(entry);
  }

  return result;
}

/** Sortiert eindeutige Namen nach Haeufigkeit, bei Gleichstand nach Aktualitaet. */
export function rankFrequentFoods(entriesNewestFirst: FoodHistoryEntry[]): FoodHistoryEntry[] {
  return rankByName(entriesNewestFirst);
}
