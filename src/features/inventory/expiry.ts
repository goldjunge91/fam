import type { TFunction } from 'i18next';

export type ExpiryBucket = 'expired' | 'critical' | 'soon' | 'ok' | 'none';
export type ExpiryThemeColor = 'textSecondary' | 'warning' | 'danger';

/** Verbindliche Fenster der beiden Vorrats-Statuskarten. */
export const EXPIRY_WINDOW_DAYS = Object.freeze({
  runsOutSoon: 3,
  dueSoon: 10,
} as const);

export type ExpiryInfo = {
  bucket: ExpiryBucket;
  /** Tage bis zum MHD. Negativ = bereits abgelaufen. `null`, wenn kein MHD gesetzt ist. */
  daysLeft: number | null;
  label: string;
  themeColor: ExpiryThemeColor;
};

const MS_PER_DAY = 86_400_000;

function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / MS_PER_DAY);
}

function fallbackExpiryLabel(daysLeft: number | null): string {
  if (daysLeft === null) return 'ohne MHD';
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return days === 1 ? 'seit gestern abgelaufen' : `seit ${days} Tagen abgelaufen`;
  }
  if (daysLeft === 0) return 'läuft heute ab';
  return daysLeft === 1 ? 'noch 1 Tag' : `noch ${daysLeft} Tage`;
}

function localizedExpiryLabel(daysLeft: number | null, t?: TFunction): string {
  if (!t) return fallbackExpiryLabel(daysLeft);
  if (daysLeft === null) return t('inventory.expiry.withoutDate');
  if (daysLeft < 0) {
    const days = Math.abs(daysLeft);
    return days === 1
      ? t('inventory.expiry.expiredYesterday')
      : t('inventory.expiry.expiredDays', { count: days });
  }
  if (daysLeft === 0) return t('inventory.expiry.today');
  return t('inventory.expiry.daysRemaining', { count: daysLeft });
}

export function getExpiryInfo(
  expiryDate: Date | string | null | undefined,
  today: Date,
  t?: TFunction,
): ExpiryInfo {
  if (expiryDate === null || expiryDate === undefined || expiryDate === '') {
    return {
      bucket: 'none',
      daysLeft: null,
      label: localizedExpiryLabel(null, t),
      themeColor: 'textSecondary',
    };
  }

  const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;

  if (Number.isNaN(date.getTime())) {
    return {
      bucket: 'none',
      daysLeft: null,
      label: localizedExpiryLabel(null, t),
      themeColor: 'textSecondary',
    };
  }

  const daysLeft = calendarDaysBetween(today, date);
  const label = localizedExpiryLabel(daysLeft, t);

  if (daysLeft < 0) {
    return { bucket: 'expired', daysLeft, label, themeColor: 'danger' };
  }

  if (daysLeft === 0) {
    return { bucket: 'critical', daysLeft, label, themeColor: 'danger' };
  }

  if (daysLeft <= EXPIRY_WINDOW_DAYS.runsOutSoon) {
    return { bucket: 'critical', daysLeft, label, themeColor: 'warning' };
  }

  if (daysLeft <= EXPIRY_WINDOW_DAYS.dueSoon) {
    return { bucket: 'soon', daysLeft, label, themeColor: 'warning' };
  }

  return { bucket: 'ok', daysLeft, label, themeColor: 'textSecondary' };
}

/** Sortierreihenfolge: was zuerst verbraucht werden muss, steht oben. */
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

  // Innerhalb einer Stufe: das fruehere Datum zuerst. Artikel ohne MHD ans Ende.
  if (a.daysLeft === null) return b.daysLeft === null ? 0 : 1;
  if (b.daysLeft === null) return -1;
  return a.daysLeft - b.daysLeft;
}

export function formatExpiryDate(
  value: string | null | undefined,
  locale = 'de-DE',
  t?: TFunction,
): string {
  if (!value) return t?.('inventory.expiry.withoutDate') ?? 'ohne MHD';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function localizedExpiryStatus(expiry: ExpiryInfo, t: TFunction): string {
  if (expiry.daysLeft === null) return t('inventory.expiry.withoutDate');
  if (expiry.daysLeft < 0) {
    const days = Math.abs(expiry.daysLeft);
    return days === 1
      ? t('inventory.expiry.expiredYesterday')
      : t('inventory.expiry.expiredDays', { count: days });
  }
  if (expiry.daysLeft === 0) return t('inventory.expiry.today');
  return t('inventory.expiry.daysRemaining', { count: expiry.daysLeft });
}

export function formatExpiryInfoStatus(expiry: ExpiryInfo, t?: TFunction): string {
  if (t) return localizedExpiryStatus(expiry, t);
  if (expiry.daysLeft === null) return 'ohne MHD';
  if (expiry.daysLeft < 0) return expiry.label;
  return expiry.daysLeft === 0 ? 'heute' : expiry.label;
}

function localizedExpiryRowStatus(expiry: ExpiryInfo, t: TFunction): string {
  if (expiry.daysLeft === null) return t('inventory.expiry.withoutDate');
  if (expiry.daysLeft < 0) {
    const days = Math.abs(expiry.daysLeft);
    return days === 1
      ? t('inventory.expiry.expiredYesterday')
      : t('inventory.expiry.expiredDays', { count: days });
  }
  if (expiry.daysLeft === 0) return t('inventory.expiry.rowToday');
  if (expiry.daysLeft === 1) return t('inventory.expiry.rowTomorrow');
  return t('inventory.expiry.rowInDays', { count: expiry.daysLeft });
}

/** Formats the compact relative status used by inventory rows. */
export function formatExpiryRowStatus(expiry: ExpiryInfo, t?: TFunction): string {
  if (t) return localizedExpiryRowStatus(expiry, t);
  if (expiry.daysLeft === null) return 'ohne MHD';
  if (expiry.daysLeft < 0) return expiry.label;
  if (expiry.daysLeft === 0) return 'heute';
  if (expiry.daysLeft === 1) return 'morgen';
  return `in ${expiry.daysLeft} Tagen`;
}

export function formatExpiryStatus(
  itemOrDate: { expiry_date?: string | null } | string | null | undefined,
  today: Date = new Date(),
  t?: TFunction,
): string {
  const date =
    typeof itemOrDate === 'object' && itemOrDate !== null ? itemOrDate.expiry_date : itemOrDate;
  const expiry = getExpiryInfo(date, today, t);
  return formatExpiryInfoStatus(expiry, t);
}
