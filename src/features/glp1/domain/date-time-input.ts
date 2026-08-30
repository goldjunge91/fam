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
  const date = new Date(value.trim().replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
