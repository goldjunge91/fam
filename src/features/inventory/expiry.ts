import type { ThemeColor } from '@/constants/theme';

export type ExpiryBucket = 'expired' | 'critical' | 'soon' | 'ok' | 'none';

export type ExpiryInfo = {
  bucket: ExpiryBucket;
  /** Tage bis zum MHD. Negativ = bereits abgelaufen. `null`, wenn kein MHD gesetzt ist. */
  daysLeft: number | null;
  label: string;
  themeColor: ThemeColor;
};

const MS_PER_DAY = 86_400_000;

/** Zaehlt Kalendertage unabhaengig von Uhrzeit und Zeitumstellung. */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / MS_PER_DAY);
}

/** Stuft ein MHD relativ zu einem expliziten Stichtag ein. */
export function getExpiryInfo(
  expiryDate: Date | string | null | undefined,
  today: Date,
): ExpiryInfo {
  if (expiryDate === null || expiryDate === undefined || expiryDate === '') {
    return { bucket: 'none', daysLeft: null, label: 'ohne MHD', themeColor: 'textSecondary' };
  }

  const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;

  if (Number.isNaN(date.getTime())) {
    return { bucket: 'none', daysLeft: null, label: 'ohne MHD', themeColor: 'textSecondary' };
  }

  const daysLeft = calendarDaysBetween(today, date);

  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return {
      bucket: 'expired',
      daysLeft,
      label: days === 1 ? 'seit gestern abgelaufen' : `seit ${days} Tagen abgelaufen`,
      themeColor: 'danger',
    };
  }

  if (daysLeft === 0) {
    return { bucket: 'critical', daysLeft, label: 'läuft heute ab', themeColor: 'danger' };
  }

  if (daysLeft <= 3) {
    return {
      bucket: 'critical',
      daysLeft,
      label: daysLeft === 1 ? 'noch 1 Tag' : `noch ${daysLeft} Tage`,
      themeColor: 'warning',
    };
  }

  if (daysLeft <= 7) {
    return { bucket: 'soon', daysLeft, label: `noch ${daysLeft} Tage`, themeColor: 'warning' };
  }

  return { bucket: 'ok', daysLeft, label: `noch ${daysLeft} Tage`, themeColor: 'textSecondary' };
}

/** Sortiert zuerst nach Dringlichkeit, dann nach Datum. */
const BUCKET_ORDER: Record<ExpiryBucket, number> = {
  expired: 0,
  critical: 1,
  soon: 2,
  ok: 3,
  none: 4,
};

export function compareByExpiry(a: ExpiryInfo, b: ExpiryInfo): number {
  const byBucket = BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
  if (byBucket !== 0) return byBucket;

  if (a.daysLeft === null) return b.daysLeft === null ? 0 : 1;
  if (b.daysLeft === null) return -1;
  return a.daysLeft - b.daysLeft;
}
