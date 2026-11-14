import { Platform } from 'react-native';

import { getStoredActiveHouseholdId } from '@/features/household/active-household-store';
import { beginBackgroundContext, type SharedStoreLease } from '@/lib/apple/shared-store-lifecycle';
import { getSupabase, serverClock } from '@/lib/backend/supabase/remote-client';
import {
  type ActiveDatabaseAccount,
  closeDatabaseForLifecycle,
  getActiveDatabaseAccount,
  getDatabase,
  setActiveUserId,
} from '@/lib/db/local-client';
import { throwIfSyncAborted } from '@/lib/sync/cancellation';
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

type BackgroundAccountOwnership = ActiveDatabaseAccount & {
  previousUserId: string | null;
};

const BACKGROUND_CLOSE_ATTEMPTS = 2;

async function closeBackgroundDatabase(
  accountOwnership: BackgroundAccountOwnership | null,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < BACKGROUND_CLOSE_ATTEMPTS; attempt += 1) {
    try {
      const result = await closeDatabaseForLifecycle(accountOwnership ?? undefined);
      if (result.status === 'ownership-mismatch') {
        throw new Error(
          'Background database close skipped because the open connection has different ownership.',
        );
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }

  reportError(lastError, {
    operation: 'sync.background.close',
    error_code: 'background_sync_close_failed',
  });
  throw lastError;
}

/**
 * Führt den geplanten Sync ausschließlich aus dauerhaft gespeichertem Zustand
 * aus. Ein iOS-Hintergrundstart mountet keinen React-Baum, deshalb darf dieser
 * Pfad weder Hooks noch einen zuvor gesetzten Closure-Handler benötigen.
 */
async function runBackgroundSync(
  backgroundContext: SharedStoreLease,
  signal: AbortSignal,
  onAccountActivated: (ownership: BackgroundAccountOwnership) => void,
): Promise<void> {
  throwIfSyncAborted(signal);
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  throwIfSyncAborted(signal);
  if (error) throw error;

  const userId = data.session?.user.id;
  if (!userId) return;

  const householdId = await getStoredActiveHouseholdId();
  throwIfSyncAborted(signal);
  if (!householdId) return;

  const previousAccount = getActiveDatabaseAccount();
  setActiveUserId(userId);
  const activeAccount = getActiveDatabaseAccount();
  onAccountActivated({
    ...activeAccount,
    previousUserId: previousAccount.userId,
  });

  const db = await getDatabase({ kind: 'background', backgroundContext, signal });
  throwIfSyncAborted(signal);
  await syncHousehold({
    db,
    supabase,
    serverClock,
    householdIds: [householdId],
    signal,
  });
}

let defined = false;

/** Definiert den nativen Task genau einmal im globalen Modul-Scope. */
export function defineBackgroundSyncTask(): void {
  if (defined) return;
  defined = true;

  const TaskManager = loadTaskManager();
  const BackgroundTask = loadBackgroundTask();

  TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
    const cancellation = new AbortController();
    const backgroundContext = beginBackgroundContext('sync.background', {
      signal: cancellation.signal,
    });
    if (!backgroundContext) return BackgroundTask.BackgroundTaskResult.Failed;

    const cancelFromNativeContext = () => {
      if (!cancellation.signal.aborted) cancellation.abort(backgroundContext.signal.reason);
    };
    backgroundContext.signal.addEventListener('abort', cancelFromNativeContext, { once: true });
    if (backgroundContext.signal.aborted) cancelFromNativeContext();

    const expirationSubscription =
      Platform.OS === 'ios'
        ? BackgroundTask.addExpirationListener(() => {
            cancellation.abort('background-task-expired');
          })
        : null;

    const finishAccountSyncRun = beginAccountSyncRun();
    const accountOwnershipRef: { current: BackgroundAccountOwnership | null } = { current: null };
    try {
      if (finishAccountSyncRun) {
        await runBackgroundSync(backgroundContext, cancellation.signal, (ownership) => {
          accountOwnershipRef.current = ownership;
        });
      }
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      reportError(error, {
        operation: 'sync.background',
        error_code: 'background_sync_failed',
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    } finally {
      expirationSubscription?.remove();
      backgroundContext.signal.removeEventListener('abort', cancelFromNativeContext);
      const accountOwnership = accountOwnershipRef.current;
      // A rejected close keeps the native context and account fence alive. A
      // later process restart is safer than ending the assertion with a raw
      // SQLite handle whose lock state is unresolved.
      await closeBackgroundDatabase(accountOwnership);
      try {
        if (accountOwnership) {
          const currentAccount = getActiveDatabaseAccount();
          if (
            currentAccount.userId === accountOwnership.userId &&
            currentAccount.generation === accountOwnership.generation
          ) {
            setActiveUserId(accountOwnership.previousUserId);
          }
        }
      } finally {
        finishAccountSyncRun?.();
        backgroundContext.end();
      }
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
