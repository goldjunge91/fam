import { useObserve } from 'expo-observe';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useSession } from '@/features/auth/session-provider';
import { getDatabase } from '@/lib/db/client';
import { env } from '@/lib/env';
import { initOffDump } from '@/lib/off-dump/off-dump';

/** Wechselt zwischen Onboarding, Auth und den sessiongeschützten App-Routen. */
export function RootNavigator() {
  const { session, isLoading, seenOnboarding } = useSession();
  const { markInteractive } = useObserve();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
      markInteractive();
    }
  }, [isLoading, markInteractive]);

  useEffect(() => {
    if (!session?.user.id) return;
    getDatabase()
      .then((database) => initOffDump(database))
      .catch((error) => {
        console.warn('[OffDump] Laden/Anhaengen fehlgeschlagen:', error);
      });
  }, [session?.user.id]);

  if (isLoading) return null;

  const isNewUser = !seenOnboarding || env.forceOnboarding;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />

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
        <Stack.Screen name="meal-planner/shopping-needs" />
        <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-product" />
        <Stack.Screen name="add-food-entry" options={{ presentation: 'modal' }} />
      </Stack.Protected>

      <Stack.Protected guard={!session && !isNewUser}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
