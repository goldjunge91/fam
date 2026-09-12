import type { TFunction } from 'i18next';
import type { SyncStatusView } from '@/lib/sync/sync-status';

export type SyncStatusTone = 'accent' | 'warning' | 'danger';

/**
 * Der Text muss in der Menuezeile und auf der Sync-Seite dasselbe aussagen —
 * deshalb kommt er aus einer Funktion und nicht zweimal aus dem JSX.
 */
export function describeSyncStatus(
  status: SyncStatusView,
  t: TFunction,
): {
  text: string;
  short: string;
  tone: SyncStatusTone;
} {
  if (status.kind === 'offline') {
    return {
      text:
        status.pendingCount > 0
          ? t('settings.sync.status.offlinePending', { count: status.pendingCount })
          : t('settings.sync.status.offlineNoPending'),
      short:
        status.pendingCount > 0
          ? t('settings.sync.status.offlinePendingShort', { count: status.pendingCount })
          : t('settings.sync.status.offlineShort'),
      tone: 'warning',
    };
  }

  if (status.kind === 'failed') {
    return {
      text: t('settings.sync.status.failed', { count: status.failedCount }),
      short: t('settings.sync.status.failedShort', { count: status.failedCount }),
      tone: 'danger',
    };
  }

  return {
    text: t('settings.sync.status.allSynced'),
    short: t('settings.sync.status.allSyncedShort'),
    tone: 'accent',
  };
}
