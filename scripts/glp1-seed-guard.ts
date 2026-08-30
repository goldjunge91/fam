export function isLocalSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  } catch {
    return false;
  }
}

export function assertSafeSeedTarget(url: string, allowNonLocal = false): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`GLP-1-Seed verweigert: Ungültige Ziel-URL (${url}).`);
  }

  if (isLocalSupabaseUrl(url) || allowNonLocal) return;

  throw new Error(
    `GLP-1-Seed verweigert: Die Zieldatenbank ist nicht lokal (${url}). ` +
      'Für ein bewusstes Remote-Ziel setze GLP1_SEED_ALLOW_NON_LOCAL=true.',
  );
}
