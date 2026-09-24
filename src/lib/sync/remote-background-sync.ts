import { reportError } from '@/lib/telemetry';

export const BACKGROUND_SYNC_TASK_NAME = 'fam-background-sync';

const REBUILD_HINT =
  'expo-background-task/expo-task-manager sind im installierten Build nicht ' +
  'enthalten. Native Module kommen nicht ueber einen Metro-Reload dazu — der ' +
  'Development Build muss neu erstellt werden (scripts/ios-dev.sh oder ' +
  '`bunx expo run:ios`).';

function loadBackgroundTask(): typeof import('expo-background-task') {
  try {
    return require('expo-background-task') as typeof import('expo-background-task');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

function loadTaskManager(): typeof import('expo-task-manager') {
  try {
    return require('expo-task-manager') as typeof import('expo-task-manager');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

let handler: (() => Promise<void>) | null = null;

/** Setzt/ersetzt den Handler, den die Task bei Ausfuehrung aufruft. `null` = Task tut nichts, gilt als Erfolg. */
export function setBackgroundSyncHandler(fn: (() => Promise<void>) | null): void {
  handler = fn;
}

let defined = false;

/**
 * Definiert die Task. Muss frueh und im globalen Modul-Scope aufgerufen
 * werden (siehe Kommentar oben) — idempotent, ein zweiter Aufruf ist ein No-op.
 */
export function defineBackgroundSyncTask(): void {
  if (defined) return;
  defined = true;

  const TaskManager = loadTaskManager();
  const { BackgroundTaskResult } = loadBackgroundTask();

  TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
    if (handler === null) return BackgroundTaskResult.Success;

    try {
      await handler();
      return BackgroundTaskResult.Success;
    } catch (error) {
      reportError(error, {
        operation: 'sync.background',
        error_code: 'background_sync_failed',
      });
      return BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSync(minimumIntervalMinutes?: number): Promise<void> {
  const BackgroundTask = loadBackgroundTask();
  await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
    minimumInterval: minimumIntervalMinutes,
  });
}

export async function unregisterBackgroundSync(): Promise<void> {
  const BackgroundTask = loadBackgroundTask();
  await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
}

export async function getBackgroundSyncStatus(): Promise<
  import('expo-background-task').BackgroundTaskStatus | null
> {
  const BackgroundTask = loadBackgroundTask();
  return BackgroundTask.getStatusAsync();
}
