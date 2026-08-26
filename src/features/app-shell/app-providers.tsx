import { BugBubble } from '@lokal-dev/react-native-bugbubble';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/icons/animated-icon';
import { SnackbarProvider } from '@/components/ui/snackbar';
import { PostHogIdentitySync } from '@/features/auth/posthog-identity-sync';
import { SessionProvider } from '@/features/auth/session-provider';
import { ActiveHouseholdProvider } from '@/features/household/active-household-provider';
import { PremiumProvider } from '@/features/premium/premium-provider';
import { ScreenTracker } from '@/lib/analytics';
import { env } from '@/lib/env';
import { PostHogAppProvider } from '@/lib/posthog';
import { asyncStoragePersister, queryClient, shouldPersistQuery } from '@/lib/query-client';
import { Sentry } from '@/lib/sentry';

import { CrashFallback } from './crash-fallback';

/** Hält die globale Provider-Reihenfolge an einem Ort fest. */
export function AppProviders({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <Sentry.ErrorBoundary
        fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
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
                  <ScreenTracker />
                  <ActiveHouseholdProvider>
                    <PremiumProvider>
                      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                        <SnackbarProvider>
                          <AnimatedSplashOverlay />
                          {children}
                          {env.devTools ? <BugBubble /> : null}
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
