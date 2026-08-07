/**
 * Zentraler, gepruefter Zugriff auf die Umgebungsvariablen.
 *
 * Ohne diese Pruefung wuerde ein fehlender Wert erst spaeter als kryptischer
 * Netzwerkfehler auftauchen ("Network request failed"), weil der Supabase-Client
 * dann gegen `undefined` als URL laeuft. Hier bricht es stattdessen sofort und
 * mit einer Meldung ab, die sagt, was zu tun ist.
 *
 * Wichtig: Nur Variablen mit dem Praefix `EXPO_PUBLIC_` landen im Client-Bundle.
 * Sie werden von Expo zur Build-Zeit als Literal eingesetzt — deshalb muss
 * `process.env.EXPO_PUBLIC_X` woertlich im Quelltext stehen und darf nicht
 * dynamisch zusammengebaut werden (`process.env[name]` funktioniert nicht).
 */

export class MissingEnvError extends Error {
  constructor(readonly variableName: string) {
    super(
      `Umgebungsvariable ${variableName} fehlt.\n\n` +
        'Lege eine .env im Projekt-Root an und trage die Werte ein. ' +
        'Fuer die lokale Supabase-Instanz liefert `supabase status` die passenden Werte, ' +
        'fuer ein gehostetes Projekt das Supabase-Dashboard unter Project Settings > API.\n' +
        'Details stehen im README unter "Umgebungsvariablen".',
    );
    this.name = 'MissingEnvError';
  }
}

/**
 * Reine Funktion — bewusst ohne Zugriff auf `process.env`, damit sie sich ohne
 * Testdoubles gegen alle Randfaelle pruefen laesst.
 */
export function requireEnv(variableName: string, value: string | undefined | null): string {
  if (value === undefined || value === null || value.trim() === '') {
    throw new MissingEnvError(variableName);
  }
  return value.trim();
}

export const env = {
  /** Schalter fuer lokale Datenbank (http://127.0.0.1:54321) vs. Remote-Projekt */
  get useLocalDb(): boolean {
    const val = process.env.EXPO_PUBLIC_USE_LOCAL_DB?.trim().toLowerCase();
    return val === 'true' || val === '1';
  },

  get supabaseUrl(): string {
    if (this.useLocalDb) {
      return 'http://127.0.0.1:54321';
    }
    return requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
  },

  get supabaseKey(): string {
    if (this.useLocalDb) {
      return 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
    }
    return requireEnv('EXPO_PUBLIC_SUPABASE_KEY', process.env.EXPO_PUBLIC_SUPABASE_KEY);
  },

  get forceOnboarding(): boolean {
    const val = process.env.EXPO_PUBLIC_FORCE_ONBOARDING?.trim().toLowerCase();
    return val === 'true' || val === '1';
  },
};
