import type { MealSlot } from '../week';

type TimedMealEntry = {
  entry_date: string;
  meal_slot: MealSlot;
};

const MEAL_PLAN_EMPTY_MESSAGE_KEYS = [
  'dashboard.cards.mealPlan.emptyMessages.first',
  'dashboard.cards.mealPlan.emptyMessages.second',
  'dashboard.cards.mealPlan.emptyMessages.third',
  'dashboard.cards.mealPlan.emptyMessages.fourth',
  'dashboard.cards.mealPlan.emptyMessages.fifth',
  'dashboard.cards.mealPlan.emptyMessages.sixth',
  'dashboard.cards.mealPlan.emptyMessages.seventh',
] as const;

const MILLISECONDS_PER_DAY = 86_400_000;

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

export type MealPlanEmptyVariant = 'weeklyStrip' | 'kitchenNote';

function getLocalDayOfYear(date: Date): number {
  return Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 1)) /
      MILLISECONDS_PER_DAY,
  );
}

function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Liefert einen stabilen, taeglich wechselnden Empty-State-Uebersetzungsschluessel. */
export function getDailyMealPlanEmptyMessageKey(
  date: Date,
): (typeof MEAL_PLAN_EMPTY_MESSAGE_KEYS)[number] {
  const dayOfYear = getLocalDayOfYear(date);
  return MEAL_PLAN_EMPTY_MESSAGE_KEYS[dayOfYear % MEAL_PLAN_EMPTY_MESSAGE_KEYS.length];
}

/** Liefert die stabile Empty-State-Ansicht für den lokalen Kalendertag. */
export function getDailyMealPlanEmptyArtworkVariant(date: Date): MealPlanEmptyVariant {
  return getLocalDayOfYear(date) % 2 === 0 ? 'kitchenNote' : 'weeklyStrip';
}

/** Liefert die ausgewählte Darstellung für eine leere Dashboard-Karte. */
export function getMealPlanEmptyVariant(size: 'small' | 'large'): MealPlanEmptyVariant {
  return size === 'small' ? 'weeklyStrip' : 'kitchenNote';
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
