import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';
import { useSession } from './session-provider';

/** Synchronisiert den PostHog-Nutzer und aktualisiert Flags im Vordergrund. */
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
    // Das SDK aktualisiert Flags im Vordergrund nicht automatisch.
    if (!isPostHogConfigured()) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        getPostHogClient()?.reloadFeatureFlags();
      }
    });

    return () => subscription.remove();
  }, []);

  return null;
}
