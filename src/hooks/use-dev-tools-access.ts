import { env } from '@/lib/config/env';
import { useFeatureFlag } from '@/lib/observability/providers/posthog';

/**
 * Bestimmt, ob die Entwickler-Werkzeuge auf dem aktuellen Gerät/Benutzer freigeschaltet sind.
 *
 * - In lokaler Entwicklung (__DEV__): Aktiv, wenn `env.devTools` gesetzt ist oder das PostHog-Flag aktiv ist.
 * - In Preview & Production (!__DEV__): Ausschließlich freigeschaltet über das PostHog-Feature-Flag 'dev-tools'.
 */
export function useDevToolsAccess(): boolean {
  const isPostHogDevToolsEnabled = useFeatureFlag('dev-tools', false);

  if (__DEV__) {
    return env.devTools || isPostHogDevToolsEnabled;
  }

  return isPostHogDevToolsEnabled;
}
