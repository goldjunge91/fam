import { Observe } from 'expo-observe';
import * as SplashScreen from 'expo-splash-screen';
import { configureReanimatedLogger } from 'react-native-reanimated';

import { initMobileAds } from '@/features/ads';
import { initAptabase } from '@/lib/analytics/aptabase';
import { markPerformance, startPerformanceSpan } from '@/lib/observability/performance';
import { initPostHog } from '@/lib/observability/providers/posthog';
import { initSentry } from '@/lib/observability/providers/sentry';
import QuickAddShoppingWidget from '@/widgets/quick-add-shopping-widget';
import ShoppingListWidget from '@/widgets/shopping-list-widget';

/** Initialisiert Foreground-Dienste genau einmal nach dem Root-Mount. */
let initialized = false;

export function initializeAppRuntime(): void {
  if (initialized) return;
  initialized = true;

  markPerformance('app.start', { phase: 'startup' });
  const finishPerformance = startPerformanceSpan('app.runtime.initialization', {
    phase: 'startup',
  });

  try {
    configureReanimatedLogger({ strict: false });
    SplashScreen.preventAutoHideAsync();
    initSentry();
    initPostHog();
    initAptabase();
    initMobileAds();
    ShoppingListWidget.updateSnapshot({ openCount: 0 });
    QuickAddShoppingWidget.updateSnapshot({ articleName: 'Milch hinzufügen' });

    Observe.configure({
      integrations: { 'expo-router': true },
    });

    finishPerformance('completed', { initialized: true });
  } catch (error) {
    initialized = false;
    finishPerformance('failed', { initialized: false });
    throw error;
  }
}
