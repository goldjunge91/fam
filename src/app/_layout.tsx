import '../global.css';
import { ObserveRoot } from 'expo-observe';

import { ScreenshotDriver } from '@/components/ScreenshotDriver';
import { AppProviders } from '@/features/app-shell/app-providers';
import { initializeAppRuntime } from '@/features/app-shell/initialize-app-runtime';
import { useAppLifecycle } from '@/features/app-shell/use-app-lifecycle';
import { RootNavigator } from '@/features/navigation/root-navigator';
import { useAppDeepLinks } from '@/features/navigation/use-app-deep-links';
import { env } from '@/lib/env';
import { Sentry } from '@/lib/sentry';

initializeAppRuntime();

// Stack.Protected allein steuert nur, welche Screens erreichbar sind, nicht wo
// der Router startet -- ohne initialRouteName oeffnet Expo Router weiter die
// zuletzt aktive/persistierte Route statt Storybook.
export const unstable_settings = {
  initialRouteName: env.storybookEnabled ? '(storybook)/index' : undefined,
};

function RootLayout() {
  useAppLifecycle();
  useAppDeepLinks();

  return (
    <AppProviders>
      <RootNavigator />
      {__DEV__ && <ScreenshotDriver />}
    </AppProviders>
  );
}

export default Sentry.wrap(ObserveRoot.wrap(RootLayout));
