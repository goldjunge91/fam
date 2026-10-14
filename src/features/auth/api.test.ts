import {
  confirmSignUpWithCode,
  requestPasswordReset,
  resendConfirmationEmail,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from './api';

const mockAuth = {
  signUp: jest.fn(),
  verifyOtp: jest.fn(),
  resend: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
};

jest.mock('@/lib/backend/supabase/remote-client', () => ({
  getSupabase: () => ({ auth: mockAuth }),
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `fam://${path}`,
}));

describe('auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards signup, verification, resend, password sign-in and sign-out', async () => {
    const data = { user: { id: 'user-1' } };
    mockAuth.signUp.mockResolvedValue({ data, error: null });
    mockAuth.verifyOtp.mockResolvedValue({ data, error: null });
    mockAuth.resend.mockResolvedValue({ error: null });
    mockAuth.signInWithPassword.mockResolvedValue({ data, error: null });
    mockAuth.signOut.mockResolvedValue({ error: null });

    await expect(signUp('person@example.test', 'secret')).resolves.toEqual({ data, error: null });
    await expect(confirmSignUpWithCode('person@example.test', '123456')).resolves.toEqual({
      data,
      error: null,
    });
    await expect(resendConfirmationEmail('person@example.test')).resolves.toEqual({ error: null });
    await expect(signIn('person@example.test', 'secret')).resolves.toEqual({ data, error: null });
    await expect(signOut()).resolves.toEqual({ error: null });

    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'person@example.test',
      password: 'secret',
    });
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'person@example.test',
      token: '123456',
      type: 'signup',
    });
    expect(mockAuth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'person@example.test' });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'person@example.test',
      password: 'secret',
    });
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('returns reset and password update errors from Supabase', async () => {
    const error = new Error('request failed');
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error });
    mockAuth.updateUser.mockResolvedValue({ error });

    await expect(requestPasswordReset('person@example.test')).resolves.toEqual({
      error,
      redirectTo: 'fam:///reset-password',
    });
    await expect(updatePassword('new-secret')).resolves.toEqual({ error });

    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('person@example.test', {
      redirectTo: 'fam:///reset-password',
    });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
  });
});
