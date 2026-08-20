import '../global.css';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Linking from 'expo-linking';
import { Observe, ObserveRoot, useObserve } from 'expo-observe';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useNavigationContainerRef,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/icons/animated-icon';
import { SnackbarProvider } from '@/components/ui/snackbar';
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
import { initSentry, navigationIntegration, Sentry } from '@/lib/sentry';
import { getSupabase } from '@/lib/supabase';
import { defineBackgroundSyncTask, registerBackgroundSync } from '@/lib/sync/background-sync';

SplashScreen.preventAutoHideAsync();
defineBackgroundSyncTask();
initSentry();

// Muss vor dem ersten Screen-Mount laufen — configure() nach dem Mount wirft.
// Aktiviert automatische cold_ttr/warm_ttr pro Route (Expo Router Integration).
Observe.configure({
  integrations: { 'expo-router': true },
});

/**
 * Letzter Auffangnetz fuer Render-Fehler, die `Sentry.wrap()` selbst nicht
 * abfaengt (das legt nur Touch-/Profiling-Boundaries um die App, keinen
 * React-Error-Boundary — siehe `@sentry/react-native`s `wrap()`). Bewusst
 * ohne Abhaengigkeit zu Theme/Providern: Der Fehler kann aus jeder Ebene
 * darunter kommen, dieser Screen darf selbst nicht mitreissen koennen.
 */
function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={crashStyles.container}>
      <Text style={crashStyles.title}>Etwas ist schiefgelaufen</Text>
      <Text style={crashStyles.body}>
        Die App ist auf einen unerwarteten Fehler gestossen. Der Fehler wurde erfasst.
      </Text>
      <Pressable onPress={resetError} style={crashStyles.button}>
        <Text style={crashStyles.buttonText}>Erneut versuchen</Text>
      </Pressable>
    </View>
  );
}

const crashStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8F4EF',
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '600', color: '#2D2830' },
  body: { fontSize: 14, color: '#2D2830', textAlign: 'center' },
  button: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10 },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2830',
    textDecorationLine: 'underline',
  },
});

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
  const { markInteractive } = useObserve();

  useEffect(() => {
    // Splash erst ausblenden, wenn Session UND Onboarding-Flag gelesen sind.
    // Ab hier ist der Screen fuer den User tatsaechlich interaktiv (TTI).
    if (!isLoading) {
      SplashScreen.hideAsync();
      markInteractive();
    }
  }, [isLoading, markInteractive]);

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

function RootLayout() {
  const colorScheme = useColorScheme();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    // Verbindet die in `@/lib/sentry` erzeugte Integration einmalig mit dem
    // tatsaechlichen Router-Container — erst ab hier liefert Sentry
    // Navigations-Breadcrumbs und -Spans.
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

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
    <Sentry.ErrorBoundary fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
      {/* react-native-gesture-handler hat kein cssInterop, className wuerde hier
      stillschweigend verworfen — deshalb bleibt style hier bewusst bestehen. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Muss die gesamte App umschliessen, damit KeyboardAwareScrollView &
            Co. (z. B. im Onboarding-Haushalt-Schritt) ueberall funktionieren. */}
        <KeyboardProvider>
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
        </KeyboardProvider>
      </GestureHandlerRootView>
    </Sentry.ErrorBoundary>
  );
}

// Sentry.wrap() haengt nur Touch-/Profiling-Boundaries um die App (kein
// automatisches Navigations-Tracking trotz des Namens — dafuer sorgt die
// `navigationIntegration` oben, registriert im RootLayout-Body). Ohne DSN
// (initSentry() ist dann ein No-op) macht der Wrapper nichts weiter, als die
// Komponente durchzureichen. ObserveRoot.wrap() darunter misst Time to First
// Render (TTR) fuer EAS Observe.
export default Sentry.wrap(ObserveRoot.wrap(RootLayout));
