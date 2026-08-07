import { QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SyncStatusBanner } from '@/components/sync-status-banner';
import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { env } from '@/lib/env';
import { savePendingInviteToken } from '@/lib/pending-invite';
import { queryClient, startQueryEnvironmentSync } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

/**
 * Wechselt zwischen angemeldetem und nicht angemeldetem Bereich.
 *
 * Drei Faelle beim App-Start (ohne forceOnboarding):
 *
 * 1. Neuer User (Erstinstallation, kein seenOnboarding-Flag, keine Session)
 *    → direkt /onboarding (AccountStep enthält die Registrierung)
 *
 * 2. Bekannter User, ausgeloggt (seenOnboarding=true, keine Session)
 *    → (auth) Login-Screen
 *
 * 3. Eingeloggter User (Session vorhanden)
 *    → (app), dort entscheidet (app)/_layout.tsx ob Onboarding noetig ist
 *
 * Mit EXPO_PUBLIC_FORCE_ONBOARDING=true wird Fall 1 erzwungen — unabhaengig
 * vom gespeicherten Flag, um den Onboarding-Flow jederzeit testen zu koennen.
 */
function RootNavigator() {
  const { session, isLoading, seenOnboarding } = useSession();

  useEffect(() => {
    // Splash erst ausblenden, wenn Session UND Onboarding-Flag gelesen sind.
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  // Solange geladen wird, keine Gruppe rendern: "noch unbekannt" ist nicht
  // dasselbe wie "nicht angemeldet".
  if (isLoading) return null;

  const forceOnboarding = env.forceOnboarding;

  // Neuer User: kein Flag gesetzt ODER forceOnboarding aktiv → Onboarding
  const isNewUser = !seenOnboarding || forceOnboarding;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* /onboarding ist immer erreichbar — es ist der Einstieg fuer neue User
          und wird auch fuer eingeloggte User mit unvollstaendigem Profil benoetigt. */}
      <Stack.Screen name="onboarding" />

      {/* Eingeloggte User ODER neuer User (via Onboarding einloggen) */}
      <Stack.Protected guard={!!session || isNewUser}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="household" />
        <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
      </Stack.Protected>

      {/* Login-Screen: nur fuer bekannte User die sich ausgeloggt haben */}
      <Stack.Protected guard={!session && !isNewUser}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const token = parsed.queryParams?.token;
        if (typeof token === 'string' && token.trim()) {
          savePendingInviteToken(token.trim());
        }
      } catch (err) {
        console.error('Fehler beim Parsen des Deep Links:', err);
      }
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Bindet TanStack Query an AppState und Netzwerkstatus — siehe query-client.ts.
    return startQueryEnvironmentSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <SyncStatusBanner />
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
