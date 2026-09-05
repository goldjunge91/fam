import { Observe } from 'expo-observe';
import * as SplashScreen from 'expo-splash-screen';
import { configureReanimatedLogger } from 'react-native-reanimated';

import { initMobileAds } from '@/features/ads';
import { initAptabase } from '@/lib/analytics/aptabase';
import { initPostHog } from '@/lib/posthog';
import { initSentry } from '@/lib/sentry';
import { defineBackgroundSyncTask } from '@/lib/sync/background-sync';
import QuickAddShoppingWidget from '@/widgets/quick-add-shopping-widget';
import ShoppingListWidget from '@/widgets/shopping-list-widget';

/** Initialisiert Dienste, die vor dem ersten Screen-Mount bereit sein müssen. */
export function initializeAppRuntime(): void {
  configureReanimatedLogger({ strict: false });
  SplashScreen.preventAutoHideAsync();
  defineBackgroundSyncTask();
  initSentry();
  initPostHog();
  initAptabase();
  initMobileAds();
  ShoppingListWidget.updateSnapshot({ openCount: 0 });
  QuickAddShoppingWidget.updateSnapshot({ articleName: 'Milch hinzufügen' });

  Observe.configure({
    integrations: { 'expo-router': true },
  });
}
