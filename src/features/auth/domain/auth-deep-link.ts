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

export function parseOAuthCodeFromUrl(url: string, expectedRedirect: string): string | null {
  try {
    const actual = new URL(url);
    const expected = new URL(expectedRedirect);

    if (
      actual.protocol !== expected.protocol ||
      actual.host !== expected.host ||
      actual.username !== expected.username ||
      actual.password !== expected.password ||
      actual.pathname !== expected.pathname ||
      expected.search ||
      expected.hash
    ) {
      return null;
    }

    const queryKeys = [...actual.searchParams.keys()];
    const codes = actual.searchParams.getAll('code');
    if (actual.hash || queryKeys.length !== 1 || codes.length !== 1) return null;

    return codes[0]?.trim() ? codes[0] : null;
  } catch {
    return null;
  }
}
