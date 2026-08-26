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

export function rankFrequentFoods(entriesNewestFirst: FoodHistoryEntry[]): FoodHistoryEntry[] {
  return rankByName(entriesNewestFirst);
}
