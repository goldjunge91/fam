import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { trackAnalyticsEvent } from '@/lib/analytics/events';
import { addDiagnosticStep } from '@/lib/telemetry';
import { recordSessionRoute } from '@/lib/telemetry/session-diagnostics';

const SAFE_SCREEN_NAMES: Record<string, string> = {
  '/': 'home',
  '/index': 'home',
  '/fridge': 'fridge',
  '/inventory': 'inventory',
  '/shopping-list': 'shopping_list',
  '/recipes': 'recipes',
  '/meal-planner': 'meal_planner',
  '/food-search': 'food_search',
  '/settings': 'settings',
  '/settings/privacy': 'settings_privacy',
  '/settings/export': 'settings_export',
  '/settings/sync': 'settings_sync',
};

/** Reduziert Routerpfade auf eine kleine Allowlist ohne IDs oder private Screen-Namen. */
export function sanitizeScreenName(pathname: string): string | undefined {
  const pathWithoutQuery = pathname.split(/[?#]/, 1)[0] ?? pathname;
  const normalizedPath = pathWithoutQuery.replace(/\/\([^/]+\)/g, '') || '/';
  return SAFE_SCREEN_NAMES[normalizedPath];
}

export function ScreenTracker(): null {
  const pathname = usePathname();
  const currentPathnameRef = useRef<string | null>(null);
  const currentScreenRef = useRef<string | null>(null);
  const screenStartTimeRef = useRef<number | null>(null);

  const endCurrentScreenSession = useCallback(() => {
    const screen = currentScreenRef.current;
    const startTime = screenStartTimeRef.current;

    if (screen && startTime !== null) {
      const elapsedMs = Date.now() - startTime;
      const durationSeconds = Math.max(1, Math.round(elapsedMs / 1000));

      trackAnalyticsEvent('screen.leave.completed', {
        screen,
        duration_seconds: durationSeconds,
      });

      screenStartTimeRef.current = null;
    }
  }, []);

  const startScreenSession = useCallback((nextPathname: string) => {
    currentPathnameRef.current = nextPathname;
    const screen = sanitizeScreenName(nextPathname);
    currentScreenRef.current = screen ?? null;
    screenStartTimeRef.current = screen ? Date.now() : null;

    if (!screen) return;

    recordSessionRoute(screen);
    addDiagnosticStep('route.changed', { route: screen, operation: 'navigation.route' });
    trackAnalyticsEvent('screen.view.completed', { screen });
  }, []);

  // Reagiert auf Pfadwechsel im Expo Router
  useEffect(() => {
    if (!pathname || currentPathnameRef.current === pathname) return;

    endCurrentScreenSession();
    startScreenSession(pathname);
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
