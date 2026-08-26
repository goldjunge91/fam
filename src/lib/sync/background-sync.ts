/**
 * Hintergrund-Synchronisation (#50).
 *
 * Duenner Wrapper um `expo-background-task`/`expo-task-manager`. Beide sind
 * native Module und laden weder unter `jest-expo` noch im Node-Setup der
 * Integrationstests — derselbe Grund, warum `src/lib/db/client.ts` nicht aus
 * `index.ts` re-exportiert wird. Kein automatisierter Test fuer diese Datei.
 *
 * Expo verlangt, dass `TaskManager.defineTask` im globalen Modul-Scope laeuft,
 * nicht in einer Komponente oder einem Effekt. Dieses Projekt laedt native
 * Module dagegen grundsaetzlich erst bei Bedarf (`loadSQLite()` in
 * `client.ts`, `loadSecureStore()` in `supabase.ts`), damit ein fehlendes
 * Modul nicht beim Import der Datei die halbe App mitreisst. Der Ausweg:
 * `defineBackgroundSyncTask()` ist eine EXPORTIERTE FUNKTION, kein
 * Modul-Top-Level-Seiteneffekt — sie macht den lazy-require selbst, aber der
 * Aufrufer muss sie einmal frueh und auf Anweisungsebene aufrufen (z. B. ganz
 * beim Modul-Start ueber `initialize-app-runtime.ts`), NICHT in einem Hook.
 * Wird das versaeumt, ist die Task zur Laufzeit nie definiert
 * und `registerTaskAsync` schlaegt fehl.
 *
 * Der veraenderliche `handler`-Slot loest ein zweites Problem: die Task kann
 * schon beim Modul-Laden definiert werden, lange bevor es eine echte,
 * haushalts-aufgeloeste Sync-Funktion gibt (die kommt erst mit Epic 4). Wer
 * spaeter echten Sync verdrahten will, ruft `setBackgroundSyncHandler(fn)`
 * auf, ohne die Task neu registrieren zu muessen.
 */

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
    } catch {
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
