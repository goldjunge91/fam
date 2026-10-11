import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import {
  getBrochurePostalCode,
  getBrochurePostalCodeSource,
  markBrochurePostalCodeAsDeviceLocation,
  setBrochurePostalCode,
} from './preferences';

const mockStorage = {
  getString: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
};

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: jest.fn(),
}));

describe('brochure postal-code preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getEncryptedAccountStorage).mockResolvedValue(mockStorage as never);
  });

  test('returns valid postal codes and removes malformed stored values', async () => {
    mockStorage.getString.mockReturnValueOnce('10115').mockReturnValueOnce('10A15');

    await expect(getBrochurePostalCode('user-1')).resolves.toBe('10115');
    await expect(getBrochurePostalCode('user-1')).resolves.toBeNull();
    expect(mockStorage.remove).toHaveBeenCalledWith('brochures.postal-code');
  });

  test('returns recognized sources and treats unknown values as missing', async () => {
    mockStorage.getString
      .mockReturnValueOnce('manual')
      .mockReturnValueOnce('gps')
      .mockReturnValueOnce('other');

    await expect(getBrochurePostalCodeSource('user-1')).resolves.toBe('manual');
    await expect(getBrochurePostalCodeSource('user-1')).resolves.toBe('gps');
    await expect(getBrochurePostalCodeSource('user-1')).resolves.toBeNull();
  });

  test('validates before storage and records the selected source', async () => {
    await expect(setBrochurePostalCode('user-1', '1011')).rejects.toThrow(/fünf Ziffern/);
    expect(getEncryptedAccountStorage).not.toHaveBeenCalled();

    await setBrochurePostalCode('user-1', '10115');
    await setBrochurePostalCode('user-1', '80331', 'manual');
    expect(mockStorage.set).toHaveBeenNthCalledWith(1, 'brochures.postal-code', '10115');
    expect(mockStorage.set).toHaveBeenNthCalledWith(2, 'brochures.postal-code-source', 'gps');
    expect(mockStorage.set).toHaveBeenNthCalledWith(4, 'brochures.postal-code-source', 'manual');
  });

  test('marks the current postal code as coming from device location', async () => {
    await markBrochurePostalCodeAsDeviceLocation('user-1');

    expect(mockStorage.set).toHaveBeenCalledWith('brochures.postal-code-source', 'gps');
  });
});
