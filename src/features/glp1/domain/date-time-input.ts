export function formatDateTimeInput(isoTimestamp = new Date().toISOString()): string {
  const date = new Date(isoTimestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function parseDateTimeInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hours, minutes] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
  );
  const isExact =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hours) &&
    date.getMinutes() === Number(minutes);

  return isExact ? date.toISOString() : null;
}
