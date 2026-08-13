/**
 * Reine Datumsfunktionen fuer den Wochenplan-Grid (#129). Kein I/O.
 *
 * Arbeitet ausschliesslich mit `YYYY-MM-DD`-Strings (wie
 * `meal_plans.week_start_date`/`meal_plan_entries.entry_date`), nicht mit
 * `Date`-Objekten samt Zeitzone — ein Kalenderdatum hat keine Uhrzeit, und
 * ein `Date`-Roundtrip haette an Zeitzonengrenzen den falschen Tag ergeben.
 */

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snack',
};

export const WEEKDAY_LABELS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateOnlyString(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Montag der Kalenderwoche, die `dateStr` enthaelt (ISO-Wochenstart). */
export function getWeekStart(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  // getUTCDay(): 0 = Sonntag ... 6 = Samstag. Abstand zum Montag dieser Woche.
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return toDateOnlyString(date);
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDateOnly(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnlyString(date);
}

/** Die sieben Kalendertage (Montag..Sonntag) einer mit `weekStart` beginnenden Woche. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function previousWeekStart(weekStart: string): string {
  return addDays(weekStart, -7);
}

export function nextWeekStart(weekStart: string): string {
  return addDays(weekStart, 7);
}

/** Standard-Name eines neu angelegten Wochenplans, z. B. "Woche 17.–23. Aug.". */
export function defaultWeekPlanName(weekStart: string): string {
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDays(weekStart, 6));
  const months = [
    'Jan.',
    'Feb.',
    'März',
    'Apr.',
    'Mai',
    'Juni',
    'Juli',
    'Aug.',
    'Sep.',
    'Okt.',
    'Nov.',
    'Dez.',
  ];
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const endMonth = months[end.getUTCMonth()];
  return `Woche ${startDay}.–${endDay}. ${endMonth}`;
}

export function weekdayLabel(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const day = date.getUTCDay();
  const index = day === 0 ? 6 : day - 1;
  return WEEKDAY_LABELS[index];
}
