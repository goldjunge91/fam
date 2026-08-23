export type SyncStatusView =
  | { kind: 'hidden' }
  | { kind: 'offline'; pendingCount: number }
  | { kind: 'syncing'; pendingCount: number }
  | { kind: 'failed'; failedCount: number };

/** Prioritaet: dauerhaft fehlgeschlagen, offline, kuerzlicher lokaler Write. */
export function computeSyncStatusView(input: {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
  recentLocalWrite: boolean;
}): SyncStatusView {
  if (input.failedCount > 0) {
    return { kind: 'failed', failedCount: input.failedCount };
  }

  if (!input.isOnline) {
    return { kind: 'offline', pendingCount: input.pendingCount };
  }

  if (input.recentLocalWrite) {
    return { kind: 'syncing', pendingCount: input.pendingCount };
  }

  return { kind: 'hidden' };
}
