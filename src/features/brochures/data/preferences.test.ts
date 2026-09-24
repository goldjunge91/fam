import type { MMKV } from 'react-native-mmkv';
import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import { getBrochurePostalCode, setBrochurePostalCode } from './preferences';

const mockValues = new Map<string, string>();
const mockStorage = {
  getString: jest.fn((key: string) => mockValues.get(key)),
  remove: jest.fn((key: string) => mockValues.delete(key)),
  set: jest.fn((key: string, value: string) => mockValues.set(key, value)),
} as unknown as MMKV;

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: jest.fn(),
}));

describe('account preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValues.clear();
    jest.mocked(getEncryptedAccountStorage).mockResolvedValue(mockStorage);
  });

  it('liest die Postleitzahl ausschließlich aus dem Speicher des angegebenen Nutzers', async () => {
    mockValues.set('brochures.postal-code', '22043');

    await expect(getBrochurePostalCode('user-a')).resolves.toBe('22043');
    expect(getEncryptedAccountStorage).toHaveBeenCalledWith('user-a');
  });

  it('entfernt ungültige gespeicherte Postleitzahlen', async () => {
    mockValues.set('brochures.postal-code', '1234');

    await expect(getBrochurePostalCode('user-a')).resolves.toBeNull();
    expect(mockStorage.remove).toHaveBeenCalledWith('brochures.postal-code');
  });

  it('weist ungültige Postleitzahlen vor einem Schreibzugriff zurück', async () => {
    await expect(setBrochurePostalCode('user-a', '12A45')).rejects.toThrow('genau fünf Ziffern');
    expect(getEncryptedAccountStorage).not.toHaveBeenCalled();
  });

  it('speichert eine gültige Postleitzahl im Account-Speicher', async () => {
    await setBrochurePostalCode('user-a', '10115');

    expect(mockStorage.set).toHaveBeenCalledWith('brochures.postal-code', '10115');
  });

  it('zeigt Nutzer B nach einem Wert von Nutzer A keine Postleitzahl von A', async () => {
    const valuesByUser = new Map<string, Map<string, string>>();
    jest.mocked(getEncryptedAccountStorage).mockImplementation(async (userId) => {
      const values = valuesByUser.get(userId) ?? new Map<string, string>();
      valuesByUser.set(userId, values);
      return {
        getString: (key: string) => values.get(key),
        set: (key: string, value: string) => values.set(key, value),
        remove: (key: string) => values.delete(key),
      } as unknown as MMKV;
    });

    await setBrochurePostalCode('user-a', '10115');

    await expect(getBrochurePostalCode('user-a')).resolves.toBe('10115');
    await expect(getBrochurePostalCode('user-b')).resolves.toBeNull();
  });
});
