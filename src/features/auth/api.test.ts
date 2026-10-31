import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import {
  confirmSignUpWithCode,
  discardPasswordRecoverySession,
  getPrimarySessionUserId,
  requestPasswordReset,
  resendConfirmationEmail,
  signIn,
  signOut,
  signUp,
  transferPasswordRecoverySession,
  updatePassword,
  updatePasswordWithRecoveryClient,
  verifyPasswordRecoveryCode,
  verifyPasswordRecoveryTokenHash,
} from './api';

const mockPrimaryAuth = {
  signUp: jest.fn(),
  verifyOtp: jest.fn(),
  resend: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
  getSession: jest.fn(),
  setSession: jest.fn(),
};
const mockRecoveryAuth = {
  verifyOtp: jest.fn(),
  updateUser: jest.fn(),
  getSession: jest.fn(),
  signOut: jest.fn(),
};
const mockRecoveryClient = { auth: mockRecoveryAuth };
let mockRecoveryUrl: string | undefined;

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  createPasswordRecoveryClient: () => mockRecoveryClient,
  getSupabase: () => ({ auth: mockPrimaryAuth }),
}));

jest.mock('@/lib/config/env', () => ({
  env: {
    get passwordRecoveryUrl() {
      return mockRecoveryUrl;
    },
  },
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `fam://${path}`,
}));

describe('auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecoveryUrl = undefined;
  });

  it('forwards signup, verification, resend, password sign-in and sign-out', async () => {
    const data = { user: { id: 'user-1' } };
    mockPrimaryAuth.signUp.mockResolvedValue({ data, error: null });
    mockPrimaryAuth.verifyOtp.mockResolvedValue({ data, error: null });
    mockPrimaryAuth.resend.mockResolvedValue({ error: null });
    mockPrimaryAuth.signInWithPassword.mockResolvedValue({ data, error: null });
    mockPrimaryAuth.signOut.mockResolvedValue({ error: null });

    await expect(signUp('person@example.test', 'secret')).resolves.toEqual({ data, error: null });
    await expect(confirmSignUpWithCode('person@example.test', '123456')).resolves.toEqual({
      data,
      error: null,
    });
    await expect(resendConfirmationEmail('person@example.test')).resolves.toEqual({ error: null });
    await expect(signIn('person@example.test', 'secret')).resolves.toEqual({ data, error: null });
    await expect(signOut()).resolves.toEqual({ error: null });

    expect(mockPrimaryAuth.signUp).toHaveBeenCalledWith({
      email: 'person@example.test',
      password: 'secret',
    });
    expect(mockPrimaryAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'person@example.test',
      token: '123456',
      type: 'signup',
    });
    expect(mockPrimaryAuth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'person@example.test',
    });
    expect(mockPrimaryAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'person@example.test',
      password: 'secret',
    });
    expect(mockPrimaryAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('returns reset and password update errors from Supabase', async () => {
    const error = new Error('request failed');
    mockPrimaryAuth.resetPasswordForEmail.mockResolvedValue({ error });
    mockPrimaryAuth.updateUser.mockResolvedValue({ error });

    await expect(requestPasswordReset('person@example.test')).resolves.toEqual({ error });
    await expect(updatePassword('new-secret')).resolves.toEqual({ error });

    expect(mockPrimaryAuth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.test', {
      redirectTo: 'fam:///password-recovery',
    });
    expect(mockPrimaryAuth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
  });

  it('uses the configured HTTPS recovery URL when available', async () => {
    mockRecoveryUrl = 'https://account.example.test/password-recovery';
    mockPrimaryAuth.resetPasswordForEmail.mockResolvedValue({ error: null });

    await requestPasswordReset('person@example.test');

    expect(mockPrimaryAuth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.test', {
      redirectTo: 'https://account.example.test/password-recovery',
    });
  });

  it('verifies the recovery code on the isolated client and updates there', async () => {
    const session = { user: { id: 'recovered-user' } };
    mockRecoveryAuth.verifyOtp.mockResolvedValue({ data: { session }, error: null });
    mockRecoveryAuth.updateUser.mockResolvedValue({ error: null });

    await expect(
      verifyPasswordRecoveryCode(
        mockRecoveryClient as unknown as TypedSupabaseClient,
        'person@example.test',
        '123456',
      ),
    ).resolves.toEqual({
      data: { session },
      error: null,
    });
    await expect(
      updatePasswordWithRecoveryClient(
        mockRecoveryClient as unknown as TypedSupabaseClient,
        'new-secret',
      ),
    ).resolves.toEqual({ error: null });

    expect(mockRecoveryAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'person@example.test',
      token: '123456',
      type: 'recovery',
    });
    expect(mockRecoveryAuth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
    expect(mockPrimaryAuth.verifyOtp).not.toHaveBeenCalled();
    expect(mockPrimaryAuth.updateUser).not.toHaveBeenCalled();
  });

  it('verifies the recovery token hash on the isolated client', async () => {
    const session = { user: { id: 'recovered-user' } };
    mockRecoveryAuth.verifyOtp.mockResolvedValue({ data: { session }, error: null });

    await expect(
      verifyPasswordRecoveryTokenHash(
        mockRecoveryClient as unknown as TypedSupabaseClient,
        'single-use-token-hash',
      ),
    ).resolves.toEqual({ data: { session }, error: null });

    expect(mockRecoveryAuth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'single-use-token-hash',
      type: 'recovery',
    });
    expect(mockPrimaryAuth.verifyOtp).not.toHaveBeenCalled();
  });

  it('transfers only into an empty primary session and preserves an existing account', async () => {
    const session = {
      access_token: 'access',
      refresh_token: 'refresh',
      user: { id: 'recovered-user' },
    };
    mockPrimaryAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockRecoveryAuth.getSession.mockResolvedValue({ data: { session }, error: null });
    mockPrimaryAuth.setSession.mockResolvedValue({ data: { session }, error: null });

    await expect(
      transferPasswordRecoverySession(mockRecoveryClient as unknown as TypedSupabaseClient, null),
    ).resolves.toBe('transferred');
    expect(mockPrimaryAuth.setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });

    jest.clearAllMocks();
    mockPrimaryAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'existing-user' } } },
      error: null,
    });
    await expect(
      transferPasswordRecoverySession(mockRecoveryClient as unknown as TypedSupabaseClient, null),
    ).resolves.toBe('primary-session-preserved');
    expect(mockPrimaryAuth.setSession).not.toHaveBeenCalled();
  });

  it('does not transfer after the primary account was signed out during recovery', async () => {
    mockPrimaryAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(
      transferPasswordRecoverySession(
        mockRecoveryClient as unknown as TypedSupabaseClient,
        'initial-user',
      ),
    ).resolves.toBe('sign-in-required');
    expect(mockRecoveryAuth.getSession).not.toHaveBeenCalled();
    expect(mockPrimaryAuth.setSession).not.toHaveBeenCalled();
  });

  it('discards only the recovery client local session', async () => {
    mockRecoveryAuth.signOut.mockResolvedValue({ error: null });

    await expect(
      discardPasswordRecoverySession(mockRecoveryClient as unknown as TypedSupabaseClient),
    ).resolves.toEqual({ error: null });

    expect(mockRecoveryAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockPrimaryAuth.signOut).not.toHaveBeenCalled();
  });

  it('reads the current primary account and surfaces session lookup errors', async () => {
    mockPrimaryAuth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'primary-user' } } },
      error: null,
    });
    await expect(getPrimarySessionUserId()).resolves.toBe('primary-user');

    mockPrimaryAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(getPrimarySessionUserId()).resolves.toBeNull();

    const error = new Error('session unavailable');
    mockPrimaryAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error });
    await expect(getPrimarySessionUserId()).rejects.toBe(error);
  });

  it('requires sign-in when either session cannot be read or the recovery session is absent', async () => {
    mockPrimaryAuth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error(),
    });
    await expect(
      transferPasswordRecoverySession(mockRecoveryClient as unknown as TypedSupabaseClient, null),
    ).resolves.toBe('sign-in-required');

    mockPrimaryAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    mockRecoveryAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(
      transferPasswordRecoverySession(mockRecoveryClient as unknown as TypedSupabaseClient, null),
    ).resolves.toBe('sign-in-required');

    mockPrimaryAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    mockRecoveryAuth.getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'access',
          refresh_token: 'refresh',
          user: { id: 'recovered-user' },
        },
      },
      error: new Error('expired recovery session'),
    });
    await expect(
      transferPasswordRecoverySession(mockRecoveryClient as unknown as TypedSupabaseClient, null),
    ).resolves.toBe('sign-in-required');
  });

  it('checks the primary session after a rejected or ambiguous transfer', async () => {
    const recoverySession = {
      access_token: 'access',
      refresh_token: 'refresh',
      user: { id: 'recovered-user' },
    };
    const client = mockRecoveryClient as unknown as TypedSupabaseClient;

    mockPrimaryAuth.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({
        data: { session: { user: { id: 'recovered-user' } } },
        error: null,
      });
    mockRecoveryAuth.getSession.mockResolvedValueOnce({
      data: { session: recoverySession },
      error: null,
    });
    mockPrimaryAuth.setSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error(),
    });
    await expect(transferPasswordRecoverySession(client, null)).resolves.toBe('transferred');

    mockPrimaryAuth.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'other-user' } } }, error: null });
    mockRecoveryAuth.getSession.mockResolvedValueOnce({
      data: { session: recoverySession },
      error: null,
    });
    mockPrimaryAuth.setSession.mockRejectedValueOnce(new Error('ambiguous transfer'));
    await expect(transferPasswordRecoverySession(client, null)).resolves.toBe(
      'primary-session-preserved',
    );

    mockPrimaryAuth.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: null }, error: null });
    mockRecoveryAuth.getSession.mockResolvedValueOnce({
      data: { session: recoverySession },
      error: null,
    });
    mockPrimaryAuth.setSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error(),
    });
    await expect(transferPasswordRecoverySession(client, null)).resolves.toBe('sign-in-required');

    mockPrimaryAuth.getSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: null }, error: new Error('lookup failed') });
    mockRecoveryAuth.getSession.mockResolvedValueOnce({
      data: { session: recoverySession },
      error: null,
    });
    mockPrimaryAuth.setSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error(),
    });
    await expect(transferPasswordRecoverySession(client, null)).resolves.toBe('transfer-uncertain');
  });
});
