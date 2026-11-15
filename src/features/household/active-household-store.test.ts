import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FAM_APP_GROUP, FAM_SIRI_CONTEXT_FILE } from '@/lib/apple/shared-app-group';
import { getStoredActiveHouseholdId, setStoredActiveHouseholdId } from './active-household-store';

const mockFile = {
  uri: '/shared/fam-siri-context-v1.json',
  name: FAM_SIRI_CONTEXT_FILE,
  parentDirectory: '/shared',
  exists: false,
  text: jest.fn<Promise<string>, []>(),
  create: jest.fn(),
  write: jest.fn(),
  moveSync: jest.fn(),
  delete: jest.fn(),
};
const mockTemporaryFile = {
  uri: '/shared/.fam-siri-context-v1.json.1.tmp',
  name: '.fam-siri-context-v1.json.1.tmp',
  parentDirectory: '/shared',
  exists: false,
  create: jest.fn(),
  write: jest.fn(),
  moveSync: jest.fn(),
  delete: jest.fn(),
};
const mockBeginWriterLease = jest.fn();
const mockLeaseEnd = jest.fn();

jest.mock('@/lib/apple/shared-store-lifecycle', () => ({
  sharedStoreWriterOwner: {
    beginWriterLease: (...args: unknown[]) => mockBeginWriterLease(...args),
  },
  withSharedStoreWriterSync: (
    owner: { beginWriterLease: (name: string) => ReturnType<typeof createWriterLease> | null },
    name: string,
    operation: (lease: ReturnType<typeof createWriterLease>) => unknown,
  ) => {
    const lease = owner.beginWriterLease(name);
    if (!lease) throw new Error('writer unavailable');
    try {
      return operation(lease);
    } finally {
      lease.end();
    }
  },
}));

function createWriterLease() {
  return {
    signal: new AbortController().signal,
    ended: false,
    end: mockLeaseEnd,
  };
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn((...args: unknown[]) =>
    args.includes('fam-siri-context-v1.json') ? mockFile : mockTemporaryFile,
  ),
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
    mockFile.moveSync.mockReset();
    mockFile.delete.mockReset();
    mockTemporaryFile.exists = false;
    mockTemporaryFile.create.mockReset();
    mockTemporaryFile.write.mockReset();
    mockTemporaryFile.moveSync.mockReset();
    mockTemporaryFile.delete.mockReset();
    mockFileSystem.File.mockClear();
    jest.mocked(AsyncStorage.getItem).mockReset();
    jest.mocked(AsyncStorage.setItem).mockReset();
    jest.mocked(AsyncStorage.removeItem).mockReset();
    mockBeginWriterLease.mockReset().mockImplementation(() => createWriterLease());
    mockLeaseEnd.mockReset();
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
    expect(mockTemporaryFile.create).toHaveBeenCalledWith({ overwrite: true });
    expect(mockTemporaryFile.write).toHaveBeenCalledWith(
      JSON.stringify({ activeHouseholdId: 'hh-legacy' }),
    );
    expect(mockTemporaryFile.moveSync).toHaveBeenCalledWith(mockFile, { overwrite: true });
    expect(mockFile.moveSync).not.toHaveBeenCalled();
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
    expect(mockLeaseEnd).toHaveBeenCalledTimes(1);
    expect(mockBeginWriterLease).toHaveBeenCalledWith('active-household.context');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@fam/active_household_id');
    expect(Object.keys(mockFileSystem.Paths.appleSharedContainers)).toContain(FAM_APP_GROUP);
    expect(mockFileSystem.File).toHaveBeenCalledWith('/shared', FAM_SIRI_CONTEXT_FILE);
  });

  it('behält den privaten Fallback, wenn die Shared-Writer-Zusage nicht verfügbar ist', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockBeginWriterLease.mockReturnValueOnce(null);

    await setStoredActiveHouseholdId('hh-safe');

    expect(mockFile.write).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@fam/active_household_id', 'hh-safe');
    expect(mockLeaseEnd).not.toHaveBeenCalled();
  });

  it('beendet die Shared-Writer-Zusage auch bei einem fehlerhaften JSON-Write', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockTemporaryFile.create.mockImplementation(() => {
      throw new Error('App group unavailable');
    });

    await setStoredActiveHouseholdId('hh-fallback');

    expect(mockLeaseEnd).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@fam/active_household_id', 'hh-fallback');
  });

  it('falls back to AsyncStorage when shared-file writing or storage access fails', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockTemporaryFile.create.mockImplementation(() => {
      throw new Error('App group unavailable');
    });
    jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('Storage unavailable'));
    await expect(setStoredActiveHouseholdId('hh-safe')).resolves.toBeUndefined();

    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('Storage unavailable'));
    await expect(getStoredActiveHouseholdId()).resolves.toBeNull();
  });
});
