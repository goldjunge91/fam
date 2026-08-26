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

import { authErrorMessage, signInWithOAuthProvider } from '@/features/auth/api';

describe('auth api', () => {
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

  describe('authErrorMessage', () => {
    it('übersetzt englische Fehlermeldungen in verständliche deutsche Texte', () => {
      expect(authErrorMessage(null)).toBeNull();

      expect(authErrorMessage(new Error('Invalid login credentials'))).toBe(
        'E-Mail oder Passwort stimmt nicht.',
      );

      expect(authErrorMessage(new Error('Email not confirmed'))).toBe(
        'Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen Link geschickt.',
      );

      expect(authErrorMessage(new Error('User already registered'))).toBe(
        'Für diese Adresse gibt es schon ein Konto. Melde dich an oder setze dein Passwort zurück.',
      );

      expect(authErrorMessage(new Error('Password should be at least 6 characters'))).toBe(
        'Das Passwort ist zu kurz.',
      );

      expect(authErrorMessage(new Error('Network request failed'))).toBe(
        'Keine Verbindung. Prüfe dein Netz und versuch es noch einmal.',
      );
    });

    it('gibt die Originalmeldung zurück wenn kein Treffer vorliegt', () => {
      expect(authErrorMessage(new Error('Unbekannter Fehler X'))).toBe('Unbekannter Fehler X');
    });
  });
});
