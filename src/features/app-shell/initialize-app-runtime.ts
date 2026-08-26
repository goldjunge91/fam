import { Observe } from 'expo-observe';
import * as SplashScreen from 'expo-splash-screen';

import { initMobileAds } from '@/features/ads';
import { initAptabase } from '@/lib/analytics/aptabase';
import { initPostHog } from '@/lib/posthog';
import { initSentry } from '@/lib/sentry';
import { defineBackgroundSyncTask } from '@/lib/sync/background-sync';

/** Initialisiert Dienste, die vor dem ersten Screen-Mount bereit sein müssen. */
export function initializeAppRuntime(): void {
  SplashScreen.preventAutoHideAsync();
  defineBackgroundSyncTask();
  initSentry();
  initPostHog();
  initAptabase();
  initMobileAds();

  Observe.configure({
    integrations: { 'expo-router': true },
  });
}
