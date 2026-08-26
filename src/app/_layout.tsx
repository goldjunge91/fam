import '../global.css';
import { ObserveRoot } from 'expo-observe';

import { AppProviders } from '@/features/app-shell/app-providers';
import { initializeAppRuntime } from '@/features/app-shell/initialize-app-runtime';
import { useAppLifecycle } from '@/features/app-shell/use-app-lifecycle';
import { RootNavigator } from '@/features/navigation/root-navigator';
import { useAppDeepLinks } from '@/features/navigation/use-app-deep-links';
import { Sentry } from '@/lib/sentry';

initializeAppRuntime();

function RootLayout() {
  useAppLifecycle();
  useAppDeepLinks();

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

export default Sentry.wrap(ObserveRoot.wrap(RootLayout));
