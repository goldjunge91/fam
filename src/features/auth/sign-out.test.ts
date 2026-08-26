import type { QueryClient } from '@tanstack/react-query';

import { clearLocalAccountData, signOutAndClearLocalData } from './sign-out';

const mockSignOut = jest.fn();
const mockDeleteLocalDatabase = jest.fn();
const mockSetStoredActiveHouseholdId = jest.fn();
const mockDeleteEncryptedAccountStorage = jest.fn();
const mockForgetLocalAccountUserId = jest.fn();
const mockGetRememberedLocalAccountUserId = jest.fn();
const mockRemoveLegacyPersistedQueryCache = jest.fn();
const mockStopAccountSyncAndWait = jest.fn();
const mockResetLocalAccountModuleCaches = jest.fn();
const mockGetSession = jest.fn();
const mockLocalSignOut = jest.fn();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

jest.mock('@/features/auth/api', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock('@/features/household/active-household-store', () => ({
  setStoredActiveHouseholdId: (...args: unknown[]) => mockSetStoredActiveHouseholdId(...args),
}));

jest.mock('@/lib/db/client', () => ({
  deleteLocalDatabase: (...args: unknown[]) => mockDeleteLocalDatabase(...args),
  setActiveUserId: jest.fn(),
}));

jest.mock('@/lib/storage/account-storage', () => ({
  deleteEncryptedAccountStorage: (...args: unknown[]) => mockDeleteEncryptedAccountStorage(...args),
  forgetLocalAccountUserId: (...args: unknown[]) => mockForgetLocalAccountUserId(...args),
  getRememberedLocalAccountUserId: (...args: unknown[]) =>
    mockGetRememberedLocalAccountUserId(...args),
}));

jest.mock('@/lib/query-client', () => ({
  removeLegacyPersistedQueryCache: (...args: unknown[]) =>
    mockRemoveLegacyPersistedQueryCache(...args),
}));

jest.mock('@/lib/sync/account-sync-gate', () => ({
  stopAccountSyncAndWait: (...args: unknown[]) => mockStopAccountSyncAndWait(...args),
}));

jest.mock('./local-account-cache', () => ({
  resetLocalAccountModuleCaches: (...args: unknown[]) => mockResetLocalAccountModuleCaches(...args),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signOut: (...args: unknown[]) => mockLocalSignOut(...args),
    },
  }),
}));

function queryClient(): QueryClient {
  return {
    cancelQueries: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
  } as unknown as QueryClient;
}

describe('lokaler Account-Cleanup', () => {
  afterAll(() => {
    mockConsoleWarn.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteLocalDatabase.mockResolvedValue(undefined);
    mockSetStoredActiveHouseholdId.mockResolvedValue(undefined);
    mockDeleteEncryptedAccountStorage.mockResolvedValue(undefined);
    mockForgetLocalAccountUserId.mockResolvedValue(undefined);
    mockGetRememberedLocalAccountUserId.mockResolvedValue(null);
    mockRemoveLegacyPersistedQueryCache.mockResolvedValue(undefined);
    mockStopAccountSyncAndWait.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });
    mockLocalSignOut.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
  });

  it('stoppt Arbeit und entfernt Query-, SQLite-, Account-, Cache- und Haushaltsdaten', async () => {
    const client = queryClient();

    await clearLocalAccountData(client, 'user-1');

    expect(client.cancelQueries).toHaveBeenCalledTimes(1);
    expect(mockStopAccountSyncAndWait).toHaveBeenCalledTimes(1);
    expect(client.clear).toHaveBeenCalledTimes(1);
    expect(mockRemoveLegacyPersistedQueryCache).toHaveBeenCalledTimes(1);
    expect(mockDeleteLocalDatabase).toHaveBeenCalledTimes(1);
    expect(mockDeleteEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
    expect(mockForgetLocalAccountUserId).toHaveBeenCalledWith('user-1');
    expect(mockResetLocalAccountModuleCaches).toHaveBeenCalledWith('user-1');
    expect(mockSetStoredActiveHouseholdId).toHaveBeenCalledWith(null);

    const order = [
      jest.mocked(client.cancelQueries).mock.invocationCallOrder[0],
      mockStopAccountSyncAndWait.mock.invocationCallOrder[0],
      jest.mocked(client.clear).mock.invocationCallOrder[0],
      mockRemoveLegacyPersistedQueryCache.mock.invocationCallOrder[0],
      mockDeleteLocalDatabase.mock.invocationCallOrder[0],
      mockDeleteEncryptedAccountStorage.mock.invocationCallOrder[0],
      mockResetLocalAccountModuleCaches.mock.invocationCallOrder[0],
      mockSetStoredActiveHouseholdId.mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((left, right) => left - right));
  });

  it('bereinigt erst nach einem erfolgreichen Logout', async () => {
    const client = queryClient();

    await expect(signOutAndClearLocalData(client)).resolves.toEqual({ error: null });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockDeleteEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
  });

  it('setzt den Cleanup fort wenn das Leeren des Query-Caches fehlschlägt', async () => {
    const client = queryClient();
    jest.mocked(client.clear).mockImplementationOnce(() => {
      throw new Error('query failed');
    });

    await clearLocalAccountData(client, 'user-1');

    expect(mockDeleteLocalDatabase).toHaveBeenCalledTimes(1);
    expect(mockDeleteEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
  });

  it('entfernt die lokale Session und Accountdaten auch bei einem Server-Netzwerkfehler', async () => {
    const client = queryClient();
    const error = new Error('offline');
    mockSignOut.mockResolvedValue({ error });

    await expect(signOutAndClearLocalData(client)).resolves.toEqual({ error: null });

    expect(client.clear).toHaveBeenCalledTimes(1);
    expect(mockDeleteLocalDatabase).toHaveBeenCalledTimes(1);
    expect(mockDeleteEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
  });

  it('erzwingt bei einem geworfenen globalen Logoutfehler den lokalen Auth-Scope', async () => {
    const client = queryClient();
    mockSignOut.mockRejectedValue(new Error('transport threw'));

    await expect(signOutAndClearLocalData(client)).resolves.toEqual({ error: null });

    expect(mockLocalSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockDeleteEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
  });

  it('behält Besitzer und Account-MMKV wenn der essentielle DB-Wipe fehlschlägt', async () => {
    const client = queryClient();
    mockDeleteLocalDatabase.mockRejectedValue(new Error('db remains'));

    await expect(clearLocalAccountData(client, 'user-1')).rejects.toThrow('db remains');

    expect(client.clear).toHaveBeenCalledTimes(1);
    expect(mockResetLocalAccountModuleCaches).toHaveBeenCalledWith('user-1');
    expect(mockDeleteEncryptedAccountStorage).not.toHaveBeenCalled();
    expect(mockForgetLocalAccountUserId).not.toHaveBeenCalled();
  });

  it('behält den Besitzer-Marker wenn der essentielle MMKV-Wipe fehlschlägt', async () => {
    const client = queryClient();
    mockDeleteEncryptedAccountStorage.mockRejectedValue(new Error('mmkv remains'));

    await expect(clearLocalAccountData(client, 'user-1')).rejects.toThrow('mmkv remains');

    expect(mockDeleteLocalDatabase).toHaveBeenCalledTimes(1);
    expect(mockForgetLocalAccountUserId).not.toHaveBeenCalled();
    expect(mockResetLocalAccountModuleCaches).toHaveBeenCalledWith('user-1');
  });

  it('blockiert den Wipe wenn ein Sync-Stopper fehlschlägt', async () => {
    const client = queryClient();
    mockStopAccountSyncAndWait.mockRejectedValue(new Error('sync still active'));

    await expect(clearLocalAccountData(client, 'user-1')).rejects.toThrow('sync still active');

    expect(client.clear).toHaveBeenCalledTimes(1);
    expect(mockResetLocalAccountModuleCaches).toHaveBeenCalledWith('user-1');
    expect(mockDeleteLocalDatabase).not.toHaveBeenCalled();
    expect(mockForgetLocalAccountUserId).not.toHaveBeenCalled();
  });

  it('bereinigt bei einer verwaisten Session den gemerkten lokalen Account', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockGetRememberedLocalAccountUserId.mockResolvedValue('orphan-user');
    const client = queryClient();

    await expect(signOutAndClearLocalData(client)).resolves.toEqual({ error: null });

    expect(mockDeleteEncryptedAccountStorage).toHaveBeenCalledWith('orphan-user');
  });
});
