import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { MMKV } from 'react-native-mmkv';

const STORAGE_VERSION = 'v1';
const LAST_ACCOUNT_USER_ID_KEY = `fam.local-account-user.${STORAGE_VERSION}`;
const ENCRYPTION_KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

type PendingStorage = { generation: number; promise: Promise<MMKV> };

const storagePromises = new Map<string, PendingStorage>();
const storageGenerations = new Map<string, number>();
const storageTombstones = new Set<string>();

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

function loadMMKV() {
  try {
    return require('react-native-mmkv') as typeof import('react-native-mmkv');
  } catch (error) {
    throw new Error(
      'Das native Modul react-native-mmkv fehlt im installierten Development Build. Erstelle den Dev Client neu.',
      { cause: error },
    );
  }
}

async function accountStorageIdentity(userId: string) {
  const normalizedUserId = normalizeUserId(userId);

  const userHash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, normalizedUserId);
  return {
    instanceId: `fam-account-${normalizedUserId}-${STORAGE_VERSION}`,
    secureStoreKey: `fam.mmkv.account-key.${STORAGE_VERSION}.${userHash}`,
  };
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
  instanceId: string,
  secureStoreKey: string,
): Promise<MMKV> {
  let encryptionKey = await SecureStore.getItemAsync(secureStoreKey);
  assertStorageOpenIsCurrent(userId, generation);
  if (!encryptionKey) {
    encryptionKey = await createEncryptionKey();
    assertStorageOpenIsCurrent(userId, generation);
    await SecureStore.setItemAsync(secureStoreKey, encryptionKey, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    assertStorageOpenIsCurrent(userId, generation);
  }

  assertStorageOpenIsCurrent(userId, generation);
  return loadMMKV().createMMKV({
    id: instanceId,
    encryptionKey,
    encryptionType: 'AES-256',
    mode: 'single-process',
  });
}

/** Gibt den Speicher nach einem vollständig abgeschlossenen Accountwechsel wieder frei. */
export function activateEncryptedAccountStorage(userId: string): void {
  const normalizedUserId = normalizeUserId(userId);
  if (!storageTombstones.has(normalizedUserId)) return;
  nextStorageGeneration(normalizedUserId);
  storageTombstones.delete(normalizedUserId);
  storagePromises.delete(normalizedUserId);
}

/** Öffnet den verschlüsselten, ausschließlich diesem Supabase-Nutzer gehörenden Speicher. */
export async function getEncryptedAccountStorage(userId: string): Promise<MMKV> {
  const normalizedUserId = normalizeUserId(userId);
  if (storageTombstones.has(normalizedUserId)) {
    throw new Error('Der Account-Speicher ist bis zur nächsten Anmeldung gesperrt.');
  }

  const existing = storagePromises.get(normalizedUserId);
  if (existing) return existing.promise;

  const generation = storageGenerations.get(normalizedUserId) ?? 0;
  storageGenerations.set(normalizedUserId, generation);
  const pending = (async () => {
    const identity = await accountStorageIdentity(normalizedUserId);
    assertStorageOpenIsCurrent(normalizedUserId, generation);
    return createAccountStorage(
      normalizedUserId,
      generation,
      identity.instanceId,
      identity.secureStoreKey,
    );
  })().catch((error) => {
    if (storagePromises.get(normalizedUserId)?.promise === pending) {
      storagePromises.delete(normalizedUserId);
    }
    throw error;
  });
  storagePromises.set(normalizedUserId, { generation, promise: pending });
  return pending;
}

/** Entfernt Werte, MMKV-Datei und Schlüsselmaterial eines Accounts vollständig vom Gerät. */
export async function deleteEncryptedAccountStorage(userId: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  const generation = nextStorageGeneration(normalizedUserId);
  storageTombstones.add(normalizedUserId);
  const pending = storagePromises.get(normalizedUserId)?.promise;
  const identity = await accountStorageIdentity(normalizedUserId);

  try {
    if (pending) {
      const storage = await pending;
      try {
        storage.clearAll();
      } finally {
        storage.dispose();
      }
    }
  } catch {
    // `deleteMMKV` unten ist die autoritative physische Löschung. Ein Fehler
    // beim vorherigen Clear/Dispose darf sie nicht verhindern.
  }

  if (storageGenerations.get(normalizedUserId) !== generation) {
    throw new Error('Der Account-Speicher wurde während des Löschens erneut aktiviert.');
  }

  storagePromises.delete(normalizedUserId);
  let deleteError: unknown;
  try {
    const mmkv = loadMMKV();
    if (mmkv.existsMMKV(identity.instanceId)) {
      mmkv.deleteMMKV(identity.instanceId);
    }
    if (mmkv.existsMMKV(identity.instanceId)) {
      deleteError = new Error('Die Account-MMKV-Datei konnte nicht gelöscht werden.');
    }
  } catch (error) {
    deleteError = error;
  }

  // Schlüsselmaterial erst entfernen, wenn die MMKV-Bereinigung vollständig
  // erfolgreich war. So bleibt ein fehlgeschlagener Dateiwipe wiederholbar.
  if (!deleteError) {
    try {
      await SecureStore.deleteItemAsync(identity.secureStoreKey);
    } catch (error) {
      deleteError = error;
    }
  }

  if (deleteError) throw deleteError;
}

/**
 * Merkt den Besitzer der lokalen Account-Daten im SecureStore. Nur so kann
 * ein Kaltstart mit abgelaufener/verwaister Supabase-Session die richtige
 * Account-MMKV-Datei entfernen, ohne die User-ID in Klartext-MMKV abzulegen.
 */
export async function rememberLocalAccountUserId(userId: string): Promise<void> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Für den lokalen Account-Besitzer ist eine userId erforderlich.');
  }

  await SecureStore.setItemAsync(LAST_ACCOUNT_USER_ID_KEY, normalizedUserId, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
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
