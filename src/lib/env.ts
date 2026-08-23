// Expo ersetzt nur statische Zugriffe wie `process.env.EXPO_PUBLIC_X` im Client-Bundle.

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
  get offFactsOffline(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_OFF_OFFLINE);
  },
  get forcePremium(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_FORCE_PREMIUM);
  },
  // Store-Keys bleiben optional, damit Builds ohne eingerichtete Kaeufe starten.
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
  get sentryDebug(): boolean {
    return isFlagEnabled(process.env.EXPO_PUBLIC_SENTRY_DEBUG);
  },
  get posthogApiKey(): string | undefined {
    return process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim() || undefined;
  },
  get posthogHost(): string {
    return process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
  },
};
