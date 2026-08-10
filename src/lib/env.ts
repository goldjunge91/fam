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
        'Lege eine .env (oder .env.development / .env.local) im Projekt-Root an und trage die Werte ein. ' +
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

/**
 * Deutet eine Schalter-Variable.
 *
 * Rein und exportiert, damit die Randfaelle ohne `process.env` pruefbar sind:
 * In einer `.env` steht mal `true`, mal `1`, mal `True` mit einem Leerzeichen
 * dahinter — und ein nicht erkannter Wert waere ein stillschweigend
 * deaktivierter Schalter, den niemand sucht.
 */
export function isFlagEnabled(value: string | undefined | null): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

export const env = {
  get supabaseUrl(): string {
    return requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
  },
  get supabaseKey(): string {
    return requireEnv('EXPO_PUBLIC_SUPABASE_KEY', process.env.EXPO_PUBLIC_SUPABASE_KEY);
  },
  get forceOnboarding(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_FORCE_ONBOARDING);
  },
  /**
   * Blendet den Entwickler-Bereich in den Einstellungen ein.
   *
   * Bewusst ein eigener Schalter und nicht `__DEV__`: Der Bereich ist gerade
   * dann nuetzlich, wenn er in einem echten Build erreichbar ist — etwa in
   * einem TestFlight-Build, bei dem geklaert werden muss, gegen welches
   * Supabase-Projekt er laeuft. Umgekehrt soll er sich auch waehrend der
   * Entwicklung abschalten lassen, um die Einstellungen so zu sehen, wie
   * Nutzer sie sehen.
   */
  get devTools(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_DEV_TOOLS);
  },
};
