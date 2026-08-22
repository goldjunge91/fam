import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';
import { useSession } from './session-provider';

/**
 * Mindestabstand zwischen zwei Foreground-Reloads der Feature-Flags. Ohne ihn
 * loesen ein Control-Center-Zug, ein Berechtigungs-Dialog oder ein App-
 * Switcher-Blick je einen vollen Netzwerk-Roundtrip aus. Flags aendern sich
 * selten — ein Reload pro Minute reicht.
 */
const FEATURE_FLAG_RELOAD_MIN_INTERVAL_MS = 60_000;

/**
 * Bindet den PostHog-`distinctId` an die Supabase-User-ID (nicht an die
 * Haushalt-ID, siehe Issue #183) — PostHog ist personen-zentriert, Prozent-
 * Rollouts und Zielgruppen-Targeting laufen ueber diesen `distinctId`. Laedt
 * ausserdem Feature-Flags neu, sobald die App in den Vordergrund kommt.
 *
 * Muss innerhalb von `<SessionProvider>` UND `<PostHogProvider>` gemountet
 * sein (siehe `src/app/_layout.tsx`). Rendert nichts, ist reiner Sync-Effekt.
 *
 * Waehrend `isLoading` bleibt der `distinctId` unangetastet — sonst wuerde
 * ein bereits eingeloggter Nutzer beim App-Start kurz einen `reset()`
 * abbekommen, bevor die gespeicherte Session gelesen ist.
 */
export function PostHogIdentitySync() {
  const { session, isLoading } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (isLoading || !isPostHogConfigured()) return;
    const client = getPostHogClient();
    if (!client) return;

    if (userId) {
      client.identify(userId);
    } else {
      client.reset();
    }
  }, [isLoading, userId]);

  useEffect(() => {
    // Das SDK laedt Feature-Flags NUR bei Client-Init, `identify()` mit
    // geaenderter distinctId, `reset()` oder manuellem `reloadFeatureFlags()`
    // neu — kein automatisches Polling, kein Reload beim Foreground (siehe
    // posthog-react-native-Quelltext). Ohne diesen Listener wuerde ein im
    // PostHog-Dashboard umgeschaltetes Flag einen bereits eingeloggten
    // Nutzer nie erreichen, bevor er sich aus- und wieder einloggt.
    if (!isPostHogConfigured()) return;

    // Nur ein echter Wechsel aus dem Hintergrund/inaktiv zurueck in den
    // Vordergrund loest einen Reload aus — ein erneutes `active`-Event ohne
    // vorheriges Backgrounding wird ignoriert. Der Mindestabstand deckelt
    // zusaetzlich rasche Unterbrechungen (Control Center, Dialoge).
    let previousState = AppState.currentState;
    let lastReloadAt = 0;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const cameToForeground =
        (previousState === 'background' || previousState === 'inactive') && nextState === 'active';
      previousState = nextState;
      if (!cameToForeground) return;

      const now = Date.now();
      if (now - lastReloadAt < FEATURE_FLAG_RELOAD_MIN_INTERVAL_MS) return;
      lastReloadAt = now;

      getPostHogClient()?.reloadFeatureFlags();
    });

    return () => subscription.remove();
  }, []);

  return null;
}
