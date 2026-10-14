import * as SecureStore from 'expo-secure-store';
import { createMMKV, deleteMMKV, existsMMKV } from 'react-native-mmkv';
import {
  activateEncryptedAccountStorage,
  deleteEncryptedAccountStorage,
  forgetLocalAccountUserId,
  getEncryptedAccountStorage,
  getRememberedLocalAccountUserId,
  rememberLocalAccountUserId,
} from './local-account-storage';
import * as browserAccountStorage from './local-account-storage.web';

const mockDigestString = jest.fn();
const mockRandomBytes = jest.fn();
let mockMMKVExists = true;

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: (...args: unknown[]) => mockDigestString(...args),
  getRandomBytesAsync: (...args: unknown[]) => mockRandomBytes(...args),
}));

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(),
  deleteMMKV: jest.fn(() => {
    mockMMKVExists = false;
    return true;
  }),
  existsMMKV: jest.fn(() => mockMMKVExists),
}));

function createStorage(id: string) {
  return {
    id,
    clearAll: jest.fn(),
    dispose: jest.fn(),
  };
}

function createBrowserStorage(id: string) {
  const values = new Map<string, string>();
  return {
    id,
    set: jest.fn((key: string, value: string) => values.set(key, value)),
    getString: jest.fn((key: string) => values.get(key)),
    remove: jest.fn((key: string) => values.delete(key)),
    clearAll: jest.fn(() => values.clear()),
    dispose: jest.fn(),
  };
}

describe('encrypted account storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    jest.mocked(deleteMMKV).mockImplementation(() => {
      mockMMKVExists = false;
      return true;
    });
    jest.mocked(existsMMKV).mockImplementation(() => mockMMKVExists);
    mockMMKVExists = true;
    mockRandomBytes.mockResolvedValue(Uint8Array.from({ length: 24 }, (_, index) => index));
  });

  it('erzeugt pro Nutzer eine AES-256-verschlüsselte MMKV-Instanz', async () => {
    mockDigestString.mockResolvedValue('hash-a');
    const storage = createStorage('fam-account-user-a-v1');
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    await expect(getEncryptedAccountStorage('user-a')).resolves.toBe(storage);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'fam.mmkv.account-key.v1.hash-a',
      expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
      { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
    );
    expect(createMMKV).toHaveBeenCalledWith({
      id: 'fam-account-user-a-v1',
      encryptionKey: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/),
      encryptionType: 'AES-256',
      mode: 'single-process',
    });
  });

  it('verwendet vorhandenes Schlüsselmaterial aus dem SecureStore', async () => {
    mockDigestString.mockResolvedValue('hash-b');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('existing-encryption-key-123456');
    const storage = createStorage('fam-account-user-b-v1');
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    await getEncryptedAccountStorage('user-b');

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(createMMKV).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionKey: 'existing-encryption-key-123456' }),
    );
  });

  it('öffnet dieselbe Nutzerinstanz innerhalb des Prozesses nur einmal', async () => {
    mockDigestString.mockResolvedValue('hash-c');
    const storage = createStorage('fam-account-user-c-v1');
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    const first = await getEncryptedAccountStorage('user-c');
    const second = await getEncryptedAccountStorage('user-c');

    expect(first).toBe(second);
    expect(createMMKV).toHaveBeenCalledTimes(1);
  });

  it('entfernt Instanzdatei und Schlüsselmaterial beim Account-Cleanup', async () => {
    mockDigestString.mockResolvedValue('hash-d');
    const storage = createStorage('fam-account-user-d-v1');
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    await getEncryptedAccountStorage('user-d');
    await deleteEncryptedAccountStorage('user-d');

    expect(storage.clearAll).toHaveBeenCalledTimes(1);
    expect(storage.dispose).toHaveBeenCalledTimes(1);
    expect(deleteMMKV).toHaveBeenCalledWith('fam-account-user-d-v1');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fam.mmkv.account-key.v1.hash-d');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('fam_onboarding_completed_v1');
  });

  it('lässt einen veralteten asynchronen Open nach begonnenem Cleanup nichts neu anlegen', async () => {
    mockDigestString.mockResolvedValue('hash-race');
    let resolveStoredKey: ((value: string | null) => void) | undefined;
    jest.mocked(SecureStore.getItemAsync).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStoredKey = resolve;
      }),
    );

    const opening = getEncryptedAccountStorage('user-race');
    await Promise.resolve();
    await Promise.resolve();
    const deleting = deleteEncryptedAccountStorage('user-race');
    resolveStoredKey?.(null);

    await expect(opening).rejects.toThrow(/gelöscht/);
    await expect(deleting).resolves.toBeUndefined();
    expect(createMMKV).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(deleteMMKV).toHaveBeenCalledWith('fam-account-user-race-v1');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fam.mmkv.account-key.v1.hash-race');
  });

  it('gibt denselben Nutzer erst nach expliziter Aktivierung wieder frei', async () => {
    mockDigestString.mockResolvedValue('hash-reactivate');
    const storage = createStorage('fam-account-user-reactivate-v1');
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    await deleteEncryptedAccountStorage('user-reactivate');
    await expect(getEncryptedAccountStorage('user-reactivate')).rejects.toThrow(/gesperrt/);

    activateEncryptedAccountStorage('user-reactivate');
    await expect(getEncryptedAccountStorage('user-reactivate')).resolves.toBe(storage);
  });

  it('lässt wiederholte Aktivierung eines bereits aktiven Nutzers wirkungslos', async () => {
    mockDigestString.mockResolvedValue('hash-active');
    const storage = createStorage('fam-account-user-active-v1');
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    activateEncryptedAccountStorage('user-active');
    const first = await getEncryptedAccountStorage('user-active');
    activateEncryptedAccountStorage('user-active');
    const second = await getEncryptedAccountStorage('user-active');

    expect(second).toBe(first);
    expect(createMMKV).toHaveBeenCalledTimes(1);
  });

  it('schließt den Cleanup ab wenn der physische Delete trotz Clear-Fehler gelingt', async () => {
    mockDigestString.mockResolvedValue('hash-cleanup-error');
    const storage = createStorage('fam-account-user-cleanup-error-v1');
    storage.clearAll.mockImplementation(() => {
      throw new Error('corrupt MMKV');
    });
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    await getEncryptedAccountStorage('user-cleanup-error');
    await expect(deleteEncryptedAccountStorage('user-cleanup-error')).resolves.toBeUndefined();

    expect(storage.dispose).toHaveBeenCalledTimes(1);
    expect(deleteMMKV).toHaveBeenCalledWith('fam-account-user-cleanup-error-v1');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'fam.mmkv.account-key.v1.hash-cleanup-error',
    );
  });

  it('behält Schlüsselmaterial und schlägt fail-closed fehl wenn deleteMMKV false liefert', async () => {
    mockDigestString.mockResolvedValue('hash-delete-failed');
    jest.mocked(deleteMMKV).mockReturnValueOnce(false);

    await expect(deleteEncryptedAccountStorage('user-delete-failed')).rejects.toThrow(
      /konnte nicht gelöscht/,
    );

    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      'fam.mmkv.account-key.v1.hash-delete-failed',
    );
  });

  it('löscht bei einem Retry den Key auch wenn die MMKV-Datei bereits fehlt', async () => {
    mockDigestString.mockResolvedValue('hash-key-retry');
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockRejectedValueOnce(new Error('secure store busy'))
      .mockResolvedValueOnce(undefined);

    await expect(deleteEncryptedAccountStorage('user-key-retry')).rejects.toThrow(
      'secure store busy',
    );
    expect(mockMMKVExists).toBe(false);

    await expect(deleteEncryptedAccountStorage('user-key-retry')).resolves.toBeUndefined();
    expect(deleteMMKV).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
  });

  it('merkt den letzten lokalen Account ausschließlich im SecureStore', async () => {
    await rememberLocalAccountUserId('user-e');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fam.local-account-user.v1', 'user-e', {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  });

  it('liest und entfernt nur den passenden Besitzer-Marker', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('user-f');

    await expect(getRememberedLocalAccountUserId()).resolves.toBe('user-f');
    await forgetLocalAccountUserId('user-other');
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('fam.local-account-user.v1');

    await forgetLocalAccountUserId('user-f');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fam.local-account-user.v1');
  });
});

describe('browser account storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps a separate browser store for each normalized user id', async () => {
    const firstStorage = createBrowserStorage('account-a');
    const secondStorage = createBrowserStorage('account-b');
    jest
      .mocked(createMMKV)
      .mockReturnValueOnce(firstStorage as never)
      .mockReturnValueOnce(secondStorage as never);

    const first = await browserAccountStorage.getEncryptedAccountStorage(' user/a ');
    const firstAgain = await browserAccountStorage.getEncryptedAccountStorage('user/a');
    const second = await browserAccountStorage.getEncryptedAccountStorage('user-b');

    expect(first).toBe(firstStorage);
    expect(firstAgain).toBe(firstStorage);
    expect(second).toBe(secondStorage);
    expect(createMMKV).toHaveBeenNthCalledWith(1, {
      id: 'fam-account-web-v1-user%2Fa',
      mode: 'single-process',
    });
    expect(createMMKV).toHaveBeenNthCalledWith(2, {
      id: 'fam-account-web-v1-user-b',
      mode: 'single-process',
    });
  });

  it('locks a deleted account until activation and removes its browser storage', async () => {
    const storage = createBrowserStorage('account-delete');
    jest.mocked(createMMKV).mockReturnValue(storage as never);

    await browserAccountStorage.getEncryptedAccountStorage('user-delete');
    await browserAccountStorage.deleteEncryptedAccountStorage('user-delete');

    expect(storage.clearAll).toHaveBeenCalledTimes(1);
    expect(storage.dispose).toHaveBeenCalledTimes(1);
    expect(deleteMMKV).toHaveBeenCalledWith('fam-account-web-v1-user-delete');
    await expect(browserAccountStorage.getEncryptedAccountStorage('user-delete')).rejects.toThrow(
      /gesperrt/,
    );

    browserAccountStorage.activateEncryptedAccountStorage('user-delete');
    const restoredStorage = createBrowserStorage('account-restored');
    jest.mocked(createMMKV).mockReturnValueOnce(restoredStorage as never);
    await expect(browserAccountStorage.getEncryptedAccountStorage('user-delete')).resolves.toBe(
      restoredStorage,
    );
  });

  it('remembers and forgets only the matching browser account marker', async () => {
    const metadata = createBrowserStorage('account-metadata');
    jest.mocked(createMMKV).mockReturnValue(metadata as never);

    await browserAccountStorage.rememberLocalAccountUserId('user-web');

    expect(metadata.set).toHaveBeenCalledWith('fam.local-account-user.v1', 'user-web');
    await expect(browserAccountStorage.getRememberedLocalAccountUserId()).resolves.toBe('user-web');
    await browserAccountStorage.forgetLocalAccountUserId('another-user');
    expect(metadata.remove).not.toHaveBeenCalled();

    await browserAccountStorage.forgetLocalAccountUserId('user-web');
    expect(metadata.remove).toHaveBeenCalledWith('fam.local-account-user.v1');
  });

  it('rejects blank user ids before creating a store', async () => {
    await expect(browserAccountStorage.getEncryptedAccountStorage('  ')).rejects.toThrow(
      /userId erforderlich/,
    );
    expect(createMMKV).not.toHaveBeenCalled();
  });
});
