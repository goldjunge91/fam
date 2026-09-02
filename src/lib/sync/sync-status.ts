export type SyncStatusView =
  | { kind: 'hidden' }
  | { kind: 'offline'; pendingCount: number }
  | { kind: 'failed'; failedCount: number };

/**
 * Local-First (siehe AGENTS.md): Sync soll unsichtbar sein, solange nichts
 * schiefgeht. Ein erfolgreicher Online-Sync zeigt daher nichts an — nur
 * Offline mit ausstehenden Änderungen oder dauerhaft gescheiterte Eintraege
 * sind fuer den Nutzer relevant genug, um zu unterbrechen.
 */
export function computeSyncStatusView(input: {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
}): SyncStatusView {
  if (input.failedCount > 0) {
    return { kind: 'failed', failedCount: input.failedCount };
  }

  if (!input.isOnline) {
    return { kind: 'offline', pendingCount: input.pendingCount };
  }

  return { kind: 'hidden' };
}
