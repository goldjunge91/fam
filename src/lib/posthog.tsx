import PostHog, { PostHogProvider } from 'posthog-react-native';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { useAnalyticsSettingsStore } from '@/constants/analytics';
import { env } from '@/lib/env';
import { isAnalyticsProviderEnabled } from '@/lib/telemetry/policy';

let client: PostHog | undefined;
let attempted = false;
let initializationError: string | undefined;

export type FeatureFlagValues = Record<string, boolean | string> | undefined;

const FEATURE_FLAG_RELOAD_TIMEOUT_MS = 15_000;

const FeatureFlagContext = createContext<FeatureFlagValues>(undefined);

function FeatureFlagProvider({
  posthog,
  children,
}: {
  posthog: PostHog | undefined;
  children: ReactNode;
}) {
  const [flags, setFlags] = useState<FeatureFlagValues>(() => posthog?.getFeatureFlags());

  useEffect(() => {
    if (!posthog) {
      setFlags(undefined);
      return;
    }

    setFlags(posthog.getFeatureFlags());
    return posthog.onFeatureFlags(setFlags);
  }, [posthog]);

  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>;
}

export function initPostHog(): void {
  if (attempted) return;
  if (!isAnalyticsProviderEnabled('posthog')) return;
  attempted = true;

  const apiKey = env.posthogApiKey;
  if (!apiKey) {
    if (__DEV__) {
      console.warn(
        '[posthog] EXPO_PUBLIC_POSTHOG_API_KEY fehlt — Feature-Flags fallen auf ihren ' +
          'Default-Wert zurueck. Siehe README "Umgebungsvariablen" fuer die Einrichtung.',
      );
    }
    return;
  }

  try {
    client = new PostHog(apiKey, {
      host: env.posthogHost,
      // Erfasst App-Lifecycle (Open, Background, Install/Update) mit IP & Gerätedaten
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          nativeCrashes: true,
        },
      },
    });
  } catch (err) {
    initializationError = err instanceof Error ? err.message : String(err);
    console.error('[posthog] Client-Konstruktion fehlgeschlagen — Tracking bleibt aus:', err);
  }
}

/** Ob `initPostHog()` erfolgreich einen API-Key konfiguriert hat. */
export function isPostHogConfigured(): boolean {
  return client !== undefined;
}

/** Liefert den letzten Konstruktorfehler fuer die Diagnose im Dev-Bereich. */
export function getPostHogInitializationError(): string | undefined {
  return initializationError;
}

export function getPostHogClient(): PostHog | undefined {
  return client;
}

export async function reloadPostHogFeatureFlags(): Promise<FeatureFlagValues> {
  if (!isAnalyticsProviderEnabled('posthog')) {
    throw new Error('PostHog ist in den Analytics-Einstellungen deaktiviert.');
  }

  const activeClient = getPostHogClient();
  if (!activeClient) {
    throw new Error('PostHog ist nicht konfiguriert. API-Key fehlt im Build.');
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const flags = await Promise.race([
      activeClient.reloadFeatureFlagsAsync(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('PostHog-Flag-Abruf hat nach 15 Sekunden nicht geantwortet.'));
        }, FEATURE_FLAG_RELOAD_TIMEOUT_MS);
      }),
    ]);

    if (flags === undefined) {
      throw new Error(
        'PostHog hat keine Flags geliefert. Pruefe Project API Key, Host und Netzwerk.',
      );
    }
    return flags;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function PostHogAppProvider({ children }: { children: ReactNode }): ReactNode {
  const posthogEnabled = useAnalyticsSettingsStore(
    (state) => state.overrides.enabled !== false && state.overrides.providers?.posthog !== false,
  );
  const [providerClient, setProviderClient] = useState<PostHog | undefined>(() => client);

  useEffect(() => {
    if (posthogEnabled) initPostHog();
    setProviderClient(posthogEnabled ? getPostHogClient() : undefined);
  }, [posthogEnabled]);

  const activeClient = posthogEnabled && isPostHogConfigured() ? providerClient : undefined;
  if (!activeClient) {
    return <FeatureFlagProvider posthog={undefined}>{children}</FeatureFlagProvider>;
  }
  return (
    <PostHogProvider
      client={activeClient}
      autocapture={{ captureTouches: true, captureScreens: false }}>
      <FeatureFlagProvider posthog={activeClient}>{children}</FeatureFlagProvider>
    </PostHogProvider>
  );
}

export type FeatureFlagKey =
  | 'test-feature'
  | 'shopping-category-feedback-alpha'
  | 'workout-log'
  | 'low-carb-tracking'
  | 'module-recipes'
  | 'module-meal-planner'
  | 'module-calories'
  | 'experimental-vision-camera';

export function useFeatureFlagState(key: FeatureFlagKey | undefined): boolean | undefined {
  const flags = useContext(FeatureFlagContext);
  const value = key === undefined ? undefined : flags?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function useFeatureFlag(key: FeatureFlagKey | undefined, defaultValue: boolean): boolean {
  return useFeatureFlagState(key) ?? defaultValue;
}

/**
 * Fragt alle aktiven Feature-Flags als Key-Value-Map ab.
 * Liest den vom SDK aktualisierten internen Flag-Store.
 */
export function useFeatureFlags() {
  return useContext(FeatureFlagContext);
}

export { PostHog };
