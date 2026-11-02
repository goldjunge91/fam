const mockSignInWithOAuth = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSetSession = jest.fn();
const mockSignInWithApple = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockRandomUUID = jest.fn();
const mockReportError = jest.fn();

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({
    auth: {
      setSession: mockSetSession,
      exchangeCodeForSession: mockExchangeCodeForSession,
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
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockSetSession.mockResolvedValue({ error: null });
    mockDigestStringAsync.mockResolvedValue('hashed-nonce');
    mockRandomUUID.mockReturnValue('raw-nonce');
  });

  it('tauscht den Callback-Code mit dem Verifier des gestarteten PKCE-Flows aus', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.example.com/oauth', flowId: 'flow-google' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'fam:///sign-in?code=auth-code',
    });

    await signInWithOAuthProvider('google');

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'fam:///sign-in', skipBrowserRedirect: true },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.example.com/oauth',
      'fam:///sign-in',
    );
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('auth-code', { flowId: 'flow-google' });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('liefert einen stabilen Fehler-Key, wenn keine OAuth-URL vorhanden ist', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

    const result = await signInWithOAuthProvider('google');

    expect(result.error?.message).toBe(AUTH_ERROR_KEYS.redirectUrlMissing);
  });

  it('liefert einen stabilen Fehler-Key bei ungültigem OAuth-Callback', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.example.com/oauth', flowId: 'flow-google' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'fam:///sign-in#access_token=abc123&refresh_token=def456',
    });

    const result = await signInWithOAuthProvider('google');

    expect(result.error?.message).toBe(AUTH_ERROR_KEYS.callbackInvalid);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('fails closed when Supabase does not return a PKCE flow id', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.example.com/oauth' },
      error: null,
    });

    await expect(signInWithOAuthProvider('google')).resolves.toMatchObject({
      error: { message: AUTH_ERROR_KEYS.callbackInvalid },
    });
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('returns Supabase OAuth errors without opening a browser', async () => {
    const error = new Error('OAuth setup failed');
    const data = { url: null };
    mockSignInWithOAuth.mockResolvedValue({ data, error });

    await expect(signInWithOAuthProvider('google')).resolves.toEqual({ data, error });
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('treats an OAuth browser dismissal as a non-error result', async () => {
    const firstData = { url: 'https://accounts.example.com/oauth', flowId: 'flow-first' };
    const secondData = { url: 'https://accounts.example.com/oauth', flowId: 'flow-second' };
    mockSignInWithOAuth
      .mockResolvedValueOnce({ data: firstData, error: null })
      .mockResolvedValueOnce({ data: secondData, error: null });
    mockOpenAuthSessionAsync
      .mockResolvedValueOnce({ type: 'cancel' })
      .mockResolvedValueOnce({ type: 'success', url: 'fam:///sign-in?code=second-code' });

    await expect(signInWithOAuthProvider('google')).resolves.toEqual({
      data: firstData,
      error: null,
    });
    await expect(signInWithOAuthProvider('apple')).resolves.toEqual({
      data: secondData,
      error: null,
    });
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('second-code', {
      flowId: 'flow-second',
    });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('reports and returns a code-exchange error after a valid OAuth callback', async () => {
    const error = Object.assign(new Error('code exchange rejected'), { code: 'exchange_failed' });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.example.com/oauth', flowId: 'flow-apple' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'fam:///sign-in?code=auth-code',
    });
    mockExchangeCodeForSession.mockResolvedValue({ error });

    await expect(signInWithOAuthProvider('apple')).resolves.toEqual({
      data: { url: 'https://accounts.example.com/oauth', flowId: 'flow-apple' },
      error,
    });
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('auth-code', { flowId: 'flow-apple' });
    expect(mockReportError).toHaveBeenCalledWith(error, {
      operation: 'auth.oauth_session',
      error_code: 'exchange_failed',
    });
  });

  it('rejects a second browser OAuth start while the first one is active', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.example.com/oauth', flowId: 'flow-google' },
      error: null,
    });
    let finishBrowser: ((result: { type: 'success'; url: string }) => void) | undefined;
    mockOpenAuthSessionAsync.mockReturnValue(
      new Promise((resolve) => {
        finishBrowser = resolve;
      }),
    );

    const firstSignIn = signInWithOAuthProvider('google');
    await Promise.resolve();
    const secondResult = await signInWithOAuthProvider('apple');

    expect(secondResult.error?.message).toBe(AUTH_ERROR_KEYS.callbackInvalid);
    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledTimes(1);

    finishBrowser?.({ type: 'success', url: 'fam:///sign-in?code=auth-code' });
    await firstSignIn;
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('auth-code', { flowId: 'flow-google' });
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
