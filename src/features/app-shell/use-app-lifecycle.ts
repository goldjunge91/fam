import { useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';

import { startQueryEnvironmentSync } from '@/lib/query-client';
import { navigationIntegration } from '@/lib/sentry';
import { registerBackgroundSync } from '@/lib/sync/background-sync';

/** Verbindet einmalige App-Lifecycle-Dienste mit dem gemounteten Root-Layout. */
export function useAppLifecycle(): void {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  useEffect(() => startQueryEnvironmentSync(), []);

  useEffect(() => {
    registerBackgroundSync().catch((error) => {
      console.warn('[BackgroundSync] Registrierung fehlgeschlagen:', error);
    });
  }, []);
}
