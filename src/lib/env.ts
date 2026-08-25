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
        'Pflege die passende Datei (.env.local, .env.development, .env.preview oder .env.production) im Projekt-Root. ' +
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
  /**
   * Steuert Ad-hoc-Debug-`console.log`s (siehe `@/lib/debug-log`), die beim
   * Nachvollziehen einzelner Flows temporär eingebaut werden. Anders als die
   * uebrigen Schalter hier **standardmaessig an** — Debug-Ausgaben sollen ohne
   * Zutun sichtbar sein, bis man sie explizit abschaltet, nicht umgekehrt.
   */
  get debugLogsEnabled(): boolean {
    const raw = process.env.EXPO_PUBLIC_DEBUG_LOGS?.trim().toLowerCase();
    return raw !== 'false' && raw !== '0';
  },
  /**
   * Unterbindet jeden Open-Food-Facts-Netzwerkzugriff (Suche + Barcode-Lookup).
   * Zum Testen des Offline-Verhaltens, ohne echtes Netz aus- und wieder
   * einzuschalten oder auf ein Rate-Limit zu warten.
   */
  get offFactsOffline(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_OFF_OFFLINE);
  },
  /**
   * Schaltet Premium-Funktionen hart frei, unabhaengig davon, was RevenueCat
   * zum aktuellen Nutzer sagt.
   *
   * Fuer die Entwicklung einzelner Premium-Funktionen, solange die eigentliche
   * Kaufstrecke (Paywall, Produkte im App Store/Play Store Connect) noch nicht
   * steht — ohne diesen Schalter braeuchte es dafuer einen Sandbox-Kauf pro
   * Testlauf. Siehe `PremiumProvider` in `@/features/premium`.
   */
  get forcePremium(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_FORCE_PREMIUM);
  },
  /**
   * RevenueCat-Projekt-API-Keys, getrennt pro Store (siehe RevenueCat-Dashboard
   * unter Project Settings > API Keys). Bewusst optional (`string | undefined`,
   * kein `requireEnv`): Solange die jeweilige Store-App noch nicht angelegt ist,
   * soll die App trotzdem starten — `initPurchases()` protokolliert dann nur
   * eine Warnung und Kaeufe bleiben deaktiviert.
   */
  get revenueCatApiKeyIos(): string | undefined {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || undefined;
  },
  get revenueCatApiKeyAndroid(): string | undefined {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || undefined;
  },
  /**
   * API-Key des RevenueCat Test Store (Praefix `test_`) — eine synthetische
   * Store-Implementierung von RevenueCat selbst, ohne App-Store-/Play-Store-
   * Anbindung. Kaeufe loesen echte Entitlement-Aenderungen aus und landen im
   * Dashboard, ohne dass Apple oder Google beteiligt sind. `initPurchases()`
   * bevorzugt diesen Key in Entwicklungs-Builds (`__DEV__`), damit die
   * Paywall ohne Sandbox-Account durchgeklickt werden kann.
   */
  get revenueCatTestStoreApiKey(): string | undefined {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY?.trim() || undefined;
  },
  /**
   * DSN des Sentry-Projekts (Sentry-Dashboard: Project Settings > Client Keys).
   * Ein DSN ist kein Geheimnis (er landet im Client-Bundle jeder Sentry-SDK-
   * Integration), daher `EXPO_PUBLIC_`. Bewusst optional: Ohne DSN bleibt
   * `initSentry()` (`@/lib/sentry`) ein No-op, damit lokale Entwicklung ohne
   * Sentry-Account moeglich ist.
   */
  get sentryDsn(): string | undefined {
    return process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;
  },
  /**
   * Aktiviert Sentry-Debug-Logging im Terminal/Console.
   * Standardmäßig `false`, um das Terminal nicht mit internen SDK-Logs zu fluten.
   */
  get sentryDebug(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_SENTRY_DEBUG);
  },
  /**
   * PostHog-Projekt-API-Key (PostHog-Dashboard: Project Settings > Project API Key).
   * Bewusst optional (`string | undefined`, kein `requireEnv`): Ohne Key bleibt
   * `initPostHog()` (`@/lib/posthog`) ein No-op, damit lokale Entwicklung ohne
   * PostHog-Account moeglich ist und `useFeatureFlag()` auf `defaultValue`
   * zurueckfaellt.
   */
  get posthogApiKey(): string | undefined {
    return process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() || undefined;
  },
  /**
   * Host des PostHog-Projekts (PostHog Cloud US/EU oder self-hosted). Ohne
   * gesetzte Variable faellt das auf den PostHog-Cloud-US-Standardhost zurueck,
   * dem Default aus der `posthog-react-native`-Doku.
   */
  get posthogHost(): string {
    return process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
  },
  /**
   * Aptabase-App-Key (Aptabase-Dashboard: App Settings > Instructions).
   * Bewusst optional (`string | undefined`, kein `requireEnv`): Ohne Key bleibt
   * `initAptabase()` (`@/lib/analytics/aptabase`) ein No-op, damit lokale
   * Entwicklung ohne Aptabase-Account moeglich ist.
   */
  get aptabaseAppKey(): string | undefined {
    return process.env.EXPO_PUBLIC_APTABASE_APP_KEY?.trim() || undefined;
  },
  /**
   * AdMob Anzeigenblock-IDs fuer iOS (Produktion).
   * In __DEV__ wird automatisch auf TestIds ausgewichen, um Google-Policy-Verstoesse zu verhindern.
   */
  get adMobBannerIdIos(): string {
    return (
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS?.trim() ||
      'ca-app-pub-3823642106417448/3463186524'
    );
  },
  get adMobInterstitialIdIos(): string {
    return (
      process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS?.trim() ||
      'ca-app-pub-3823642106417448/3925336471'
    );
  },
};

// Nur `__DEV__`, einmalig beim Modul-Laden (Metro-Bundle-Start): Welche
// Supabase-URL tatsaechlich aktiv ist, war zuletzt mehrfach schwer zu
// erkennen — verschiedene `.env.*`-Dateien, Metro-Cache-Reste,
// EXPO_NO_DOTENV-Faelle. Direkt aus `process.env` statt ueber `env.supabaseUrl`,
// damit ein fehlender Wert hier noch keinen Absturz vor der eigentlichen
// Fehlermeldung auslöst — nur ein sichtbarer Hinweis im Metro-Terminal-Log.
//
// `typeof __DEV__ !== 'undefined'` ist hier zwingend: `__DEV__` wird von
// babel-preset-expo injiziert. jest.integration.config.js laeuft bewusst
// OHNE dieses Preset (siehe dessen Kommentar), dort existiert die Variable
// gar nicht — ein blosses `if (__DEV__)` an Modul-Top-Level wirft dann sofort
// beim `require()` (ReferenceError), noch bevor irgendein Test laeuft.
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  console.log(`[env] EXPO_PUBLIC_SUPABASE_URL = ${url ?? '(nicht gesetzt)'}`);
}
