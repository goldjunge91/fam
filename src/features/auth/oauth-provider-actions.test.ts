const mockSignInWithOAuth = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockSetSession = jest.fn();

jest.mock('@/lib/backend/supabase/client', () => ({
  getSupabase: () => ({
    auth: {
      setSession: mockSetSession,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

jest.mock('expo-linking', () => ({
  createURL: () => 'fam:///sign-in',
}));

jest.mock('expo-web-browser', () => ({
  __esModule: true,
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

import { AUTH_ERROR_KEYS } from '@/features/auth/domain/auth-error-message';
import { signInWithOAuthProvider } from '@/features/auth/oauth-provider-actions';

describe('provider auth', () => {
  it('öffnet die von Supabase gelieferte OAuth-URL in einer nativen Browser-Session', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.example.com/oauth' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'fam:///sign-in#access_token=abc123&refresh_token=def456',
    });
    mockSetSession.mockResolvedValue({ error: null });

    await signInWithOAuthProvider('google');

    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.example.com/oauth',
      'fam:///sign-in',
    );
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'abc123',
      refresh_token: 'def456',
    });
  });

  it('liefert einen stabilen Fehler-Key, wenn keine OAuth-URL vorhanden ist', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

    const result = await signInWithOAuthProvider('google');

    expect(result.error?.message).toBe(AUTH_ERROR_KEYS.redirectUrlMissing);
  });

  it('liefert einen stabilen Fehler-Key bei ungültigem OAuth-Callback', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.example.com/oauth' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'fam:///other-route#access_token=abc123&refresh_token=def456',
    });

    const result = await signInWithOAuthProvider('google');

    expect(result.error?.message).toBe(AUTH_ERROR_KEYS.callbackInvalid);
  });
});
