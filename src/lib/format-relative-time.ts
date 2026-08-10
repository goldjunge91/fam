/**
 * Formatiert einen Zeitpunkt relativ zu `nowMs` auf Deutsch, z.B. "vor 2 Min.".
 * `nowMs` ist injizierbar, damit der Test nicht von der Systemzeit abhaengt.
 */
export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const diffSec = Math.max(0, Math.round((nowMs - timestampMs) / 1000));

  if (diffSec < 60) return 'gerade eben';

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min.`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;

  const diffDays = Math.round(diffHours / 24);
  return `vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`;
}
