import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { SessionProvider, useSession } from '@/features/auth/session-provider';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockClearLocalAccountData = jest.fn();
const mockGetRememberedLocalAccountUserId = jest.fn();
const mockRememberLocalAccountUserId = jest.fn();
const mockActivateEncryptedAccountStorage = jest.fn();
const mockMigrateLegacyAccountData = jest.fn();
const mockResumeAccountSync = jest.fn();
const mockSetActiveUserId = jest.fn();
const mockStartAccountQueryPersistence = jest.fn();
let authStateCallback: ((event: string, session: { user: { id: string } } | null) => void) | null =
  null;

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  }),
  startSupabaseAutoRefresh: jest.fn(() => () => {}),
}));

jest.mock('@/lib/db/client', () => ({
  setActiveUserId: (...args: unknown[]) => mockSetActiveUserId(...args),
}));

jest.mock('@/lib/query-client', () => ({
  queryClient: {},
  startAccountQueryPersistence: (...args: unknown[]) => mockStartAccountQueryPersistence(...args),
}));

jest.mock('@/features/auth/sign-out', () => ({
  clearLocalAccountData: (...args: unknown[]) => mockClearLocalAccountData(...args),
}));

jest.mock('@/features/auth/migrations/legacy-account-data', () => ({
  migrateLegacyAccountData: (...args: unknown[]) => mockMigrateLegacyAccountData(...args),
}));

jest.mock('@/lib/storage/account-storage', () => ({
  activateEncryptedAccountStorage: (...args: unknown[]) =>
    mockActivateEncryptedAccountStorage(...args),
  getRememberedLocalAccountUserId: (...args: unknown[]) =>
    mockGetRememberedLocalAccountUserId(...args),
  rememberLocalAccountUserId: (...args: unknown[]) => mockRememberLocalAccountUserId(...args),
}));

jest.mock('@/lib/sync/account-sync-gate', () => ({
  resumeAccountSync: (...args: unknown[]) => mockResumeAccountSync(...args),
}));

jest.mock('@/features/onboarding/onboarding-completion', () => ({
  hasSeenOnboarding: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/telemetry', () => ({
  addDiagnosticStep: jest.fn(),
  measureOperation: (_name: string, operation: () => Promise<unknown>) => operation(),
  reportError: jest.fn(),
  setTelemetryUserId: jest.fn(),
}));

describe('SessionProvider', () => {
  function wrapper({ children }: { children: React.ReactNode }) {
    return <SessionProvider>{children}</SessionProvider>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockClearLocalAccountData.mockResolvedValue(undefined);
    mockGetRememberedLocalAccountUserId.mockResolvedValue(null);
    mockRememberLocalAccountUserId.mockResolvedValue(undefined);
    mockMigrateLegacyAccountData.mockResolvedValue(undefined);
    mockStartAccountQueryPersistence.mockResolvedValue(jest.fn());
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
  });

  it('lädt die initiale Session und setzt isLoading auf false', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { id: 'user-1', email: 'test@fam.app' } },
      },
      error: null,
    });

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.session?.user.id).toBe('user-1');
    expect(result.current.seenOnboarding).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockMigrateLegacyAccountData).toHaveBeenCalledWith('user-1');
    expect(mockSetActiveUserId).toHaveBeenCalledWith('user-1');
    expect(mockSetActiveUserId.mock.invocationCallOrder[0]).toBeLessThan(
      mockMigrateLegacyAccountData.mock.invocationCallOrder[0],
    );
    expect(mockActivateEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
    expect(mockRememberLocalAccountUserId).toHaveBeenCalledWith('user-1');
  });

  it('bereinigt lokale Daten vor einem direkten Nutzerwechsel', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session?.user.id).toBe('user-1'));

    await act(async () => {
      authStateCallback?.('SIGNED_IN', { user: { id: 'user-2' } });
    });

    await waitFor(() => expect(mockClearLocalAccountData).toHaveBeenCalled());
    expect(mockClearLocalAccountData).toHaveBeenCalledWith({}, 'user-1');
    await waitFor(() => expect(result.current.session?.user.id).toBe('user-2'));
    expect(mockRememberLocalAccountUserId).toHaveBeenCalledWith('user-2');
  });

  it('bereinigt Nutzer A bei SIGNED_OUT bevor Nutzer B aktiviert wird', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-a' } } },
      error: null,
    });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session?.user.id).toBe('user-a'));

    await act(async () => {
      authStateCallback?.('SIGNED_OUT', null);
    });
    await waitFor(() => expect(result.current.session).toBeNull());
    expect(mockClearLocalAccountData).toHaveBeenCalledWith({}, 'user-a');

    await act(async () => {
      authStateCallback?.('SIGNED_IN', { user: { id: 'user-b' } });
    });
    await waitFor(() => expect(result.current.session?.user.id).toBe('user-b'));

    expect(mockMigrateLegacyAccountData).toHaveBeenCalledTimes(1);
    expect(mockMigrateLegacyAccountData).not.toHaveBeenCalledWith('user-b');
    expect(mockRememberLocalAccountUserId).toHaveBeenLastCalledWith('user-b');
  });

  it('überschreibt ein frühes SIGNED_OUT-Event nicht mit einem veralteten Session-Snapshot', async () => {
    let resolveSession: ((value: unknown) => void) | undefined;
    mockGetSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    const { result } = await renderHook(() => useSession(), { wrapper });

    await act(async () => {
      authStateCallback?.('SIGNED_OUT', null);
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSession?.({
        data: { session: { user: { id: 'stale-user' } } },
        error: null,
      });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(mockClearLocalAccountData).toHaveBeenCalledWith({}, 'stale-user');
    expect(mockMigrateLegacyAccountData).toHaveBeenCalledWith(null);
    expect(mockActivateEncryptedAccountStorage).not.toHaveBeenCalledWith('stale-user');
    expect(mockRememberLocalAccountUserId).not.toHaveBeenCalledWith('stale-user');
  });

  it('ordnet Legacy-Daten keinem stale Session-Nutzer vor einem frühen Nutzerwechsel zu', async () => {
    let resolveSession: ((value: unknown) => void) | undefined;
    mockGetSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    const { result } = await renderHook(() => useSession(), { wrapper });

    await act(async () => {
      authStateCallback?.('SIGNED_IN', { user: { id: 'user-b' } });
      resolveSession?.({ data: { session: { user: { id: 'stale-user-a' } } }, error: null });
    });

    await waitFor(() => expect(result.current.session?.user.id).toBe('user-b'));
    expect(mockClearLocalAccountData).toHaveBeenCalledWith({}, 'stale-user-a');
    expect(mockMigrateLegacyAccountData).toHaveBeenCalledWith(null);
    expect(mockMigrateLegacyAccountData).not.toHaveBeenCalledWith('stale-user-a');
    expect(mockRememberLocalAccountUserId).toHaveBeenLastCalledWith('user-b');
  });

  it('aktiviert Nutzer B nicht wenn der fail-closed Cleanup von Nutzer A fehlschlägt', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-a' } } },
      error: null,
    });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.session?.user.id).toBe('user-a'));
    mockClearLocalAccountData.mockRejectedValueOnce(new Error('wipe failed'));

    await act(async () => {
      authStateCallback?.('SIGNED_IN', { user: { id: 'user-b' } });
    });

    await waitFor(() => expect(result.current.error?.message).toBe('wipe failed'));
    expect(result.current.session).toBeNull();
    expect(mockActivateEncryptedAccountStorage).not.toHaveBeenCalledWith('user-b');
    expect(mockRememberLocalAccountUserId).not.toHaveBeenCalledWith('user-b');
  });

  it('verwirft Legacy-Daten und bereinigt einen verwaisten lokalen Account ohne Session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockGetRememberedLocalAccountUserId.mockResolvedValue('orphan-user');

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockClearLocalAccountData).toHaveBeenCalledWith({}, 'orphan-user');
    expect(mockMigrateLegacyAccountData).toHaveBeenCalledWith(null);
    expect(result.current.session).toBeNull();
  });

  it('bleibt ohne Session fail-closed, wenn globale Legacy-Daten nicht gelöscht werden können', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockMigrateLegacyAccountData.mockRejectedValueOnce(new Error('legacy purge failed'));

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.error?.message).toBe('legacy purge failed'));
    expect(result.current.session).toBeNull();
    expect(mockSetActiveUserId).toHaveBeenLastCalledWith(null);
    expect(mockResumeAccountSync).not.toHaveBeenCalled();
  });
});
