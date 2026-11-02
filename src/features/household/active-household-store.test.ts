import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FAM_APP_GROUP, FAM_SIRI_CONTEXT_FILE } from '@/lib/apple/shared-app-group';
import { getStoredActiveHouseholdId, setStoredActiveHouseholdId } from './active-household-store';

const mockFile = {
  exists: false,
  text: jest.fn<Promise<string>, []>(),
  create: jest.fn(),
  write: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(() => mockFile),
  Paths: {
    appleSharedContainers: { 'group.com.goldjunge91.fam1': '/shared' },
  },
}));

const mockFileSystem = jest.requireMock('expo-file-system') as {
  File: jest.Mock;
  Paths: { appleSharedContainers: Record<string, string> };
};

describe('active household persistence', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockFile.exists = false;
    mockFile.text.mockReset();
    mockFile.create.mockReset();
    mockFile.write.mockReset();
    mockFile.delete.mockReset();
    mockFileSystem.File.mockClear();
    jest.mocked(AsyncStorage.getItem).mockReset();
    jest.mocked(AsyncStorage.setItem).mockReset();
    jest.mocked(AsyncStorage.removeItem).mockReset();
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('reads and writes the legacy value on Android', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('hh-android');

    await expect(getStoredActiveHouseholdId()).resolves.toBe('hh-android');
    await setStoredActiveHouseholdId('hh-next');
    await setStoredActiveHouseholdId(null);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@fam/active_household_id', 'hh-next');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@fam/active_household_id');
  });

  it('uses valid shared context on iOS and migrates the legacy value when it is absent', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockFile.exists = true;
    mockFile.text.mockResolvedValue(JSON.stringify({ activeHouseholdId: 'hh-shared' }));

    await expect(getStoredActiveHouseholdId()).resolves.toBe('hh-shared');

    mockFile.exists = false;
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('hh-legacy');
    await expect(getStoredActiveHouseholdId()).resolves.toBe('hh-legacy');
    expect(mockFile.create).toHaveBeenCalledWith({ overwrite: true });
    expect(mockFile.write).toHaveBeenCalledWith(JSON.stringify({ activeHouseholdId: 'hh-legacy' }));
  });

  it.each(['null', '[]', '{}', '{bad json'])(
    'ignores invalid shared context %s',
    async (content) => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      mockFile.exists = true;
      mockFile.text.mockResolvedValue(content);
      jest.mocked(AsyncStorage.getItem).mockResolvedValue('hh-fallback');

      await expect(getStoredActiveHouseholdId()).resolves.toBeNull();
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    },
  );

  it('removes an existing shared context and persists the clear to AsyncStorage', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockFile.exists = true;

    await setStoredActiveHouseholdId(null);

    expect(mockFile.delete).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@fam/active_household_id');
    expect(Object.keys(mockFileSystem.Paths.appleSharedContainers)).toContain(FAM_APP_GROUP);
    expect(mockFileSystem.File).toHaveBeenCalledWith('/shared', FAM_SIRI_CONTEXT_FILE);
  });

  it('falls back to AsyncStorage when shared-file writing or storage access fails', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockFile.create.mockImplementation(() => {
      throw new Error('App group unavailable');
    });
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('Storage unavailable'));
    await expect(setStoredActiveHouseholdId('hh-safe')).resolves.toBeUndefined();

    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('Storage unavailable'));
    await expect(getStoredActiveHouseholdId()).resolves.toBeNull();
  });
});
