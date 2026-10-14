const mockSignInWithOAuth = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockSetSession = jest.fn();
const mockSignInWithApple = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockRandomUUID = jest.fn();
const mockReportError = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({
    auth: {
      setSession: mockSetSession,
      signInWithOAuth: mockSignInWithOAuth,
      signInWithIdToken: mockSignInWithIdToken,
    },
  }),
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: (...args: unknown[]) => mockSignInWithApple(...args),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
  randomUUID: () => mockRandomUUID(),
}));

jest.mock('@/lib/telemetry', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock('expo-linking', () => ({
  createURL: () => 'fam:///sign-in',
}));

jest.mock('expo-web-browser', () => ({
  __esModule: true,
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

import { AUTH_ERROR_KEYS } from '@/features/auth/domain/auth-error-message';
import { signInWithApple, signInWithOAuthProvider } from '@/features/auth/oauth-provider-actions';

describe('provider auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetSession.mockResolvedValue({ error: null });
    mockDigestStringAsync.mockResolvedValue('hashed-nonce');
    mockRandomUUID.mockReturnValue('raw-nonce');
  });

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

  it('returns Supabase OAuth errors without opening a browser', async () => {
    const error = new Error('OAuth setup failed');
    const data = { url: null };
    mockSignInWithOAuth.mockResolvedValue({ data, error });

    await expect(signInWithOAuthProvider('google')).resolves.toEqual({ data, error });
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('treats an OAuth browser dismissal as a non-error result', async () => {
    const data = { url: 'https://accounts.example.com/oauth' };
    mockSignInWithOAuth.mockResolvedValue({ data, error: null });
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' });

    await expect(signInWithOAuthProvider('google')).resolves.toEqual({ data, error: null });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('reports and returns a session error after a valid OAuth callback', async () => {
    const error = Object.assign(new Error('session rejected'), { code: 'session_failed' });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.example.com/oauth' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'fam:///sign-in#access_token=abc123&refresh_token=def456',
    });
    mockSetSession.mockResolvedValue({ error });

    await expect(signInWithOAuthProvider('apple')).resolves.toEqual({
      data: { url: 'https://accounts.example.com/oauth' },
      error,
    });
    expect(mockReportError).toHaveBeenCalledWith(error, {
      operation: 'auth.oauth_session',
      error_code: 'session_failed',
    });
  });

  it('uses native Apple sign-in with a hashed nonce', async () => {
    const result = { data: { user: { id: 'user-1' } }, error: null };
    mockSignInWithApple.mockResolvedValue({ identityToken: 'apple-token' });
    mockSignInWithIdToken.mockResolvedValue(result);

    await expect(signInWithApple()).resolves.toEqual(result);
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
    expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA-256', 'raw-nonce');
    expect(mockSignInWithApple).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: 'hashed-nonce',
    });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-token',
      nonce: 'raw-nonce',
    });
  });

  it('returns stable outcomes when Apple has no identity token or the user cancels', async () => {
    mockSignInWithApple.mockResolvedValue({ identityToken: null });
    await expect(signInWithApple()).resolves.toMatchObject({
      data: null,
      error: { message: AUTH_ERROR_KEYS.appleTokenMissing },
    });

    mockSignInWithApple.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    await expect(signInWithApple()).resolves.toEqual({ data: null, error: null });
  });

  it('maps unexpected native Apple failures to a stable error', async () => {
    mockSignInWithApple.mockRejectedValue(new Error('native failure'));

    await expect(signInWithApple()).resolves.toMatchObject({
      data: null,
      error: { message: AUTH_ERROR_KEYS.appleSignInFailed },
    });
  });
});
