/**
 * Berechnet das logische Tracking-Datum basierend auf der konfigurierten
 * Startzeit des Nutzertages (#174).
 *
 * Beispiel:
 * Startzeit "06:00":
 * - Am 18.08. um 07:00 Uhr -> Datum 18.08.
 * - Am 19.08. um 02:00 Uhr (Nachtschicht / spaetes Logging) -> gehoert noch zum Tag 18.08.
 * - Am 19.08. um 06:00 Uhr -> Datum 19.08.
 */

export function parseDayStartTime(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return { hours: 0, minutes: 0 };
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  return {
    hours: Math.min(23, Math.max(0, hours)),
    minutes: Math.min(59, Math.max(0, minutes)),
  };
}

/**
 * Wandelt ein Date-Objekt in das logische ISO-Datum (YYYY-MM-DD) gemaess
 * der individuellen Tag-Startzeit um.
 */
export function getLogicalDateForTimestamp(date: Date, dayStartTime = '00:00'): string {
  const { hours: startHour, minutes: startMinute } = parseDayStartTime(dayStartTime);

  const localHours = date.getHours();
  const localMinutes = date.getMinutes();

  // Falls der Zeitpunkt VOR der Startzeit des aktuellen Kalendertages liegt,
  // gehoert dieser Zeitpunkt noch zum vorherigen logischen Tracking-Tag.
  const isBeforeStart =
    localHours < startHour || (localHours === startHour && localMinutes < startMinute);

  const logicalDate = new Date(date);
  if (isBeforeStart) {
    logicalDate.setDate(logicalDate.getDate() - 1);
  }

  const year = logicalDate.getFullYear();
  const month = String(logicalDate.getMonth() + 1).padStart(2, '0');
  const day = String(logicalDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Gibt den Start- und Endzeitpunkt (Date) eines logischen Tracking-Tages zurueck.
 */
export function getTimeRangeForLogicalDate(
  logicalDateIso: string,
  dayStartTime = '00:00',
): { start: Date; end: Date } {
  const { hours: startHour, minutes: startMinute } = parseDayStartTime(dayStartTime);
  const [year, month, day] = logicalDateIso.split('-').map(Number);

  const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);

  return { start, end };
}
