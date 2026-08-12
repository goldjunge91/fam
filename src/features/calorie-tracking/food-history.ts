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

/**
 * Ein Eintrag je Name, jüngster zuerst (#Tagebuch-Redesign "Zuletzt").
 *
 * Erwartet `entriesNewestFirst` bereits absteigend nach `created_at`
 * sortiert (so liefert `useFoodHistory`) — die erste Fundstelle je Name ist
 * damit automatisch die juengste.
 */
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

/**
 * Ein Eintrag je Name, nach Haeufigkeit des Namens absteigend sortiert
 * (#Tagebuch-Redesign "Haeufig"). Bei gleicher Haeufigkeit bleibt die
 * juengste Fundstelle vorn (stabile Sortierung + `entriesNewestFirst`).
 */
export function rankFrequentFoods(entriesNewestFirst: FoodHistoryEntry[]): FoodHistoryEntry[] {
  return rankByName(entriesNewestFirst);
}
