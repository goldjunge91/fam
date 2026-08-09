/**
 * Supabase nutzt fuer signUp/resetPasswordForEmail den impliziten Flow
 * (`flowType: 'implicit'`, der Default von @supabase/auth-js). Bestaetigungs-
 * und Reset-Links landen deshalb mit den Tokens im URL-Fragment
 * (`fam://...#access_token=...&refresh_token=...&type=signup`), nicht als
 * Query-Parameter — Fragmente werden nie an einen Server geschickt, Query-
 * Parameter landen in Logs.
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
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
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
