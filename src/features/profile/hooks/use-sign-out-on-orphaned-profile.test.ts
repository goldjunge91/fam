import { renderHook } from '@testing-library/react-native';

import { isOrphanedProfileError } from '@/features/profile/orphaned-profile-error';

const mockSignOutAndClearLocalData = jest.fn();

jest.mock('@/features/auth/sign-out', () => ({
  signOutAndClearLocalData: (...args: unknown[]) => mockSignOutAndClearLocalData(...args),
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
});
