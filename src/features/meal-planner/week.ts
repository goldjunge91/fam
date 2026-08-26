// Bewusst ohne 'snack': der Wochenplan bildet nur die drei Hauptmahlzeiten ab
// (anders als das Kalorien-Tagebuch, das 'snack' als eigene Kategorie kennt).
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
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

/** Heutiges lokales Kalenderdatum als `YYYY-MM-DD`. */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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

const SHORT_MONTH_LABELS = [
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

const MONTH_LABELS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
/** Standard-Name eines neu angelegten Wochenplans, z. B. "Woche 17.–23. Aug.". */
export function defaultWeekPlanName(weekStart: string): string {
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDays(weekStart, 6));
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const endMonth = SHORT_MONTH_LABELS[end.getUTCMonth()];
  return `Woche ${startDay}.–${endDay}. ${endMonth}`;
}

export function weekdayLabel(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const day = date.getUTCDay();
  const index = day === 0 ? 6 : day - 1;
  return WEEKDAY_LABELS[index];
}

/** Kompaktes Datum fuer eine Tageskarte, z. B. "17. Aug.". */
export function dateLabel(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  return `${date.getUTCDate()}. ${SHORT_MONTH_LABELS[date.getUTCMonth()]}`;
}

/** Ueberschrift fuer einen bereits berechneten sichtbaren Datumsbereich. */
export function periodLabel(dates: readonly string[]): string {
  const start = dates[0].split('-').map(Number);
  const end = dates[dates.length - 1].split('-').map(Number);
  const sameMonth = start[0] === end[0] && start[1] === end[1];

  if (dates.length === 1) return `${start[2]}. ${MONTH_LABELS[start[1] - 1]}`;
  if (sameMonth) return `${start[2]}.–${end[2]}. ${MONTH_LABELS[end[1] - 1]}`;
  return `${start[2]}. ${MONTH_LABELS[start[1] - 1]}–${end[2]}. ${MONTH_LABELS[end[1] - 1]}`;
}

// ------------------------------------------------------------- Ansichts-Modi
// (#129-Nachtrag: Wochen- und Tagesansicht statt nur Woche.)

export const VIEW_MODES = ['day', 'week'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: 'Tag',
  week: 'Woche',
};

/** Anzahl der Kalendertage, die eine Ansicht auf einmal zeigt. */
const VIEW_MODE_DAY_COUNT: Record<ViewMode, number> = {
  day: 1,
  week: 7,
};

export function rangeDates(anchor: string, mode: ViewMode): string[] {
  const start = mode === 'week' ? getWeekStart(anchor) : anchor;
  return Array.from({ length: VIEW_MODE_DAY_COUNT[mode] }, (_, i) => addDays(start, i));
}

/** Naechstes/vorheriges Fenster derselben Ansicht (verschiebt um deren Tageszahl). */
export function shiftAnchor(anchor: string, mode: ViewMode, direction: 1 | -1): string {
  return addDays(anchor, direction * VIEW_MODE_DAY_COUNT[mode]);
}

/** Ueberschrift fuer den sichtbaren Zeitraum, z. B. "17. Aug." oder "17.–19. Aug.". */
export function rangeLabel(anchor: string, mode: ViewMode): string {
  if (mode === 'week') return defaultWeekPlanName(getWeekStart(anchor));

  const dates = rangeDates(anchor, mode);
  const start = parseDateOnly(dates[0]);
  const end = parseDateOnly(dates[dates.length - 1]);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const endMonth = SHORT_MONTH_LABELS[end.getUTCMonth()];

  if (dates.length === 1) return `${startDay}. ${endMonth}`;
  return `${startDay}.–${endDay}. ${endMonth}`;
}
