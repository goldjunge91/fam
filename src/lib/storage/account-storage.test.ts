import * as SecureStore from 'expo-secure-store';
import { createMMKV, deleteMMKV, existsMMKV } from 'react-native-mmkv';
import {
  activateEncryptedAccountStorage,
  deleteEncryptedAccountStorage,
  forgetLocalAccountUserId,
  getEncryptedAccountStorage,
  getRememberedLocalAccountUserId,
  rememberLocalAccountUserId,
} from './account-storage';

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
