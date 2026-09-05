import { Observe } from 'expo-observe';
import * as SplashScreen from 'expo-splash-screen';
import { configureReanimatedLogger } from 'react-native-reanimated';

import { initMobileAds } from '@/features/ads';
import { initAptabase } from '@/lib/analytics/aptabase';
import { initPostHog } from '@/lib/posthog';
import { initSentry } from '@/lib/sentry';
import { defineBackgroundSyncTask } from '@/lib/sync/background-sync';
import { getStoredActiveHouseholdId } from '@/features/household/active-household-store';
import { addOrMergeShoppingItem } from '@/lib/db/shopping-list-merge';
import { getDatabase } from '@/lib/db/client';
import * as Crypto from 'expo-crypto';
import { addUserInteractionListener } from 'expo-widgets';
import { QuickAddShoppingWidget, ShoppingListWidget } from '@/widgets/shopping-list-widget';

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

  addUserInteractionListener((event) => {
    if (event.source !== 'QuickAddShoppingWidget' || event.target !== 'add-milk') return;

    void (async () => {
      const householdId = await getStoredActiveHouseholdId();
      if (!householdId) return;

      const db = await getDatabase();
      await addOrMergeShoppingItem(db, Crypto.randomUUID(), {
        household_id: householdId,
        name: 'Milch',
        quantity: 1,
        unit: 'Stück',
      });
      QuickAddShoppingWidget.reload();
      ShoppingListWidget.reload();
    })();
  });

  Observe.configure({
    integrations: { 'expo-router': true },
  });
}
