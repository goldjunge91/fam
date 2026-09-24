export const BACKGROUND_SYNC_TASK_NAME = 'fam-background-sync';

/**
 * BackgroundTask is native-only. Web foreground and auth lifecycle code can
 * still call this module, but no native task module is loaded in the browser.
 */
export function setBackgroundSyncHandler(_fn: (() => Promise<void>) | null): void {}

export function defineBackgroundSyncTask(): void {}

export async function registerBackgroundSync(_minimumIntervalMinutes?: number): Promise<void> {}

export async function unregisterBackgroundSync(): Promise<void> {}

export async function getBackgroundSyncStatus(): Promise<null> {
  return null;
}
