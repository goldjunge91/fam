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
});
