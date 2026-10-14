import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { LocalSupabaseSessionStorage } from './local-supabase-session-storage';

const mockKey = {
  encoded: jest.fn().mockResolvedValue('generated-key'),
};
const mockGenerate = jest.fn().mockResolvedValue(mockKey);
const mockImport = jest.fn().mockResolvedValue(mockKey);
const mockEncrypt = jest.fn();
const mockDecrypt = jest.fn();
const mockFromCombined = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  AESKeySize: { AES256: 256 },
  AESEncryptionKey: {
    generate: (...args: unknown[]) => mockGenerate(...args),
    import: (...args: unknown[]) => mockImport(...args),
  },
  AESSealedData: { fromCombined: (...args: unknown[]) => mockFromCombined(...args) },
  aesDecryptAsync: (...args: unknown[]) => mockDecrypt(...args),
  aesEncryptAsync: (...args: unknown[]) => mockEncrypt(...args),
}));

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function encodeBase64Utf8(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

describe('LocalSupabaseSessionStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    mockKey.encoded.mockResolvedValue('generated-key');
    mockGenerate.mockResolvedValue(mockKey);
    mockImport.mockResolvedValue(mockKey);
    mockEncrypt.mockResolvedValue({ combined: jest.fn().mockResolvedValue('encrypted-session') });
    mockDecrypt.mockResolvedValue(btoa('session-value'));
    mockFromCombined.mockReturnValue('sealed-session');
  });

  it('verschlüsselt die Session mit AES-256-GCM und legt nur den Schlüssel im SecureStore ab', async () => {
    const storage = new LocalSupabaseSessionStorage();

    await storage.setItem('sb-example-auth-token', 'session-value');

    expect(mockGenerate).toHaveBeenCalledWith(256);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'fam.supabase-auth.encryption-key.v1',
      'generated-key',
      { keychainAccessible: 7 },
    );
    expect(mockEncrypt).toHaveBeenCalledWith(btoa('session-value'), mockKey);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('sb-example-auth-token', 'encrypted-session');
  });

  it('liest und entschlüsselt eine gespeicherte Session', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('encrypted-session');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('stored-key');

    await expect(new LocalSupabaseSessionStorage().getItem('sb-example-auth-token')).resolves.toBe(
      'session-value',
    );

    expect(mockImport).toHaveBeenCalledWith('stored-key', 'base64');
    expect(mockFromCombined).toHaveBeenCalledWith('encrypted-session');
    expect(mockDecrypt).toHaveBeenCalledWith('sealed-session', mockKey, { output: 'base64' });
  });

  it('round-trips Unicode session values through UTF-8 and base64', async () => {
    const value = 'Frühstück 🥐';
    mockDecrypt.mockResolvedValueOnce(encodeBase64Utf8(value));
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('encrypted-session');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('stored-key');

    await expect(new LocalSupabaseSessionStorage().getItem('sb-token')).resolves.toBe(value);
    expect(mockDecrypt).toHaveBeenCalledWith('sealed-session', mockKey, { output: 'base64' });
  });

  it('reuses a loaded encryption key and retries after key generation fails', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('stored-key');
    const storage = new LocalSupabaseSessionStorage();

    await storage.setItem('sb-token-a', 'first');
    await storage.setItem('sb-token-b', 'second');
    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);

    const failingStorage = new LocalSupabaseSessionStorage();
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    mockGenerate.mockRejectedValueOnce(new Error('key generation failed'));
    await expect(failingStorage.setItem('sb-token-c', 'third')).rejects.toThrow(
      'key generation failed',
    );
    await expect(failingStorage.setItem('sb-token-c', 'third')).resolves.toBeUndefined();
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it('wraps decrypt errors and rejects non-string plaintext', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('encrypted-session');
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('stored-key');
    const decryptionError = new Error('authentication tag mismatch');
    mockDecrypt.mockRejectedValueOnce(decryptionError);

    await expect(new LocalSupabaseSessionStorage().getItem('sb-token')).rejects.toMatchObject({
      message: 'Die gespeicherte Supabase-Session konnte nicht entschlüsselt werden.',
      cause: decryptionError,
    });

    mockDecrypt.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    await expect(new LocalSupabaseSessionStorage().getItem('sb-token')).rejects.toThrow(
      'Die gespeicherte Supabase-Session konnte nicht entschlüsselt werden.',
    );
  });

  it('entfernt Session und Verschlüsselungsschlüssel beim Logout', async () => {
    await new LocalSupabaseSessionStorage().removeItem('sb-example-auth-token');

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('sb-example-auth-token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fam.supabase-auth.encryption-key.v1');
  });

  it('gibt keinen Klartext zurück, wenn der Verschlüsselungsschlüssel fehlt', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('encrypted-session');

    await expect(
      new LocalSupabaseSessionStorage().getItem('sb-example-auth-token'),
    ).resolves.toBeNull();
    expect(mockDecrypt).not.toHaveBeenCalled();
  });

  it('gibt null zurück, wenn im AsyncStorage kein Session-Eintrag vorhanden ist', async () => {
    await expect(new LocalSupabaseSessionStorage().getItem('sb-token')).resolves.toBeNull();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('lädt den Schlüssel nach dem Entfernen einer Session erneut', async () => {
    const storage = new LocalSupabaseSessionStorage();

    await storage.setItem('sb-token', 'first');
    await storage.removeItem('sb-token');
    await storage.setItem('sb-token', 'second');

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('sb-token');
  });
});
