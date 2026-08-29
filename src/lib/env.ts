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

/** Liest einen öffentlichen Environment-Wert aus einer übergebenen Quelle. */
export function requireEnv(variableName: string, value: string | undefined | null): string {
  if (value === undefined || value === null || value.trim() === '') {
    throw new MissingEnvError(variableName);
  }
  return value.trim();
}

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

  get devTools(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_DEV_TOOLS);
  },

  get debugLogsEnabled(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_DEBUG_LOGS);
  },

  get offFactsOffline(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_OFF_OFFLINE);
  },

  get forcePremium(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_FORCE_PREMIUM);
  },

  /**
   * Schaltet Banner, Interstitials und die AdMob-SDK-Initialisierung global.
   * Ohne Variable bleibt Werbung aus Kompatibilitätsgründen aktiviert.
   */
  get adsEnabled(): boolean {
    const value = process.env.EXPO_PUBLIC_ADS_ENABLED?.trim().toLowerCase();
    return value === undefined || value === '' || value === 'true' || value === '1';
  },

  get revenueCatApiKeyIos(): string | undefined {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || undefined;
  },
  get revenueCatApiKeyAndroid(): string | undefined {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || undefined;
  },

  get revenueCatTestStoreApiKey(): string | undefined {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY?.trim() || undefined;
  },

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

  get posthogApiKey(): string | undefined {
    return process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() || undefined;
  },

  get posthogHost(): string {
    return process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
  },

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

// Loggt die aktive Supabase-URL nur in Entwicklungs-Builds.
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  console.log(`[env] EXPO_PUBLIC_SUPABASE_URL = ${url ?? '(nicht gesetzt)'}`);
}
