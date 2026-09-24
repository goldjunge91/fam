import { useObserve } from 'expo-observe';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { CrashFallback } from '@/features/app-shell/crash-fallback';
import { useSession } from '@/features/auth/session-provider';
import { isOnboardingSessionCompleted } from '@/features/onboarding/onboarding-completion';
import { env } from '@/lib/config/env';
import { getDatabase } from '@/lib/db/client';
import { debugLog, debugWarn } from '@/lib/observability/debug-log';
import { initOffDump } from '@/lib/off-dump/off-dump';

/** Wechselt zwischen Onboarding, Auth und den sessiongeschützten App-Routen. */
export function RootNavigator() {
  const { session, accountReady, isLoading, seenOnboarding, error, retry } = useSession();
  const { markInteractive } = useObserve();
  const pathname = usePathname();
  const [forceOnboardingRouted, setForceOnboardingRouted] = useState(
    () => !env.forceOnboarding || pathname === '/onboarding',
  );

  useEffect(() => {
    if (env.forceOnboarding && pathname === '/onboarding') {
      setForceOnboardingRouted(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isLoading) {
      markInteractive();
    }
  }, [isLoading, markInteractive]);

  useEffect(() => {
    if (!session?.user.id || !accountReady || isLoading || error) return;
    if (__DEV__) debugLog('[OFFTRACE:ROOT-START]', { hasSession: true });
    getDatabase()
      .then((database) => {
        if (__DEV__) debugLog('[OFFTRACE:ROOT-DB-READY]');
        return initOffDump(database);
      })
      .then(() => {
        if (__DEV__) debugLog('[OFFTRACE:ROOT-OK]');
      })
      .catch((error) => {
        if (__DEV__) {
          debugWarn('[OFFTRACE:ROOT-FAIL]', { error });
        }
        debugWarn('[OffDump] Laden/Anhaengen fehlgeschlagen:', error);
      });
  }, [accountReady, error, isLoading, session?.user.id]);

  if (isLoading) return null;
  if (error) return <CrashFallback resetError={retry} />;

  // Der Dev-Override gilt nur bis zum Abschluss in dieser App-Sitzung:
  // Neustarts erzwingen den Flow erneut, der Dashboard-Übergang bleibt möglich.
  const forceOnboarding = env.forceOnboarding && !isOnboardingSessionCompleted();
  const isNewUser = !seenOnboarding || forceOnboarding;
  // Developer tools may exercise the real auth screens without changing the production guard.
  const authPreviewEnabled = __DEV__ && env.devTools;

  if (env.forceOnboarding && !forceOnboardingRouted && pathname !== '/onboarding') {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session || isNewUser}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      {/* (app) behält den bestehenden Onboarding-Einstieg für Erstnutzer. */}
      <Stack.Protected guard={!!session || isNewUser}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      {/* Haushalts- und Privatdaten benötigen immer eine echte Session. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="household" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="recipe" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="gamification" />
        <Stack.Screen name="meal-planner/shopping-needs" />
        <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="shopping-list-add-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-product" />
        <Stack.Screen name="add-food-entry" options={{ presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={(!session && !isNewUser) || authPreviewEnabled}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
