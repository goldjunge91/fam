type SyncStopper = () => void | Promise<void>;

let stoppedForAccountTransition = false;
let activeRuns = 0;
const drainWaiters = new Set<() => void>();
const stoppers = new Set<SyncStopper>();

function resolveDrainWaiters(): void {
  if (activeRuns !== 0) return;
  for (const resolve of drainWaiters) resolve();
  drainWaiters.clear();
}

/**
 * Reserviert einen Account-Sync-Lauf. Während eines Account-Cleanups werden
 * neue Läufe abgewiesen; bereits reservierte Läufe werden vor dem DB-Wipe
 * vollständig abgewartet.
 */
export function beginAccountSyncRun(): (() => void) | null {
  if (stoppedForAccountTransition) return null;
  activeRuns += 1;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeRuns -= 1;
    resolveDrainWaiters();
  };
}

/** Registriert Timer-, Netzwerk- oder Realtime-Abos für synchrones Stoppen. */
export function registerAccountSyncStopper(stopper: SyncStopper): () => void {
  if (stoppedForAccountTransition) {
    void Promise.resolve().then(stopper);
    return () => {};
  }
  stoppers.add(stopper);
  return () => stoppers.delete(stopper);
}

export async function stopAccountSyncAndWait(): Promise<void> {
  stoppedForAccountTransition = true;
  const results = await Promise.allSettled(
    [...stoppers].map((stopper) => Promise.resolve().then(stopper)),
  );
  if (activeRuns !== 0) {
    await new Promise<void>((resolve) => drainWaiters.add(resolve));
  }

  const failedStopper = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failedStopper) {
    throw new Error('Mindestens ein Account-Sync konnte nicht sicher gestoppt werden.', {
      cause: failedStopper.reason,
    });
  }
}

/** Erst nach gesetzter neuer Ownership wieder aufrufen. */
export function resumeAccountSync(): void {
  stoppedForAccountTransition = false;
}
