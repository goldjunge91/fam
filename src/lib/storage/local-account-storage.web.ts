import type { MMKV } from 'react-native-mmkv';
import { createMMKV, deleteMMKV } from 'react-native-mmkv';

const STORAGE_VERSION = 'v1';
const LAST_ACCOUNT_USER_ID_KEY = `fam.local-account-user.${STORAGE_VERSION}`;
const ACCOUNT_META_STORAGE_ID = `fam-account-meta-web-${STORAGE_VERSION}`;

/**
 * Browser storage is backed by localStorage through react-native-mmkv's web
 * adapter and cannot provide native SecureStore encryption. The native sibling
 * remains the only implementation used on iOS and Android.
 */
const storageByUser = new Map<string, MMKV>();
const openingByUser = new Map<string, Promise<MMKV>>();
const deletedUsers = new Set<string>();
let accountMetaStorage: MMKV | null = null;

function normalizeUserId(userId: string): string {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Für benutzerspezifischen Speicher ist eine userId erforderlich.');
  }
  return normalizedUserId;
}

function storageId(userId: string): string {
  return `fam-account-web-${STORAGE_VERSION}-${encodeURIComponent(userId)}`;
}

function getAccountMetaStorage(): MMKV {
  accountMetaStorage ??= createMMKV({
    id: ACCOUNT_META_STORAGE_ID,
    mode: 'single-process',
  });
  return accountMetaStorage;
}

/** Gibt den Speicher nach einem vollständig abgeschlossenen Accountwechsel wieder frei. */
export function activateEncryptedAccountStorage(userId: string): void {
  const normalizedUserId = normalizeUserId(userId);
  if (!deletedUsers.has(normalizedUserId)) return;
  deletedUsers.delete(normalizedUserId);
  storageByUser.delete(normalizedUserId);
  openingByUser.delete(normalizedUserId);
}

/** Öffnet den browserseitig getrennten Speicher eines Supabase-Nutzers. */
export async function getEncryptedAccountStorage(userId: string): Promise<MMKV> {
  const normalizedUserId = normalizeUserId(userId);
  if (deletedUsers.has(normalizedUserId)) {
    throw new Error('Der Account-Speicher ist bis zur nächsten Anmeldung gesperrt.');
  }

  const existing = storageByUser.get(normalizedUserId);
  if (existing) return existing;

  const pending = Promise.resolve().then(() => {
    if (deletedUsers.has(normalizedUserId)) {
      throw new Error('Der Account-Speicher wird gerade gelöscht.');
    }

    const current = storageByUser.get(normalizedUserId);
    if (current) return current;

    const created = createMMKV({
      id: storageId(normalizedUserId),
      mode: 'single-process',
    });
    storageByUser.set(normalizedUserId, created);
    return created;
  });
  openingByUser.set(normalizedUserId, pending);

  try {
    return await pending;
  } finally {
    if (openingByUser.get(normalizedUserId) === pending) {
      openingByUser.delete(normalizedUserId);
    }
  }
}

/** Entfernt die browserseitige Account-Instanz und ihre localStorage-Werte. */
export async function deleteEncryptedAccountStorage(userId: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  deletedUsers.add(normalizedUserId);

  const pending = openingByUser.get(normalizedUserId);
  if (pending) {
    try {
      await pending;
    } catch {
      // Der laufende Open-Versuch darf den Cleanup nicht verhindern.
    }
  }

  const storage = storageByUser.get(normalizedUserId);
  try {
    storage?.clearAll();
  } finally {
    storage?.dispose();
    storageByUser.delete(normalizedUserId);
    openingByUser.delete(normalizedUserId);
    deleteMMKV(storageId(normalizedUserId));
  }
}

export async function rememberLocalAccountUserId(userId: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  getAccountMetaStorage().set(LAST_ACCOUNT_USER_ID_KEY, normalizedUserId);
}

export async function getRememberedLocalAccountUserId(): Promise<string | null> {
  return getAccountMetaStorage().getString(LAST_ACCOUNT_USER_ID_KEY) ?? null;
}

/** Entfernt den Besitzer-Marker nur, wenn er noch zum bereinigten Nutzer gehört. */
export async function forgetLocalAccountUserId(userId: string): Promise<void> {
  const rememberedUserId = await getRememberedLocalAccountUserId();
  if (rememberedUserId === userId) {
    getAccountMetaStorage().remove(LAST_ACCOUNT_USER_ID_KEY);
  }
}
