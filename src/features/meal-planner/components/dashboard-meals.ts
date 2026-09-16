import type { MealSlot } from '../week';

type TimedMealEntry = {
  entry_date: string;
  meal_slot: MealSlot;
};

const FIRST_SLOT_BY_HOUR: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0,
  7: 0,
  8: 0,
  9: 0,
  10: 0,
  11: 0,
  12: 1,
  13: 1,
  14: 1,
  15: 1,
  16: 1,
  17: 2,
  18: 2,
  19: 2,
  20: 2,
  21: 2,
  22: 2,
  23: 2,
};

const SLOT_ORDER: Record<MealSlot, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
};

function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Liefert die naechsten drei Mahlzeiten abhaengig von der lokalen Uhrzeit. */
export function getUpcomingMealEntries<T extends TimedMealEntry>(
  entries: readonly T[],
  now: Date,
  limit = 3,
): T[] {
  if (limit <= 0) return [];

  const today = toLocalIsoDate(now);
  const firstTodaySlot = FIRST_SLOT_BY_HOUR[now.getHours()];

  return [...entries]
    .filter(
      (entry) =>
        entry.entry_date > today ||
        (entry.entry_date === today && SLOT_ORDER[entry.meal_slot] >= firstTodaySlot),
    )
    .sort(
      (a, b) =>
        a.entry_date.localeCompare(b.entry_date) ||
        SLOT_ORDER[a.meal_slot] - SLOT_ORDER[b.meal_slot],
    )
    .slice(0, limit);
}
