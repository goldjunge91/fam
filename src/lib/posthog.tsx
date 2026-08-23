import PostHog, {
  PostHogProvider,
  useFeatureFlag as usePostHogFeatureFlagSdk,
} from 'posthog-react-native';
import type { ReactNode } from 'react';

import { env } from '@/lib/env';

let client: PostHog | undefined;
let attempted = false;

/** Initialisiert PostHog einmalig und faellt bei Fehlern auf deaktivierte Flags zurueck. */
export function initPostHog(): void {
  if (attempted) return;
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
    client = new PostHog(apiKey, { host: env.posthogHost });
  } catch (err) {
    console.error('[posthog] Client-Konstruktion fehlgeschlagen — Tracking bleibt aus:', err);
  }
}

export function isPostHogConfigured(): boolean {
  return client !== undefined;
}

export function getPostHogClient(): PostHog | undefined {
  return client;
}

export function PostHogAppProvider({ children }: { children: ReactNode }): ReactNode {
  if (!isPostHogConfigured() || !client) return children;
  return <PostHogProvider client={client}>{children}</PostHogProvider>;
}

/** Muss den Keys im PostHog-Dashboard entsprechen. Modul-Flags sind Einschalt-Gates. */
export type FeatureFlagKey =
  | 'test-feature'
  | 'workout-log'
  | 'low-carb-tracking'
  | 'module-recipes'
  | 'module-meal-planner'
  | 'module-calories';

/** `undefined` bedeutet: nicht konfiguriert oder noch nicht geladen. */
export function useFeatureFlagState(key: FeatureFlagKey | undefined): boolean | undefined {
  const value = usePostHogFeatureFlagSdk(key ?? '__no_flag_key__');
  if (key === undefined || value === undefined) return undefined;
  return value === true;
}

export function useFeatureFlag(key: FeatureFlagKey | undefined, defaultValue: boolean): boolean {
  return useFeatureFlagState(key) ?? defaultValue;
}

export { PostHog };
