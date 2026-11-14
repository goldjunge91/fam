export const SYNC_ABORT_MESSAGE = 'Sync-Vorgang wurde angehalten.';

export function createSyncAbortError(): Error {
  const error = new Error(SYNC_ABORT_MESSAGE);
  error.name = 'AbortError';
  return error;
}

export function throwIfSyncAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createSyncAbortError();
}

export function isSyncAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
