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
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/icons/animated-icon';
import { SnackbarProvider } from '@/components/ui/snackbar';
import { PostHogIdentitySync } from '@/features/auth/posthog-identity-sync';
import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { PremiumProvider } from '@/features/premium/premium-provider';
import { parseAuthErrorFromUrl, parseAuthTokensFromUrl } from '@/lib/auth-deep-link';
import { setAuthDeepLinkError } from '@/lib/auth-deep-link-state';
import { getDatabase } from '@/lib/db/client';
import { env } from '@/lib/env';
import { initOffDump } from '@/lib/off-dump/off-dump';
import { savePendingInviteToken } from '@/lib/pending-invite';
import { initPostHog, PostHogAppProvider } from '@/lib/posthog';
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
initPostHog();

// Muss vor dem ersten Screen-Mount laufen.
Observe.configure({
  integrations: { 'expo-router': true },
});

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

function RootNavigator() {
  const { session, isLoading, seenOnboarding } = useSession();
  const { markInteractive } = useObserve();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
      markInteractive();
    }
  }, [isLoading, markInteractive]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: session?.user.id ist absichtlich der Re-Attach-Trigger, obwohl der Effekt-Body sie nicht direkt liest.
  useEffect(() => {
    // Nutzerwechsel erfordern ein erneutes Attach; Fehler blockieren den Start nicht.
    getDatabase()
      .then((db) => initOffDump(db))
      .catch((err) => {
        console.warn('[OffDump] Laden/Anhaengen fehlgeschlagen:', err);
      });
  }, [session?.user.id]);

  if (isLoading) return null;

  const forceOnboarding = env.forceOnboarding;

  const isNewUser = !seenOnboarding || forceOnboarding;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />

      <Stack.Protected guard={!!session || isNewUser}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="household" />
        <Stack.Screen name="add-item" options={{ presentation: 'modal' }} />
        <Stack.Screen name="food-search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add-food-entry" options={{ presentation: 'modal' }} />
      </Stack.Protected>

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
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;
      try {
        // `Linking.parse` ignoriert die Auth-Tokens im URL-Fragment.
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
    return startQueryEnvironmentSync();
  }, []);

  useEffect(() => {
    registerBackgroundSync().catch((err) => {
      console.warn('[BackgroundSync] Registrierung fehlgeschlagen:', err);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <Sentry.ErrorBoundary
        fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
        {/* react-native-gesture-handler unterstuetzt hier kein className. */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: asyncStoragePersister,
                dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
              }}>
              <SessionProvider>
                <PostHogAppProvider>
                  <PostHogIdentitySync />
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
                </PostHogAppProvider>
              </SessionProvider>
            </PersistQueryClientProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </Sentry.ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(ObserveRoot.wrap(RootLayout));
