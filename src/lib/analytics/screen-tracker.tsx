import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { trackAnalyticsEvent } from '@/lib/analytics/events';
import { getPostHogClient, isPostHogConfigured } from '@/lib/posthog';

export function ScreenTracker(): null {
  const pathname = usePathname();
  const currentScreenRef = useRef<string | null>(null);
  const screenStartTimeRef = useRef<number | null>(null);

  const endCurrentScreenSession = useCallback(() => {
    const screen = currentScreenRef.current;
    const startTime = screenStartTimeRef.current;

    if (screen && startTime !== null) {
      const elapsedMs = Date.now() - startTime;
      const durationSeconds = Math.max(1, Math.round(elapsedMs / 1000));

      trackAnalyticsEvent('screen_leave', {
        screen,
        duration_seconds: durationSeconds,
      });

      screenStartTimeRef.current = null;
    }
  }, []);

  const startScreenSession = useCallback((screen: string) => {
    currentScreenRef.current = screen;
    screenStartTimeRef.current = Date.now();

    // 1. Universelles Analytics Event (Aptabase & PostHog)
    trackAnalyticsEvent('screen_view', { screen });

    // 2. Natives PostHog Screen-Tracking
    if (isPostHogConfigured()) {
      try {
        const client = getPostHogClient();
        client?.screen(screen, { $screen_name: screen });
      } catch (err) {
        if (__DEV__) {
          console.warn('[screen-tracker] PostHog screen() Aufruf fehlgeschlagen:', err);
        }
      }
    }
  }, []);

  // Reagiert auf Pfadwechsel im Expo Router
  useEffect(() => {
    if (!pathname) return;

    if (currentScreenRef.current !== pathname) {
      endCurrentScreenSession();
      startScreenSession(pathname);
    }
  }, [pathname, endCurrentScreenSession, startScreenSession]);

  // Reagiert auf AppState (z. B. wenn App in den Hintergrund geht oder zurueckkehrt)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (pathname && screenStartTimeRef.current === null) {
          startScreenSession(pathname);
        }
      } else {
        // 'background' oder 'inactive' -> Session pausieren und bisherige Zeit erfassen
        endCurrentScreenSession();
      }
    });

    return () => {
      endCurrentScreenSession();
      subscription.remove();
    };
  }, [pathname, endCurrentScreenSession, startScreenSession]);

  return null;
}
