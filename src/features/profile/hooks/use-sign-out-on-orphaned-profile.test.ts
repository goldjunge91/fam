import { act, renderHook, waitFor } from '@testing-library/react-native';

import { isOrphanedProfileError } from '@/features/profile/orphaned-profile-error';

const mockSignOutAndClearLocalData = jest.fn();
const mockReportError = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

jest.mock('@/features/auth/sign-out', () => ({
  signOutAndClearLocalData: (...args: unknown[]) => mockSignOutAndClearLocalData(...args),
}));
jest.mock('@/lib/telemetry', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

import { useSignOutOnOrphanedProfile } from '@/features/profile/hooks/use-sign-out-on-orphaned-profile';

describe('isOrphanedProfileError', () => {
  it('erkennt PGRST116', () => {
    expect(isOrphanedProfileError({ code: 'PGRST116' })).toBe(true);
  });

  it.each([
    ['ein anderer Postgrest-Code', { code: 'PGRST301' }],
    ['ein Postgres-SQLSTATE', { code: '42501' }],
    ['undefined', undefined],
    ['null', null],
    ['ein Error ohne code', new Error('Netzwerkfehler')],
    ['ein primitiver Wert', 'PGRST116'],
  ])('erkennt %s nicht als verwaiste Session', (_label, error) => {
    expect(isOrphanedProfileError(error)).toBe(false);
  });
});

describe('useSignOutOnOrphanedProfile', () => {
  beforeEach(() => {
    mockSignOutAndClearLocalData.mockReset();
    mockSignOutAndClearLocalData.mockResolvedValue({ error: null });
    mockReportError.mockReset();
  });

  it('meldet bei PGRST116 genau einmal ab', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    const queryClient = {} as any;
    const { rerender } = await renderHook(
      ({ error }: { error: unknown }) => useSignOutOnOrphanedProfile(error, queryClient),
      { initialProps: { error: { code: 'PGRST116' } as unknown } },
    );

    expect(mockSignOutAndClearLocalData).toHaveBeenCalledTimes(1);
    expect(mockSignOutAndClearLocalData).toHaveBeenCalledWith(queryClient);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Profil nicht vorhanden' }),
      { operation: 'profile.orphaned', error_code: 'profile_missing' },
    );

    // Bleibt der Fehler ueber weitere Re-Renders bestehen (z.B. weil die
    // Abmeldung noch laeuft), darf kein zweiter Aufruf ausgeloest werden.
    await rerender({ error: { code: 'PGRST116' } });
    expect(mockSignOutAndClearLocalData).toHaveBeenCalledTimes(1);
  });

  it('meldet bei anderen Fehlern nicht ab', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    const queryClient = {} as any;
    await renderHook(() => useSignOutOnOrphanedProfile(new Error('Netzwerkfehler'), queryClient));

    expect(mockSignOutAndClearLocalData).not.toHaveBeenCalled();
  });

  it('meldet ohne Fehler nicht ab', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    const queryClient = {} as any;
    await renderHook(() => useSignOutOnOrphanedProfile(null, queryClient));

    expect(mockSignOutAndClearLocalData).not.toHaveBeenCalled();
  });

  it('macht den Orphan-Logout nach einem zurückgegebenen Cleanup-Fehler retrybar', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    const queryClient = {} as any;
    const cleanup = deferred<{ error: Error | null }>();
    mockSignOutAndClearLocalData.mockImplementationOnce(() => cleanup.promise);

    const { rerender } = await renderHook(
      ({ error }: { error: unknown }) => useSignOutOnOrphanedProfile(error, queryClient),
      { initialProps: { error: { code: 'PGRST116' } as unknown } },
    );

    await act(async () => {
      cleanup.resolve({ error: new Error('raw user id user-secret') });
    });
    await waitFor(() => expect(mockReportError).toHaveBeenCalledTimes(2));

    expect(mockReportError).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'Profil-Abmeldung konnte nicht abgeschlossen werden' }),
      { operation: 'profile.orphaned.cleanup', error_code: 'profile_orphan_cleanup_failed' },
    );
    expect(JSON.stringify(mockReportError.mock.calls)).not.toContain('raw user id user-secret');

    await rerender({ error: { code: 'PGRST116' } });
    expect(mockSignOutAndClearLocalData).toHaveBeenCalledTimes(2);
  });

  it('behandelt ein abgelehntes Orphan-Logout-Promise ohne unhandled rejection', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test-Double, keine echte QueryClient-Instanz noetig
    const queryClient = {} as any;
    const cleanup = deferred<{ error: Error | null }>();
    const unhandledRejection = jest.fn();
    process.on('unhandledRejection', unhandledRejection);
    mockSignOutAndClearLocalData.mockImplementationOnce(() => cleanup.promise);

    try {
      await renderHook(() => useSignOutOnOrphanedProfile({ code: 'PGRST116' }, queryClient));

      await act(async () => {
        cleanup.reject(new Error('raw rejection with user-secret'));
      });
      await waitFor(() => expect(mockReportError).toHaveBeenCalledTimes(2));

      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(mockReportError).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: 'Profil-Abmeldung konnte nicht abgeschlossen werden' }),
        { operation: 'profile.orphaned.cleanup', error_code: 'profile_orphan_cleanup_failed' },
      );
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });
});
