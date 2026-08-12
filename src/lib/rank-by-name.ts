/**
 * Ein Eintrag je Name, absteigend nach Haeufigkeit des Namens sortiert. Bei
 * gleicher Haeufigkeit bleibt die juengste Fundstelle vorn (stabile
 * Sortierung + `itemsNewestFirst`). Gemeinsame Implementierung fuer
 * `rankFrequentFoods` (`calorie-tracking/food-history.ts`) und
 * `frequent-products-quick-select.tsx` — beide zaehlten bisher dieselbe
 * Count-und-Repraesentant-Logik doppelt.
 */
export function rankByName<T extends { name: string }>(
  itemsNewestFirst: readonly T[],
  options?: { caseInsensitive?: boolean },
): T[] {
  const key = options?.caseInsensitive
    ? (name: string) => name.toLowerCase()
    : (name: string) => name;

  const counts = new Map<string, number>();
  const representative = new Map<string, T>();

  for (const item of itemsNewestFirst) {
    const k = key(item.name);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (!representative.has(k)) representative.set(k, item);
  }

  return Array.from(representative.entries())
    .sort(([a], [b]) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .map(([, item]) => item);
}
