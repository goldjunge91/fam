import { usePasswordRecoveryStore } from './recovery-store';

const mockClient = { auth: { setSession: jest.fn(), signOut: jest.fn() } };
const mockCreatePasswordRecoveryClient = jest.fn();
const mockGetPrimarySessionUserId = jest.fn();
const mockRequestPasswordReset = jest.fn();
const mockVerifyPasswordRecoveryCode = jest.fn();
const mockVerifyPasswordRecoveryTokenHash = jest.fn();
const mockUpdatePasswordWithRecoveryClient = jest.fn();
const mockTransferPasswordRecoverySession = jest.fn();
const mockDiscardPasswordRecoverySession = jest.fn();

jest.mock('@/features/auth/api', () => ({
  discardPasswordRecoverySession: (...args: unknown[]) =>
    mockDiscardPasswordRecoverySession(...args),
  getPrimarySessionUserId: (...args: unknown[]) => mockGetPrimarySessionUserId(...args),
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  transferPasswordRecoverySession: (...args: unknown[]) =>
    mockTransferPasswordRecoverySession(...args),
  updatePasswordWithRecoveryClient: (...args: unknown[]) =>
    mockUpdatePasswordWithRecoveryClient(...args),
  verifyPasswordRecoveryCode: (...args: unknown[]) => mockVerifyPasswordRecoveryCode(...args),
  verifyPasswordRecoveryTokenHash: (...args: unknown[]) =>
    mockVerifyPasswordRecoveryTokenHash(...args),
}));

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  createPasswordRecoveryClient: (...args: unknown[]) => mockCreatePasswordRecoveryClient(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function enterCode() {
  const store = usePasswordRecoveryStore.getState();
  store.setEmail('person@example.test');
  store.setCode('123456');
}

describe('password recovery store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePasswordRecoveryStore.setState({
      phase: 'entry',
      email: '',
      code: '',
      recoveryLinkFailed: false,
      operation: null,
      cooldownUntil: null,
      recoveryClient: null,
      primaryUserId: undefined,
      recoveryUserId: null,
      outcome: null,
      generation: 0,
    });
    mockCreatePasswordRecoveryClient.mockReturnValue(mockClient);
    mockClient.auth.setSession.mockResolvedValue({
      data: { session: { user: { id: 'legacy-user' } } },
      error: null,
    });
    mockGetPrimarySessionUserId.mockResolvedValue(null);
    mockRequestPasswordReset.mockResolvedValue({ error: null });
    mockVerifyPasswordRecoveryCode.mockResolvedValue({
      data: { session: { user: { id: 'recovered-user' } } },
      error: null,
    });
    mockVerifyPasswordRecoveryTokenHash.mockResolvedValue({
      data: { session: { user: { id: 'recovered-user' } } },
      error: null,
    });
    mockUpdatePasswordWithRecoveryClient.mockResolvedValue({ error: null });
    mockTransferPasswordRecoverySession.mockResolvedValue('transferred');
    mockDiscardPasswordRecoverySession.mockResolvedValue({ error: null });
  });

  it('clears the busy state if the isolated client cannot be created', async () => {
    enterCode();
    mockCreatePasswordRecoveryClient.mockImplementationOnce(() => {
      throw new Error('client setup failed');
    });

    const result = await usePasswordRecoveryStore.getState().verifyCode();

    expect(result.status).toBe('error');
    expect(usePasswordRecoveryStore.getState().operation).toBeNull();
    expect(usePasswordRecoveryStore.getState().phase).toBe('entry');
  });

  it('discards a verified isolated session if the user cancels while verification is pending', async () => {
    enterCode();
    const verificationStarted = deferred<void>();
    const verificationResult = deferred<{
      data: { session: { user: { id: string } } };
      error: null;
    }>();
    mockVerifyPasswordRecoveryCode.mockImplementation(() => {
      verificationStarted.resolve();
      return verificationResult.promise;
    });

    const pendingVerification = usePasswordRecoveryStore.getState().verifyCode();
    await verificationStarted.promise;
    await usePasswordRecoveryStore.getState().cancel();
    verificationResult.resolve({
      data: { session: { user: { id: 'recovered-user' } } },
      error: null,
    });

    await expect(pendingVerification).resolves.toEqual({ status: 'cancelled' });
    expect(mockDiscardPasswordRecoverySession).toHaveBeenCalledWith(mockClient);
    expect(usePasswordRecoveryStore.getState().phase).toBe('entry');
  });

  it('preserves an already signed-in account after changing the recovered password', async () => {
    enterCode();
    mockGetPrimarySessionUserId.mockResolvedValue('existing-user');
    mockTransferPasswordRecoverySession.mockResolvedValue('primary-session-preserved');
    await usePasswordRecoveryStore.getState().verifyCode();

    await expect(
      usePasswordRecoveryStore.getState().savePassword('StrongPassword123!'),
    ).resolves.toEqual({
      status: 'ok',
      outcome: 'existing-session',
    });

    expect(mockTransferPasswordRecoverySession).toHaveBeenCalledWith(mockClient, 'existing-user');
    expect(mockDiscardPasswordRecoverySession).toHaveBeenCalledTimes(1);
    expect(usePasswordRecoveryStore.getState().phase).toBe('updated');
  });

  it('keeps a warm code-entry form when an old recovery link arrives', async () => {
    enterCode();

    await expect(
      usePasswordRecoveryStore.getState().openLegacyRecoveryLink({
        accessToken: 'legacy-access',
        refreshToken: 'legacy-refresh',
      }),
    ).resolves.toBe('ignored');

    expect(usePasswordRecoveryStore.getState()).toMatchObject({
      phase: 'entry',
      email: 'person@example.test',
      code: '123456',
    });
    expect(mockClient.auth.setSession).not.toHaveBeenCalled();
  });

  it('verifies a token-hash link on the isolated client and preserves the primary account', async () => {
    enterCode();
    mockGetPrimarySessionUserId.mockResolvedValue('existing-user');
    mockTransferPasswordRecoverySession.mockResolvedValue('primary-session-preserved');

    await expect(
      usePasswordRecoveryStore.getState().openRecoveryTokenHash('single-use-token-hash'),
    ).resolves.toBe('opened');

    expect(mockVerifyPasswordRecoveryTokenHash).toHaveBeenCalledWith(
      mockClient,
      'single-use-token-hash',
    );
    expect(usePasswordRecoveryStore.getState().phase).toBe('verified');
    await expect(
      usePasswordRecoveryStore.getState().savePassword('StrongPassword123!'),
    ).resolves.toEqual({ status: 'ok', outcome: 'existing-session' });
    expect(mockTransferPasswordRecoverySession).toHaveBeenCalledWith(mockClient, 'existing-user');
  });

  it('handles old token links on the isolated client and can clean them up locally', async () => {
    await expect(
      usePasswordRecoveryStore.getState().openLegacyRecoveryLink({
        accessToken: 'legacy-access',
        refreshToken: 'legacy-refresh',
      }),
    ).resolves.toBe('opened');

    expect(mockClient.auth.setSession).toHaveBeenCalledWith({
      access_token: 'legacy-access',
      refresh_token: 'legacy-refresh',
    });
    expect(usePasswordRecoveryStore.getState().phase).toBe('verified');

    await usePasswordRecoveryStore.getState().cancel();

    expect(mockDiscardPasswordRecoverySession).toHaveBeenCalledWith(mockClient);
  });

  it('does not revoke a transferred session when completion leaves the recovery route', async () => {
    enterCode();
    await usePasswordRecoveryStore.getState().verifyCode();
    await usePasswordRecoveryStore.getState().savePassword('StrongPassword123!');

    expect(mockTransferPasswordRecoverySession).toHaveBeenCalledWith(mockClient, null);
    expect(mockDiscardPasswordRecoverySession).not.toHaveBeenCalled();

    await usePasswordRecoveryStore.getState().cancel();

    expect(mockDiscardPasswordRecoverySession).not.toHaveBeenCalled();
  });

  it('does not retry a password update when session transfer is uncertain', async () => {
    enterCode();
    await usePasswordRecoveryStore.getState().verifyCode();
    mockTransferPasswordRecoverySession.mockResolvedValue('transfer-uncertain');

    await expect(
      usePasswordRecoveryStore.getState().savePassword('StrongPassword123!'),
    ).resolves.toEqual({
      status: 'ok',
      outcome: 'sign-in-required',
    });

    expect(usePasswordRecoveryStore.getState().phase).toBe('sign-in-required');
    await expect(
      usePasswordRecoveryStore.getState().savePassword('StrongPassword123!'),
    ).resolves.toEqual({ status: 'missing-session' });
    expect(mockUpdatePasswordWithRecoveryClient).toHaveBeenCalledTimes(1);
    expect(mockDiscardPasswordRecoverySession).not.toHaveBeenCalled();
  });
});
