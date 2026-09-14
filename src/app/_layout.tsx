import { ObserveRoot } from 'expo-observe';

import { ScreenshotDriver } from '@/components/ScreenshotDriver';
import { AppProviders } from '@/features/app-shell/app-providers';
import { initializeAppRuntime } from '@/features/app-shell/initialize-app-runtime';
import { useAppLifecycle } from '@/features/app-shell/use-app-lifecycle';
import { RootNavigator } from '@/features/navigation/root-navigator';
import { useAppDeepLinks } from '@/features/navigation/use-app-deep-links';
import '@/i18n';
import { Sentry } from '@/lib/observability/providers/sentry';
import { PerformanceMonitorDevTools } from '@/lib/optionals/PerformanceMonitorDevTools';
import { RozeniteDevTools } from '@/lib/optionals/RozeniteDevTools';

initializeAppRuntime();

function RootLayout() {
  useAppLifecycle();
  useAppDeepLinks();

  return (
    <AppProviders>
      <RootNavigator />

      {__DEV__ && (
        <>
          <ScreenshotDriver />
          <PerformanceMonitorDevTools />
          <RozeniteDevTools />
        </>
      )}
    </AppProviders>
  );
}

export default Sentry.wrap(ObserveRoot.wrap(RootLayout));
