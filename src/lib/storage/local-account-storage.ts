import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { MMKV } from 'react-native-mmkv';

const STORAGE_VERSION = 'v1';
const LAST_ACCOUNT_USER_ID_KEY = `fam.local-account-user.${STORAGE_VERSION}`;
const PENDING_DELETIONS_KEY = `fam.mmkv.pending-deletions.${STORAGE_VERSION}`;
const ENCRYPTION_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ACCOUNT_KEY_OPTIONS: SecureStore.SecureStoreOptions =
  Platform.OS === 'ios'
    ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
    : {};

const MAX_PENDING_DELETIONS = 100;

type PendingStorage = { generation: number; promise: Promise<MMKV> };
type MMKVModule = typeof import('react-native-mmkv');
type AccountStorageIdentity = { instanceId: string; secureStoreKey: string };
type PendingDeletion = AccountStorageIdentity;

const storagePromises = new Map<string, PendingStorage>();
const storageGenerations = new Map<string, number>();
const storageTombstones = new Set<string>();
const retainedStoragesForReactivation = new Set<string>();
const openedInstanceIds = new Set<string>();
let pendingDeletionTail: Promise<void> = Promise.resolve();

class StaleAccountStorageOpenError extends Error {}

function normalizeUserId(userId: string): string {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Für benutzerspezifischen Speicher ist eine userId erforderlich.');
  }
  return normalizedUserId;
}

function nextStorageGeneration(userId: string): number {
  const generation = (storageGenerations.get(userId) ?? 0) + 1;
  storageGenerations.set(userId, generation);
  return generation;
}

function assertStorageOpenIsCurrent(userId: string, generation: number): void {
  if (storageTombstones.has(userId) || storageGenerations.get(userId) !== generation) {
    throw new StaleAccountStorageOpenError('Der Account-Speicher wird gerade gelöscht.');
  }
}

function loadMMKV(): MMKVModule {
  try {
    return require('react-native-mmkv') as MMKVModule;
  } catch (error) {
    throw new Error(
      'Das native Modul react-native-mmkv fehlt im installierten Development Build. Erstelle den Dev Client neu.',
      { cause: error },
    );
  }
}

async function accountStorageIdentity(userId: string): Promise<AccountStorageIdentity> {
  const normalizedUserId = normalizeUserId(userId);
  const userHash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, normalizedUserId);
  return {
    instanceId: `fam-account-${normalizedUserId}-${STORAGE_VERSION}`,
    secureStoreKey: `fam.mmkv.account-key.${STORAGE_VERSION}.${userHash}`,
  };
}

function parsePendingDeletions(value: string | null): PendingDeletion[] {
  if (value === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error('Der vorgemerkte MMKV-Cleanup ist ungültig.', { cause: error });
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_PENDING_DELETIONS) {
    throw new Error('Der vorgemerkte MMKV-Cleanup ist ungültig.');
  }

  const entries = new Map<string, PendingDeletion>();
  for (const value of parsed) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Der vorgemerkte MMKV-Cleanup ist ungültig.');
    }
    const { instanceId, secureStoreKey } = value as Record<string, unknown>;
    if (
      typeof instanceId !== 'string' ||
      !instanceId.startsWith('fam-account-') ||
      typeof secureStoreKey !== 'string' ||
      !secureStoreKey.startsWith(`fam.mmkv.account-key.${STORAGE_VERSION}.`)
    ) {
      throw new Error('Der vorgemerkte MMKV-Cleanup ist ungültig.');
    }
    entries.set(instanceId, { instanceId, secureStoreKey });
  }
  return [...entries.values()].sort((left, right) =>
    left.instanceId.localeCompare(right.instanceId),
  );
}

async function writePendingDeletions(entries: readonly PendingDeletion[]): Promise<void> {
  if (entries.length === 0) {
    await SecureStore.deleteItemAsync(PENDING_DELETIONS_KEY);
    return;
  }
  await SecureStore.setItemAsync(
    PENDING_DELETIONS_KEY,
    JSON.stringify(entries),
    ACCOUNT_KEY_OPTIONS,
  );
}

function withPendingDeletionLock<T>(task: () => Promise<T>): Promise<T> {
  const operation = pendingDeletionTail.then(task);
  pendingDeletionTail = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

function deleteMMKVFile(instanceId: string): void {
  const mmkv = loadMMKV();
  if (mmkv.existsMMKV(instanceId)) {
    mmkv.deleteMMKV(instanceId);
  }
  if (mmkv.existsMMKV(instanceId)) {
    throw new Error('Die Account-MMKV-Datei konnte nicht gelöscht werden.');
  }
}

async function deletePhysicalStorage(identity: AccountStorageIdentity): Promise<void> {
  deleteMMKVFile(identity.instanceId);
  await SecureStore.deleteItemAsync(identity.secureStoreKey);
}

async function processPendingPhysicalDeletions(): Promise<void> {
  await withPendingDeletionLock(async () => {
    const stored = await SecureStore.getItemAsync(PENDING_DELETIONS_KEY);
    if (stored === null) return;

    const pending = parsePendingDeletions(stored);
    const remaining: PendingDeletion[] = [];
    let firstError: unknown;

    for (const identity of pending) {
      // MMKV issue #1082: deleteMMKV() must never target an instance created
      // in this JS process. Such entries remain queued until the next cold process.
      // https://github.com/margelo/react-native-mmkv/issues/1082
      if (openedInstanceIds.has(identity.instanceId)) {
        remaining.push(identity);
        continue;
      }
      try {
        await deletePhysicalStorage(identity);
      } catch (error) {
        remaining.push(identity);
        firstError ??= error;
      }
    }

    await writePendingDeletions(remaining);
    if (firstError) {
      throw new Error('Ein vorgemerkter Account-Speicher konnte nicht gelöscht werden.', {
        cause: firstError,
      });
    }
  });
}

async function schedulePhysicalDeletion(identity: AccountStorageIdentity): Promise<void> {
  await withPendingDeletionLock(async () => {
    const pending = parsePendingDeletions(
      await SecureStore.getItemAsync(PENDING_DELETIONS_KEY),
    ).filter((entry) => entry.instanceId !== identity.instanceId);
    pending.push(identity);
    pending.sort((left, right) => left.instanceId.localeCompare(right.instanceId));
    await writePendingDeletions(pending);
  });
}

async function cancelPhysicalDeletion(identity: AccountStorageIdentity): Promise<void> {
  await withPendingDeletionLock(async () => {
    const stored = await SecureStore.getItemAsync(PENDING_DELETIONS_KEY);
    if (stored === null) return;
    const pending = parsePendingDeletions(stored);
    const remaining = pending.filter((entry) => entry.instanceId !== identity.instanceId);
    if (remaining.length === pending.length) return;
    await writePendingDeletions(remaining);
  });
}

async function createEncryptionKey(): Promise<string> {
  // 24 zufällige Bytes ergeben ohne Padding exakt 32 URL-sichere Zeichen.
  // Damit passt der Schlüssel ohne UTF-8-Trunkierung in MMKVs AES-256-Limit.
  const bytes = await getRandomBytesAsync(24);
  let key = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    key += ENCRYPTION_KEY_ALPHABET[(chunk >> 18) & 63];
    key += ENCRYPTION_KEY_ALPHABET[(chunk >> 12) & 63];
    key += ENCRYPTION_KEY_ALPHABET[(chunk >> 6) & 63];
    key += ENCRYPTION_KEY_ALPHABET[chunk & 63];
  }

  return key;
}

async function createAccountStorage(
  userId: string,
  generation: number,
  identity: AccountStorageIdentity,
): Promise<MMKV> {
  let encryptionKey = await SecureStore.getItemAsync(identity.secureStoreKey);
  assertStorageOpenIsCurrent(userId, generation);
  if (!encryptionKey) {
    encryptionKey = await createEncryptionKey();
    assertStorageOpenIsCurrent(userId, generation);
    await SecureStore.setItemAsync(identity.secureStoreKey, encryptionKey, ACCOUNT_KEY_OPTIONS);
    assertStorageOpenIsCurrent(userId, generation);
  }

  assertStorageOpenIsCurrent(userId, generation);
  const storage = loadMMKV().createMMKV({
    id: identity.instanceId,
    encryptionKey,
    encryptionType: 'AES-256',
    mode: 'single-process',
  });
  openedInstanceIds.add(identity.instanceId);
  return storage;
}

/** Gibt den Speicher nach einem vollständig abgeschlossenen Accountwechsel wieder frei. */
export function activateEncryptedAccountStorage(userId: string): void {
  const normalizedUserId = normalizeUserId(userId);
  if (!storageTombstones.has(normalizedUserId)) return;
  nextStorageGeneration(normalizedUserId);
  storageTombstones.delete(normalizedUserId);
  if (!retainedStoragesForReactivation.has(normalizedUserId)) {
    storagePromises.delete(normalizedUserId);
  }
}

/** Öffnet den verschlüsselten, ausschließlich diesem Supabase-Nutzer gehörenden Speicher. */
export async function getEncryptedAccountStorage(userId: string): Promise<MMKV> {
  const normalizedUserId = normalizeUserId(userId);
  if (storageTombstones.has(normalizedUserId)) {
    throw new Error('Der Account-Speicher ist bis zur nächsten Anmeldung gesperrt.');
  }

  const existing = storagePromises.get(normalizedUserId);
  const generation = storageGenerations.get(normalizedUserId) ?? 0;
  storageGenerations.set(normalizedUserId, generation);

  if (existing) {
    if (!retainedStoragesForReactivation.delete(normalizedUserId)) {
      return existing.promise;
    }

    let reactivating: Promise<MMKV>;
    reactivating = (async () => {
      await processPendingPhysicalDeletions();
      assertStorageOpenIsCurrent(normalizedUserId, generation);
      const identity = await accountStorageIdentity(normalizedUserId);
      assertStorageOpenIsCurrent(normalizedUserId, generation);
      await cancelPhysicalDeletion(identity);
      assertStorageOpenIsCurrent(normalizedUserId, generation);
      return existing.promise;
    })().catch((error) => {
      if (storagePromises.get(normalizedUserId)?.promise === reactivating) {
        retainedStoragesForReactivation.add(normalizedUserId);
        storagePromises.set(normalizedUserId, {
          generation,
          promise: existing.promise,
        });
      }
      throw error;
    });
    storagePromises.set(normalizedUserId, { generation, promise: reactivating });
    return reactivating;
  }

  let pending: Promise<MMKV>;
  pending = (async () => {
    await processPendingPhysicalDeletions();
    assertStorageOpenIsCurrent(normalizedUserId, generation);
    const identity = await accountStorageIdentity(normalizedUserId);
    assertStorageOpenIsCurrent(normalizedUserId, generation);
    if (openedInstanceIds.has(identity.instanceId)) {
      throw new Error(
        'Der Account-Speicher kann erst nach einem App-Neustart erneut geöffnet werden.',
      );
    }
    await cancelPhysicalDeletion(identity);
    assertStorageOpenIsCurrent(normalizedUserId, generation);
    return createAccountStorage(normalizedUserId, generation, identity);
  })().catch((error) => {
    if (storagePromises.get(normalizedUserId)?.promise === pending) {
      storagePromises.delete(normalizedUserId);
    }
    throw error;
  });
  storagePromises.set(normalizedUserId, { generation, promise: pending });
  return pending;
}

/**
 * Leert geöffnete Accountdaten sofort. Die Datei und ihr Schlüssel werden erst
 * in einem späteren Prozess gelöscht, bevor diese MMKV-ID erneut geöffnet wird.
 */
export async function deleteEncryptedAccountStorage(userId: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  const generation = nextStorageGeneration(normalizedUserId);
  storageTombstones.add(normalizedUserId);
  const pending = storagePromises.get(normalizedUserId)?.promise;

  await processPendingPhysicalDeletions();
  const identity = await accountStorageIdentity(normalizedUserId);

  let storage: MMKV | null = null;
  if (pending) {
    try {
      storage = await pending;
    } catch {
      storage = null;
    }
  }

  if (storageGenerations.get(normalizedUserId) !== generation) {
    throw new Error('Der Account-Speicher wurde während des Löschens erneut aktiviert.');
  }

  if (storage) {
    // Der dauerhafte Auftrag muss vor dem Clear existieren. So bleibt selbst
    // ein Abbruch während clearAll() beim nächsten Kaltstart reparierbar.
    retainedStoragesForReactivation.add(normalizedUserId);
    await schedulePhysicalDeletion(identity);
    if (storageGenerations.get(normalizedUserId) !== generation) {
      await cancelPhysicalDeletion(identity);
      retainedStoragesForReactivation.delete(normalizedUserId);
      throw new Error('Der Account-Speicher wurde während des Löschens erneut aktiviert.');
    }

    // Die Instanz bleibt auch bei einem Clear-Fehler absichtlich lebendig:
    // dispose/deleteMMKV würde die in Issue #1082 beschriebenen AppState- und
    // Memory-Warning-Crashes öffnen.
    storage.clearAll();
    return;
  }

  storagePromises.delete(normalizedUserId);
  retainedStoragesForReactivation.delete(normalizedUserId);
  if (openedInstanceIds.has(identity.instanceId)) {
    throw new Error(
      'Eine geöffnete Account-MMKV kann erst nach einem App-Neustart gelöscht werden.',
    );
  }
  await deletePhysicalStorage(identity);
}

export async function rememberLocalAccountUserId(userId: string): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Für den lokalen Account-Besitzer ist eine userId erforderlich.');
  }

  await SecureStore.setItemAsync(LAST_ACCOUNT_USER_ID_KEY, normalizedUserId, ACCOUNT_KEY_OPTIONS);
}

export async function getRememberedLocalAccountUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_ACCOUNT_USER_ID_KEY);
}

/** Entfernt den Besitzer-Marker nur, wenn er noch zum bereinigten Nutzer gehört. */
export async function forgetLocalAccountUserId(userId: string): Promise<void> {
  const rememberedUserId = await getRememberedLocalAccountUserId();
  if (rememberedUserId === userId) {
    await SecureStore.deleteItemAsync(LAST_ACCOUNT_USER_ID_KEY);
  }
}
