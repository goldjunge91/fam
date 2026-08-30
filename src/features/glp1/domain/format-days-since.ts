export function formatDaysSince(iso: string, now = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'heute';
  if (diffDays === 1) return 'vor 1 Tag';
  return `vor ${diffDays} Tagen`;
}
