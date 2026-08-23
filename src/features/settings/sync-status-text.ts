import type { SyncStatusView } from '@/lib/sync/sync-status';

export type SyncStatusTone = 'accent' | 'warning' | 'danger';

/** Liefert ausführlichen und platzsparenden Text fuer denselben Sync-Zustand. */
export function describeSyncStatus(status: SyncStatusView): {
  text: string;
  short: string;
  tone: SyncStatusTone;
} {
  if (status.kind === 'offline') {
    return {
      text:
        status.pendingCount > 0
          ? `Offline (${status.pendingCount} Änderungen ausstehend)`
          : 'Offline (Keine Internetverbindung)',
      short: status.pendingCount > 0 ? `Offline, ${status.pendingCount} offen` : 'Offline',
      tone: 'warning',
    };
  }

  if (status.kind === 'syncing') {
    return {
      text: `Synchronisiere … (${status.pendingCount} ausstehend)`,
      short: `${status.pendingCount} ausstehend`,
      tone: 'warning',
    };
  }

  if (status.kind === 'failed') {
    return {
      text: `${status.failedCount} Änderungen konnten nicht synchronisiert werden.`,
      short: `${status.failedCount} fehlgeschlagen`,
      tone: 'danger',
    };
  }

  return {
    text: 'Alle Daten sind synchronisiert',
    short: 'Aktuell',
    tone: 'accent',
  };
}
