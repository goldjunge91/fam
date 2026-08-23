/** Reine Auswertungen fuer den Entwickler-Bereich. */

export type SupabaseTarget = {
  kind: 'lokal' | 'remote' | 'unbekannt';
  label: string;
  /** `danger` fuer remote: Wer dort versehentlich testet, aendert echte Daten. */
  tone: 'accent' | 'warning' | 'danger';
};

/** Warnt, ob ein Build lokale oder echte Daten veraendert. */
export function classifySupabaseTarget(url: string): SupabaseTarget {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { kind: 'unbekannt', label: 'Nicht lesbar', tone: 'warning' };
  }

  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
    return { kind: 'lokal', label: 'Lokal', tone: 'accent' };
  }

  // Emulatoren erreichen den lokalen Host auch per LAN-Adresse oder 10.0.2.2.
  if (host === '10.0.2.2' || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return { kind: 'lokal', label: 'Lokal (über LAN)', tone: 'accent' };
  }

  return { kind: 'remote', label: 'Remote — echte Daten', tone: 'danger' };
}

/** Maskiert einen Schluessel bis auf wiedererkennbare Randzeichen. */
export function maskSecret(value: string, visible = 8): string {
  if (value.length <= visible) return '…';
  return `${value.slice(0, visible)}…`;
}

/** Berechnet die Restlaufzeit aus JWT-Sekunden und Zeitstempel-Millisekunden. */
export function formatTokenExpiry(expSeconds: number | undefined, nowMs: number): string {
  if (expSeconds === undefined) return 'unbekannt';

  const remainingMs = expSeconds * 1000 - nowMs;
  if (remainingMs <= 0) return 'abgelaufen';

  const minutes = Math.floor(remainingMs / 60_000);
  if (minutes < 1) return 'unter 1 min';
  if (minutes < 60) return `noch ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  return `noch ${hours} h ${minutes % 60} min`;
}

export type DatabaseOwnership = {
  label: string;
  tone: 'accent' | 'warning' | 'danger';
};

/** Erkennt eine lokale Datenbank, die noch einem anderen Nutzer gehoert. */
export function describeDatabaseOwnership(
  storedUserId: string | null,
  sessionUserId: string | null,
): DatabaseOwnership {
  if (sessionUserId === null) return { label: 'nicht angemeldet', tone: 'warning' };
  if (storedUserId === null) return { label: 'noch nicht zugeordnet', tone: 'warning' };
  if (storedUserId === sessionUserId) return { label: 'stimmt überein', tone: 'accent' };

  return { label: `FREMD (${storedUserId.slice(0, 8)}…)`, tone: 'danger' };
}
