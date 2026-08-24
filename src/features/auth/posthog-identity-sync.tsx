import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';
import { useSession } from './session-provider';

const FEATURE_FLAG_AUTO_RELOAD_INTERVAL_MS = 12 * 60 * 60 * 1000;

/**
 * Bindet den PostHog-`distinctId` an die Supabase-User-ID (nicht an die
 * Haushalt-ID, siehe Issue #183) — PostHog ist personen-zentriert, Prozent-
 * Rollouts und Zielgruppen-Targeting laufen ueber diesen `distinctId`. Laedt
 * ausserdem Feature-Flags hoechstens alle 12 Stunden bei der Rueckkehr in den
 * Vordergrund neu.
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

    // Der Client laedt Flags bereits beim Start. Das Zeitfenster lebt deshalb
    // bewusst nur fuer die aktuelle App-Instanz; nach einem Neustart darf die
    // Initialisierung wieder sofort aktuelle Flags holen.
    let lastAutomaticReloadAt = Date.now();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;

      const now = Date.now();
      if (now - lastAutomaticReloadAt < FEATURE_FLAG_AUTO_RELOAD_INTERVAL_MS) return;

      // Mark before invoking the SDK so a burst of AppState events cannot
      // enqueue multiple requests.
      lastAutomaticReloadAt = now;
      getPostHogClient()?.reloadFeatureFlags();
    });

    return () => subscription.remove();
  }, []);

  return null;
}
