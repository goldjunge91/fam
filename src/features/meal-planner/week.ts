import type { TFunction } from 'i18next';

// Bewusst ohne 'snack': der Wochenplan bildet nur die drei Hauptmahlzeiten ab
// (anders als das Kalorien-Tagebuch, das 'snack' als eigene Kategorie kennt).
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'mealPlanner.mealSlots.breakfast',
  lunch: 'mealPlanner.mealSlots.lunch',
  dinner: 'mealPlanner.mealSlots.dinner',
};

export function getMealSlotLabel(t: TFunction, slot: MealSlot): string {
  return t(`mealPlanner.mealSlots.${slot}`);
}

export function getViewModeLabel(t: TFunction, mode: ViewMode): string {
  return t(`mealPlanner.viewModes.${mode}`);
}

export const WEEKDAY_LABELS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
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
export function defaultWeekPlanName(weekStart: string, locale = 'de-DE'): string {
  const start = parseDateOnly(weekStart);
  const end = parseDateOnly(addDays(weekStart, 6));
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const endMonth = shortMonthLabel(end.getUTCMonth(), locale);
  if (locale.toLowerCase().startsWith('de')) {
    return `Woche ${startDay}.–${endDay}. ${endMonth}`;
  }
  return `Week ${startDay}–${endDay} ${endMonth}`;
}

function shortMonthLabel(month: number, locale: string): string {
  if (locale.toLowerCase().startsWith('de')) return SHORT_MONTH_LABELS[month] ?? '';
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2020, month, 1)),
  );
}

function monthLabel(month: number, locale: string): string {
  if (locale.toLowerCase().startsWith('de')) return MONTH_LABELS[month] ?? '';
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2020, month, 1)),
  );
}

export function weekdayLabel(dateStr: string, locale = 'de-DE'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    parseDateOnly(dateStr),
  );
}

/** Kompaktes Datum fuer eine Tageskarte, z. B. "17. Aug.". */
export function dateLabel(dateStr: string, locale = 'de-DE'): string {
  const date = parseDateOnly(dateStr);
  if (locale.toLowerCase().startsWith('de')) {
    return `${date.getUTCDate()}. ${shortMonthLabel(date.getUTCMonth(), locale)}`;
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

/** Ueberschrift fuer einen bereits berechneten sichtbaren Datumsbereich. */
export function periodLabel(dates: readonly string[], locale = 'de-DE'): string {
  const start = dates[0].split('-').map(Number);
  const end = dates[dates.length - 1].split('-').map(Number);
  const sameMonth = start[0] === end[0] && start[1] === end[1];

  if (locale.toLowerCase().startsWith('de')) {
    if (dates.length === 1) return `${start[2]}. ${monthLabel(start[1] - 1, locale)}`;
    if (sameMonth) {
      return `${start[2]}.–${end[2]}. ${monthLabel(end[1] - 1, locale)}`;
    }
    return `${start[2]}. ${monthLabel(start[1] - 1, locale)}–${end[2]}. ${monthLabel(end[1] - 1, locale)}`;
  }

  const startMonth = shortMonthLabel(start[1] - 1, locale);
  const endMonth = shortMonthLabel(end[1] - 1, locale);
  if (dates.length === 1) return `${startMonth} ${start[2]}`;
  if (sameMonth) return `${startMonth} ${start[2]}–${end[2]}`;
  return `${startMonth} ${start[2]}–${endMonth} ${end[2]}`;
}

// ------------------------------------------------------------- Ansichts-Modi
// (#129-Nachtrag: Wochen- und Tagesansicht statt nur Woche.)

export const VIEW_MODES = ['day', 'week'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: 'mealPlanner.viewModes.day',
  week: 'mealPlanner.viewModes.week',
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
export function rangeLabel(anchor: string, mode: ViewMode, locale = 'de-DE'): string {
  if (mode === 'week') return defaultWeekPlanName(getWeekStart(anchor), locale);

  const dates = rangeDates(anchor, mode);
  return dateLabel(dates[0], locale);
}
