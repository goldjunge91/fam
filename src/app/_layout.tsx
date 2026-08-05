import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { queryClient, startQueryEnvironmentSync } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

/**
 * Wechselt zwischen angemeldetem und nicht angemeldetem Bereich.
 *
 * `Stack.Protected` statt manueller Redirects: Ein `router.replace()` in einem
 * Effekt muss warten, bis der Root-Layout gemountet ist, sonst laeuft die
 * Navigation ins Leere. Der Guard loest das strukturell — Expo Router
 * entscheidet beim Rendern, welche Gruppe ueberhaupt erreichbar ist.
 */
function RootNavigator() {
  const { session, isLoading } = useSession();

  useEffect(() => {
    // Splash erst ausblenden, wenn die gespeicherte Session gelesen ist. Sonst
    // sieht ein angemeldeter Nutzer beim Start kurz den Login aufblitzen.
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  // Solange geladen wird, keine Gruppe rendern: "noch unbekannt" ist nicht
  // dasselbe wie "nicht angemeldet".
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Bindet TanStack Query an AppState und Netzwerkstatus — siehe query-client.ts.
    return startQueryEnvironmentSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
