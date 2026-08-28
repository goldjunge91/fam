const mockSignInWithOAuth = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockSetSession = jest.fn();

jest.mock('@/lib/supabase', () => ({
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

import { signInWithOAuthProvider } from '@/features/auth/provider-auth';

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
});
