import { Platform } from 'react-native';

import { getStoredActiveHouseholdId } from '@/features/household/active-household-store';
import { getSupabase, serverClock } from '@/lib/backend/supabase/remote-client';
import { closeDatabaseForLifecycle, getDatabase, setActiveUserId } from '@/lib/db/local-client';
import { syncHousehold } from '@/lib/sync/remote-sync-engine';
import { beginAccountSyncRun } from '@/lib/sync/remote-sync-gate';
import { reportError } from '@/lib/telemetry';

export const BACKGROUND_SYNC_TASK_NAME = 'fam-background-sync';

const REBUILD_HINT =
  'expo-background-task/expo-task-manager sind im installierten Build nicht ' +
  'enthalten. Native Module kommen nicht über einen Metro-Reload dazu — der ' +
  'Development Build muss neu erstellt werden (`bunx expo run:ios`).';

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

/**
 * Führt den geplanten Sync ausschließlich aus dauerhaft gespeichertem Zustand
 * aus. Ein iOS-Hintergrundstart mountet keinen React-Baum, deshalb darf dieser
 * Pfad weder Hooks noch einen zuvor gesetzten Closure-Handler benötigen.
 */
async function runBackgroundSync(): Promise<void> {
  const finishAccountSyncRun = beginAccountSyncRun();
  if (!finishAccountSyncRun) return;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    const userId = data.session?.user.id;
    if (!userId) return;

    const householdId = await getStoredActiveHouseholdId();
    if (!householdId) return;

    setActiveUserId(userId);
    const db = await getDatabase();
    await syncHousehold({
      db,
      supabase,
      serverClock,
      householdIds: [householdId],
    });
  } finally {
    finishAccountSyncRun();
  }
}

let defined = false;

/** Definiert den nativen Task genau einmal im globalen Modul-Scope. */
export function defineBackgroundSyncTask(): void {
  if (defined) return;
  defined = true;

  const TaskManager = loadTaskManager();
  const BackgroundTask = loadBackgroundTask();

  TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
    const expirationSubscription =
      Platform.OS === 'ios'
        ? BackgroundTask.addExpirationListener(() => {
            void closeDatabaseForLifecycle();
          })
        : null;

    try {
      await runBackgroundSync();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      reportError(error, {
        operation: 'sync.background',
        error_code: 'background_sync_failed',
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    } finally {
      expirationSubscription?.remove();
      await closeDatabaseForLifecycle();
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

// Expo TaskManager wertet das Bundle bei einem kalten Hintergrundstart aus,
// ohne React-Views zu mounten. Die Definition muss deshalb ein Moduleffekt sein.
defineBackgroundSyncTask();
