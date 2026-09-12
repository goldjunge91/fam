import { i18n } from '@/i18n';

import { AUTH_ERROR_KEYS, authErrorMessage } from './auth-error-message';

const translate = (key: string) => i18n.t(key);

describe('authErrorMessage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('übersetzt bekannte Auth-Fehler in verständliche Texte', () => {
    expect(authErrorMessage(null, translate)).toBeNull();
    expect(authErrorMessage(new Error('Invalid login credentials'), translate)).toBe(
      'E-Mail oder Passwort stimmt nicht.',
    );
    expect(authErrorMessage(new Error('Email not confirmed'), translate)).toBe(
      'Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen Link geschickt.',
    );
    expect(authErrorMessage(new Error('User already registered'), translate)).toBe(
      'Für diese Adresse gibt es schon ein Konto. Melde dich an oder setze dein Passwort zurück.',
    );
    expect(authErrorMessage(new Error('Password should be at least 6 characters'), translate)).toBe(
      'Das Passwort ist zu kurz.',
    );
    expect(authErrorMessage(new Error('Network request failed'), translate)).toBe(
      'Keine Verbindung. Prüfe dein Netz und versuch es noch einmal.',
    );
  });

  it('übersetzt stabile OAuth-Fehler mit der aktiven Sprache', async () => {
    expect(authErrorMessage(new Error(AUTH_ERROR_KEYS.callbackInvalid), translate)).toBe(
      'Der OAuth-Callback ist ungültig.',
    );

    await i18n.changeLanguage('en');

    expect(authErrorMessage(new Error(AUTH_ERROR_KEYS.callbackInvalid), translate)).toBe(
      'The OAuth callback is invalid.',
    );
    expect(authErrorMessage(new Error(AUTH_ERROR_KEYS.appleTokenMissing), translate)).toBe(
      'Apple did not provide an identity token.',
    );
  });

  it('gibt unbekannte Meldungen unverändert zurück', () => {
    expect(authErrorMessage(new Error('Unbekannter Fehler X'), translate)).toBe(
      'Unbekannter Fehler X',
    );
  });
});
