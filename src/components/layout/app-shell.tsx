import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from '@/components/icons/fam-icon';
import { FloatingActionButton } from '@/components/ui/buttons';
import { SyncBannerVisibilityProvider, SyncStatusBanner } from '@/components/ui/sync-status-banner';
import { AdBanner } from '@/features/ads';
import { DEFAULT_FAB_POSITION, useFabPosition } from '@/features/navigation/fab-position-settings';
import {
  NavigationChromeProvider,
  useNavigationChrome,
} from '@/features/navigation/navigation-chrome-provider';
import { NavigationDrawer } from '@/features/navigation/navigation-drawer';
import { ProfileSheet } from '@/features/navigation/profile-sheet';
import { SpeedDialMenu } from '@/features/navigation/speed-dial-menu';
import { useTheme } from '@/hooks/use-theme';

export default function AppShell() {
  const insets = useSafeAreaInsets();

  return (
    <NavigationChromeProvider>
      <SyncBannerVisibilityProvider>
        <SyncStatusBanner />
        <Stack screenOptions={{ headerShown: false }} />
        <NavigationDrawer />
        <ProfileSheet />
        <SpeedDialMenu />
        <GlobalAddButton />
        <View
          pointerEvents="box-none"
          className="absolute bottom-0 left-0 right-0 items-center justify-center z-10"
          style={{ paddingBottom: insets.bottom + 65 }}>
          <AdBanner placement="global_sticky" />
        </View>
      </SyncBannerVisibilityProvider>
    </NavigationChromeProvider>
  );
}

function GlobalAddButton() {
  const theme = useTheme();
  const { openQuickAdd } = useNavigationChrome();
  const insets = useSafeAreaInsets();
  const { data: position = DEFAULT_FAB_POSITION } = useFabPosition();

  return (
    <View
      pointerEvents="box-none"
      className={`app-shell-wrap ${position === 'left' ? 'items-start' : 'items-end'}`}
      // Bottom-Safe-Area ist ein echter Laufzeitwert (Geraet-abhaengig),
      // kann nicht als Tailwind-Klasse ausgedrueckt werden.
      style={{ paddingBottom: insets.bottom }}>
      <FloatingActionButton label="Neu hinzufügen" onPress={openQuickAdd}>
        <PlusIcon color={theme.onAccent} />
      </FloatingActionButton>
    </View>
  );
}
