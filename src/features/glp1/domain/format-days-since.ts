import type { TFunction } from 'i18next';

export function formatDaysSince(iso: string, t: TFunction, now = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t('glp1.card.daysToday');
  if (diffDays === 1) return t('glp1.card.daysAgoOne');
  return t('glp1.card.daysAgoMany', { count: diffDays });
}
