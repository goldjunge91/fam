export type SupabaseTarget = {
  kind: 'lokal' | 'remote' | 'unbekannt';
  labelKey:
    | 'dev.info.supabaseLocal'
    | 'dev.info.supabaseLan'
    | 'dev.info.supabaseRemote'
    | 'dev.info.supabaseUnreadable';
  tone: 'accent' | 'warning' | 'danger';
};

export function classifySupabaseTarget(url: string): SupabaseTarget {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { kind: 'unbekannt', labelKey: 'dev.info.supabaseUnreadable', tone: 'warning' };
  }

  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
    return { kind: 'lokal', labelKey: 'dev.info.supabaseLocal', tone: 'accent' };
  }

  // Ein Emulator/Simulator spricht den Host des Entwicklungsrechners ueber
  // dessen LAN-Adresse oder ueber 10.0.2.2 (Android-Emulator) an — auch das
  // ist die lokale Instanz, nur nicht ueber localhost erreichbar.
  if (host === '10.0.2.2' || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return { kind: 'lokal', labelKey: 'dev.info.supabaseLan', tone: 'accent' };
  }

  return { kind: 'remote', labelKey: 'dev.info.supabaseRemote', tone: 'danger' };
}

/**
 * Zeigt genug vom Schluessel, um ihn wiederzuerkennen, und wenig genug, um
 * einen Screenshot des Bereichs unbedenklich zu machen.
 */
export function maskSecret(value: string, visible = 8): string {
  if (value.length <= visible) return '…';
  return `${value.slice(0, visible)}…`;
}

export type TokenExpiry =
  | { key: 'dev.info.tokenUnknown' }
  | { key: 'dev.info.tokenExpired' }
  | { key: 'dev.info.tokenUnderMinute' }
  | { key: 'dev.info.tokenMinutes'; minutes: number }
  | { key: 'dev.info.tokenHours'; hours: number; minutes: number };

export function formatTokenExpiry(expSeconds: number | undefined, nowMs: number): TokenExpiry {
  if (expSeconds === undefined) return { key: 'dev.info.tokenUnknown' };

  const remainingMs = expSeconds * 1000 - nowMs;
  if (remainingMs <= 0) return { key: 'dev.info.tokenExpired' };

  const minutes = Math.floor(remainingMs / 60_000);
  if (minutes < 1) return { key: 'dev.info.tokenUnderMinute' };
  if (minutes < 60) return { key: 'dev.info.tokenMinutes', minutes };

  const hours = Math.floor(minutes / 60);
  return { key: 'dev.info.tokenHours', hours, minutes: minutes % 60 };
}

export type DatabaseOwnership =
  | { key: 'dev.info.ownershipUnauthenticated' }
  | { key: 'dev.info.ownershipUnassigned' }
  | { key: 'dev.info.ownershipMatches' }
  | { key: 'dev.info.ownershipForeign'; userId: string };

export function describeDatabaseOwnership(
  storedUserId: string | null,
  sessionUserId: string | null,
): DatabaseOwnership {
  if (sessionUserId === null) return { key: 'dev.info.ownershipUnauthenticated' };
  if (storedUserId === null) return { key: 'dev.info.ownershipUnassigned' };
  if (storedUserId === sessionUserId) return { key: 'dev.info.ownershipMatches' };

  return { key: 'dev.info.ownershipForeign', userId: storedUserId.slice(0, 8) };
}
