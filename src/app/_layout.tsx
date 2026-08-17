import '../global.css';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SnackbarProvider } from '@/components/snackbar';
import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { PremiumProvider } from '@/features/premium/premium-provider';
import { parseAuthErrorFromUrl, parseAuthTokensFromUrl } from '@/lib/auth-deep-link';
import { setAuthDeepLinkError } from '@/lib/auth-deep-link-state';
import { getDatabase } from '@/lib/db/client';
import { env } from '@/lib/env';
import { initOffDump } from '@/lib/off-dump/off-dump';
import { savePendingInviteToken } from '@/lib/pending-invite';
import {
  asyncStoragePersister,
  queryClient,
  shouldPersistQuery,
  startQueryEnvironmentSync,
} from '@/lib/query-client';
import { getSupabase } from '@/lib/supabase';
import { defineBackgroundSyncTask, registerBackgroundSync } from '@/lib/sync/background-sync';

SplashScreen.preventAutoHideAsync();
defineBackgroundSyncTask();

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: session?.user.id ist absichtlich der Re-Attach-Trigger, obwohl der Effekt-Body sie nicht direkt liest.
  useEffect(() => {
    // Laedt den lokalen OpenFoodFacts-Dump (#79 + Dump-CI-Workflow) und
    // haengt ihn an — nie blockierend fuer den App-Start, ein Fehlschlag
    // (kein Netz, kein Development Build mit expo-file-system) darf die App
    // nicht aufhalten, die Suche faellt dann einfach auf online/den eigenen
    // Produkt-Cache zurueck. Haengt an `session?.user.id` statt an `[]`: nur
    // so laeuft der Re-Attach nach einem Nutzerwechsel (Logout/Login setzt
    // `attachedThisSession` in `client.ts` zurueck) erneut an.
    getDatabase()
      .then((db) => initOffDump(db))
      .catch((err) => {
        console.warn('[OffDump] Laden/Anhaengen fehlgeschlagen:', err);
      });
  }, [session?.user.id]);

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
        <Stack.Screen name="food-search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-food-entry" options={{ presentation: 'modal' }} />
      </Stack.Protected>

      {/* Login-Screen: nur fuer bekannte User die sich ausgeloggt haben */}
      <Stack.Protected guard={!session && !isNewUser}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

import { ActiveHouseholdProvider } from '@/features/household/active-household-provider';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;
      try {
        // Bestaetigungs-/Passwort-Reset-Links tragen die Session im
        // URL-Fragment (impliziter Flow, siehe auth-deep-link.ts). Das muss
        // vor Linking.parse() geprueft werden — parse() wertet nur Pfad und
        // Query aus, das Fragment ignoriert es.
        const tokens = parseAuthTokensFromUrl(url);
        if (tokens) {
          getSupabase()
            .auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
            })
            .catch((err) => {
              console.error('Fehler beim Anwenden der Deep-Link-Session:', err);
              setAuthDeepLinkError(
                'Die Anmeldung ueber den Link hat nicht geklappt. Gib stattdessen den 6-stelligen Code aus der E-Mail ein.',
              );
            });
          return;
        }

        const authError = parseAuthErrorFromUrl(url);
        if (authError) {
          // Der haeufigste Fall ist ein bereits eingeloester Link ("Email link
          // is invalid or has expired"): Der Bestaetigungs-Token gilt genau
          // einmal, jeder weitere Klick scheitert zwangslaeufig. Frueher endete
          // das hier in einem console.warn und der Nutzer sass ohne Hinweis in
          // einem Wartezustand fest, der sich nie mehr aufloeste. Jetzt
          // erreicht die Meldung den PendingAuthBanner samt Ausweg.
          console.warn('Deep Link meldet einen Auth-Fehler:', authError);
          setAuthDeepLinkError(authError);
          return;
        }

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

  useEffect(() => {
    // Registriert die Hintergrund-Task beim OS (#50) — einmalig pro App-Leben,
    // unabhaengig vom aktiven Haushalt. Der eigentliche Sync-Handler kommt aus
    // useRealtimeSync in (app)/_layout.tsx, sobald ein Haushalt aktiv ist;
    // bis dahin ist die Task registriert, aber ihr Handler ist null (No-op).
    registerBackgroundSync().catch((err) => {
      console.warn('[BackgroundSync] Registrierung fehlgeschlagen:', err);
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: asyncStoragePersister,
          dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
        }}>
        <SessionProvider>
          <ActiveHouseholdProvider>
            <PremiumProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <SnackbarProvider>
                  <AnimatedSplashOverlay />
                  <RootNavigator />
                </SnackbarProvider>
              </ThemeProvider>
            </PremiumProvider>
          </ActiveHouseholdProvider>
        </SessionProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
