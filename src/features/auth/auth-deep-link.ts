/**
 * Supabase nutzt fuer resetPasswordForEmail den impliziten Flow
 * (`flowType: 'implicit'`, der Default von @supabase/auth-js). Reset-Links
 * landen deshalb mit den Tokens im URL-Fragment
 * (`fam:///reset-password#access_token=...&refresh_token=...&type=recovery`).
 *
 * `detectSessionInUrl: false` (siehe supabase.ts) ist in React Native
 * zwingend noetig, uebernimmt dieses Parsen also nicht automatisch. Diese
 * reine Funktion holt es manuell nach; der Aufrufer reicht das Ergebnis an
 * `supabase.auth.setSession()`.
 */
export interface AuthDeepLinkTokens {
  accessToken: string;
  refreshToken: string;
}

export function parseAuthTokensFromUrl(url: string): AuthDeepLinkTokens | null {
  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== 'fam:' ||
      parsed.hostname !== '' ||
      parsed.pathname !== '/reset-password' ||
      !parsed.hash
    ) {
      return null;
    }

    const params = new URLSearchParams(parsed.hash.slice(1));

    if (params.get('type') !== 'recovery') {
      return null;
    }

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

/**
 * Ein abgelaufener oder bereits eingeloester Link liefert statt Tokens
 * `#error=...&error_code=...&error_description=...` im selben Fragment.
 */
export function parseAuthErrorFromUrl(url: string): string | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const description = params.get('error_description');
  return description ? description.replace(/\+/g, ' ') : params.get('error_code');
}

export function parseOAuthTokensFromUrl(
  url: string,
  expectedRedirect: string,
): AuthDeepLinkTokens | null {
  try {
    const actual = new URL(url);
    const expected = new URL(expectedRedirect);

    if (
      actual.protocol !== expected.protocol ||
      actual.hostname !== expected.hostname ||
      actual.pathname !== expected.pathname
    ) {
      return null;
    }

    const params = new URLSearchParams(actual.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}
