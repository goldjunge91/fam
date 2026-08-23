/** Parst die Fragment-Tokens des impliziten Supabase-Flows fuer React Native. */
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

/** Liest den Fehler aus einem abgelaufenen oder bereits eingeloesten Link. */
export function parseAuthErrorFromUrl(url: string): string | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const description = params.get('error_description');
  return description ? description.replace(/\+/g, ' ') : params.get('error_code');
}
