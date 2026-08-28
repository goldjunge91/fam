import { parseAuthErrorFromUrl, parseAuthTokensFromUrl } from './auth-deep-link';

describe('parseAuthTokensFromUrl', () => {
  it('extrahiert Tokens aus einem gültigen Recovery-Callback', () => {
    const url =
      'fam:///reset-password#access_token=abc123&refresh_token=def456&expires_in=3600&token_type=bearer&type=recovery';

    expect(parseAuthTokensFromUrl(url)).toEqual({
      accessToken: 'abc123',
      refreshToken: 'def456',
    });
  });

  it('lehnt Session-Tokens auf einem nicht erlaubten Deep-Link-Pfad ab', () => {
    const url = 'fam:///household/join#access_token=abc123&refresh_token=def456&type=recovery';

    expect(parseAuthTokensFromUrl(url)).toBeNull();
  });

  it('gibt null zurück, wenn kein Fragment vorhanden ist', () => {
    expect(parseAuthTokensFromUrl('fam:///household/join?token=abc')).toBeNull();
  });

  it('gibt null zurück, wenn das Fragment keine Tokens enthält (z. B. Fehler-Redirect)', () => {
    const url =
      'fam:///#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

    expect(parseAuthTokensFromUrl(url)).toBeNull();
  });

  it('gibt null zurück, wenn nur einer der beiden Tokens vorhanden ist', () => {
    expect(parseAuthTokensFromUrl('fam:///#access_token=abc123')).toBeNull();
  });
});

describe('parseAuthErrorFromUrl', () => {
  it('extrahiert die Fehlerbeschreibung aus dem URL-Fragment', () => {
    const url =
      'fam:///#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

    expect(parseAuthErrorFromUrl(url)).toBe('Email link is invalid or has expired');
  });

  it('fällt auf error_code zurück, wenn keine Beschreibung vorhanden ist', () => {
    expect(parseAuthErrorFromUrl('fam:///#error=access_denied&error_code=otp_expired')).toBe(
      'otp_expired',
    );
  });

  it('gibt null zurück, wenn kein Fehler im Fragment steht', () => {
    expect(parseAuthErrorFromUrl('fam:///#access_token=abc123&refresh_token=def456')).toBeNull();
  });

  it('gibt null zurück, wenn kein Fragment vorhanden ist', () => {
    expect(parseAuthErrorFromUrl('fam:///household/join?token=abc')).toBeNull();
  });
});
