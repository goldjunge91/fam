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

/** Ordnet einen Zeitpunkt dem persönlichen logischen Tracking-Tag zu. */
export function getLogicalDateForTimestamp(date: Date, dayStartTime = '00:00'): string {
  const { hours: startHour, minutes: startMinute } = parseDayStartTime(dayStartTime);
  const isBeforeStart =
    date.getHours() < startHour ||
    (date.getHours() === startHour && date.getMinutes() < startMinute);
  const logicalDate = new Date(date);
  if (isBeforeStart) logicalDate.setDate(logicalDate.getDate() - 1);

  const year = logicalDate.getFullYear();
  const month = String(logicalDate.getMonth() + 1).padStart(2, '0');
  const day = String(logicalDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Gibt das halb-offene Zeitfenster eines logischen Tracking-Tages zurück. */
export function getTimeRangeForLogicalDate(
  logicalDateIso: string,
  dayStartTime = '00:00',
): { start: Date; nextStart: Date } {
  const { hours: startHour, minutes: startMinute } = parseDayStartTime(dayStartTime);
  const [year, month, day] = logicalDateIso.split('-').map(Number);
  const start = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  const nextStart = new Date(start);
  nextStart.setDate(nextStart.getDate() + 1);
  return { start, nextStart };
}
