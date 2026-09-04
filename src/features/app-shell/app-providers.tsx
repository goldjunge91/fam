import { BugBubble, type BugBubbleConfig } from '@lokal-dev/react-native-bugbubble';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider as RouterThemeProvider } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/icons/animated-icon';
import { ThemeProvider as FamThemeProvider, useTheme } from '@/components/theme/ThemeProvider';
import { SnackbarProvider } from '@/components/ui/snackbar';
import { PostHogIdentitySync } from '@/features/app-shell/posthog-identity-sync';
import { SessionProvider } from '@/features/auth/session-provider';
import { ActiveHouseholdProvider } from '@/features/household/active-household-provider';
import { PremiumProvider } from '@/features/premium/premium-provider';
import { ScreenTracker } from '@/lib/analytics';
import { env } from '@/lib/env';
import { PostHogAppProvider } from '@/lib/posthog';
import { queryClient, removeLegacyPersistedQueryCache } from '@/lib/query-client';
import { loadShotsFlag } from '@/lib/screenshots';
import { Sentry } from '@/lib/sentry';
import { reportCapturedError } from '@/lib/telemetry';

import { CrashFallback } from './crash-fallback';

const BUG_BUBBLE_CONFIG = {
  trackingOptions: {
    enabled: true,
    options: { console: false },
  },
} satisfies Partial<BugBubbleConfig>;

/** Hält die globale Provider-Reihenfolge an einem Ort fest. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [screenshotMode, setScreenshotMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadShotsFlag().then((config) => {
      if (mounted) setScreenshotMode(config?.enabled === true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Beim App-Start best effort; beim Account-Cleanup ist derselbe Fehler
    // dagegen essentiell und wird von clearLocalAccountData weitergereicht.
    void removeLegacyPersistedQueryCache().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <Sentry.ErrorBoundary
        onError={(error) =>
          reportCapturedError(error, {
            operation: 'react.error_boundary',
            error_code: 'react_error_boundary',
          })
        }
        fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <QueryClientProvider client={queryClient}>
              <SessionProvider>
                <PostHogAppProvider>
                  <PostHogIdentitySync />
                  <ScreenTracker />
                  <ActiveHouseholdProvider>
                    <PremiumProvider>
                      <FamThemeProvider>
                        <ThemeRuntime screenshotMode={screenshotMode}>{children}</ThemeRuntime>
                      </FamThemeProvider>
                    </PremiumProvider>
                  </ActiveHouseholdProvider>
                </PostHogAppProvider>
              </SessionProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </Sentry.ErrorBoundary>
    </SafeAreaProvider>
  );
}

function ThemeRuntime({
  children,
  screenshotMode,
}: {
  children: ReactNode;
  screenshotMode: boolean;
}) {
  const { mode } = useTheme();

  return (
    <RouterThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <SnackbarProvider>
        <AnimatedSplashOverlay />
        {children}
        {env.devTools && !screenshotMode ? <BugBubble config={BUG_BUBBLE_CONFIG} /> : null}
      </SnackbarProvider>
    </RouterThemeProvider>
  );
}
