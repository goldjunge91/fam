import type { QueryClient } from '@tanstack/react-query';
import { OutboxWriteProducerActiveError } from '@/lib/db/outbox';

import {
  clearLocalAccountData,
  signOutAndClearLocalData,
  UnsyncedLocalWritesError,
} from './sign-out';

const mockSignOut = jest.fn();
const mockDeleteLocalDatabase = jest.fn();
const mockSetStoredActiveHouseholdId = jest.fn();
const mockDeleteEncryptedAccountStorage = jest.fn();
const mockForgetLocalAccountUserId = jest.fn();
const mockGetRememberedLocalAccountUserId = jest.fn();
const mockStopAccountSyncAndWait = jest.fn();
const mockResetLocalAccountModuleCaches = jest.fn();
const mockGetSession = jest.fn();
const mockGetDatabase = jest.fn();
const mockLocalSignOut = jest.fn();
const mockCancelUserNotificationReminders = jest.fn();
const mockSetActiveUserId = jest.fn();
const mockAcquireOutboxSignOutGuard = jest.fn();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

jest.mock('@/features/auth/api', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

jest.mock('@/features/household/active-household-store', () => ({
  setStoredActiveHouseholdId: (...args: unknown[]) => mockSetStoredActiveHouseholdId(...args),
}));

jest.mock('@/lib/db/local-client', () => ({
  deleteLocalDatabase: (...args: unknown[]) => mockDeleteLocalDatabase(...args),
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
  setActiveUserId: (...args: unknown[]) => mockSetActiveUserId(...args),
}));

jest.mock('@/lib/db/outbox', () => {
  const actual = jest.requireActual<typeof import('@/lib/db/outbox')>('@/lib/db/outbox');
  return {
    ...actual,
    acquireOutboxSignOutGuard: (...args: unknown[]) => mockAcquireOutboxSignOutGuard(...args),
  };
});

jest.mock('@/lib/storage/local-account-storage', () => ({
  deleteEncryptedAccountStorage: (...args: unknown[]) => mockDeleteEncryptedAccountStorage(...args),
  forgetLocalAccountUserId: (...args: unknown[]) => mockForgetLocalAccountUserId(...args),
  getRememberedLocalAccountUserId: (...args: unknown[]) =>
    mockGetRememberedLocalAccountUserId(...args),
}));

jest.mock('@/lib/platform/notifications', () => ({
  cancelUserNotificationReminders: (...args: unknown[]) =>
    mockCancelUserNotificationReminders(...args),
}));

jest.mock('@/lib/sync/remote-sync-gate', () => ({
  stopAccountSyncAndWait: (...args: unknown[]) => mockStopAccountSyncAndWait(...args),
}));

jest.mock('@/lib/storage/local-account-cache-registry', () => ({
  resetLocalAccountModuleCaches: (...args: unknown[]) => mockResetLocalAccountModuleCaches(...args),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
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
    isMutating: jest.fn().mockReturnValue(0),
  } as unknown as QueryClient;
}

function outboxGuard(
  overrides: { pendingCount?: number; failedCount?: number; queuedWriteCount?: number } = {},
) {
  return {
    pendingCount: overrides.pendingCount ?? 0,
    failedCount: overrides.failedCount ?? 0,
    queuedWriteCount: overrides.queuedWriteCount ?? 0,
    release: jest.fn(),
  };
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
    mockGetDatabase.mockResolvedValue({});
    mockAcquireOutboxSignOutGuard.mockReset();
    mockSetActiveUserId.mockReset();
    mockStopAccountSyncAndWait.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });
    mockLocalSignOut.mockResolvedValue({ error: null });
    mockCancelUserNotificationReminders.mockResolvedValue(undefined);
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
    expect(mockDeleteLocalDatabase).toHaveBeenCalledTimes(1);
    expect(mockDeleteEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
    expect(mockForgetLocalAccountUserId).toHaveBeenCalledWith('user-1');
    expect(mockResetLocalAccountModuleCaches).toHaveBeenCalledWith('user-1');
    expect(mockSetStoredActiveHouseholdId).toHaveBeenCalledWith(null);

    const order = [
      jest.mocked(client.cancelQueries).mock.invocationCallOrder[0],
      mockStopAccountSyncAndWait.mock.invocationCallOrder[0],
      jest.mocked(client.clear).mock.invocationCallOrder[0],
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

  it('entfernt beim Account-Cleanup die privaten Erinnerungen des Nutzers', async () => {
    await clearLocalAccountData(queryClient(), 'user-1');

    expect(mockCancelUserNotificationReminders).toHaveBeenCalledWith('user-1');
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

  it('verhindert die Abmeldung bei offenen und fehlgeschlagenen lokalen Schreibvorgängen', async () => {
    const guard = outboxGuard({ pendingCount: 2, failedCount: 1 });
    mockAcquireOutboxSignOutGuard.mockResolvedValue(guard);

    const result = await signOutAndClearLocalData(queryClient(), {
      protectUnsyncedWrites: true,
    });

    expect(result.error).toBeInstanceOf(UnsyncedLocalWritesError);
    expect(result.error).toMatchObject({ pendingCount: 2, failedCount: 1 });
    expect(guard.release).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockDeleteLocalDatabase).not.toHaveBeenCalled();
  });

  it('berücksichtigt laufende React-Query-Mutationen beim Abmeldeschutz', async () => {
    const guard = outboxGuard();
    mockAcquireOutboxSignOutGuard.mockResolvedValue(guard);
    const client = queryClient();
    jest.mocked(client.isMutating).mockReturnValue(3);

    const result = await signOutAndClearLocalData(client, { protectUnsyncedWrites: true });

    expect(result.error).toMatchObject({ pendingCount: 3, failedCount: 0 });
    expect(guard.release).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('berücksichtigt bereits wartende Outbox-Schreibvorgänge beim Abmeldeschutz', async () => {
    const guard = outboxGuard({ queuedWriteCount: 1 });
    mockAcquireOutboxSignOutGuard.mockResolvedValue(guard);

    const result = await signOutAndClearLocalData(queryClient(), { protectUnsyncedWrites: true });

    expect(result.error).toMatchObject({ pendingCount: 1, failedCount: 0 });
    expect(guard.release).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('gibt den Outbox-Schutz nach erfolgreicher Abmeldung frei', async () => {
    const guard = outboxGuard();
    mockAcquireOutboxSignOutGuard.mockResolvedValue(guard);

    await expect(
      signOutAndClearLocalData(queryClient(), { protectUnsyncedWrites: true }),
    ).resolves.toEqual({ error: null });

    expect(mockSetActiveUserId).toHaveBeenCalledWith(null);
    expect(guard.release).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('übersetzt einen aktiven Outbox-Produzenten in einen Abmeldeschutzfehler', async () => {
    mockAcquireOutboxSignOutGuard.mockRejectedValue(new OutboxWriteProducerActiveError(2));

    const result = await signOutAndClearLocalData(queryClient(), { protectUnsyncedWrites: true });

    expect(result.error).toMatchObject({ pendingCount: 2, failedCount: 0 });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('gibt einen nicht-Error-Wert aus dem Datenbankzugriff als Error zurück', async () => {
    mockGetDatabase.mockRejectedValue('database unavailable');

    const result = await signOutAndClearLocalData(queryClient(), { protectUnsyncedWrites: true });

    expect(result.error).toEqual(new Error('database unavailable'));
    expect(mockAcquireOutboxSignOutGuard).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('schützt keine Abmeldung ohne ermittelten lokalen Account', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const client = queryClient();

    await expect(
      signOutAndClearLocalData(client, { protectUnsyncedWrites: true }),
    ).resolves.toEqual({ error: null });

    expect(mockAcquireOutboxSignOutGuard).not.toHaveBeenCalled();
    expect(client.clear).not.toHaveBeenCalled();
  });

  it('teilt den Account-Cleanup zwischen parallelen Logout-Aufrufen', async () => {
    let resolveCleanupStarted: (() => void) | undefined;
    let finishCleanup: (() => void) | undefined;
    const cleanupStarted = new Promise<void>((resolve) => {
      resolveCleanupStarted = resolve;
    });
    mockStopAccountSyncAndWait.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCleanup = resolve;
          resolveCleanupStarted?.();
        }),
    );
    const client = queryClient();

    const firstLogout = signOutAndClearLocalData(client);
    await cleanupStarted;
    const secondLogout = signOutAndClearLocalData(client);
    finishCleanup?.();

    await expect(Promise.all([firstLogout, secondLogout])).resolves.toEqual([
      { error: null },
      { error: null },
    ]);
    expect(mockDeleteLocalDatabase).toHaveBeenCalledTimes(1);
    expect(mockDeleteEncryptedAccountStorage).toHaveBeenCalledTimes(1);
    expect(mockForgetLocalAccountUserId).toHaveBeenCalledTimes(1);
  });
});
