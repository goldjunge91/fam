import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/features/auth/session-provider';
import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';
import { setTelemetryUserId } from '@/lib/telemetry';

const FEATURE_FLAG_AUTO_RELOAD_INTERVAL_MS = 12 * 60 * 60 * 1000;

export function PostHogIdentitySync() {
  const { session, isLoading } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (isLoading) return;
    setTelemetryUserId(userId);
    if (!isPostHogConfigured()) return;
    const client = getPostHogClient();
    if (!client) return;

    if (userId) {
      client.identify(userId);
    } else {
      client.reset();
    }
  }, [isLoading, userId]);

  useEffect(() => {
    // Feature-Flags beim Vordergrundwechsel aktualisieren.
    if (!isPostHogConfigured()) return;

    // Pro App-Instanz nur einmal beim Vordergrundwechsel aktualisieren.
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
