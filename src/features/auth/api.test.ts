import { authErrorMessage } from '@/features/auth/api';

describe('auth api', () => {
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
