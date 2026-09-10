import { Stack, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from '@/components/icons/fam-icon';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { FloatingActionButton } from '@/components/ui/buttons';
import { SyncBannerVisibilityProvider, SyncStatusBanner } from '@/components/ui/sync-status-banner';
import { AdBanner } from '@/features/ads';
import { useSession } from '@/features/auth/session-provider';
import { DEFAULT_FAB_POSITION, useFabPosition } from '@/features/navigation/fab-position-settings';
import {
  NavigationChromeProvider,
  useNavigationChrome,
} from '@/features/navigation/navigation-chrome-provider';
import { NavigationDrawer } from '@/features/navigation/navigation-drawer';
import { ProfileSheet } from '@/features/navigation/profile-sheet';
import { SpeedDialMenu } from '@/features/navigation/speed-dial-menu';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navigator: {
    flex: 1,
  },
  adBannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  addButtonWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    paddingHorizontal: space.lg + space.sm,
    height: 88,
  },
  addButtonWrapLeft: {
    alignItems: 'flex-start',
  },
  addButtonWrapRight: {
    alignItems: 'flex-end',
  },
});

export default function AppShell() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { session } = useSession();
  const syncEnabled = Boolean(session?.user.id);
  const isBrochureRoute = pathname === '/brochures' || pathname.includes('/brochures/');

  return (
    <View style={styles.root}>
      <NavigationChromeProvider>
        <SyncBannerVisibilityProvider enabled={syncEnabled}>
          <SyncStatusBanner enabled={syncEnabled} />
          <View style={styles.navigator}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
          <NavigationDrawer />
          <ProfileSheet />
          <SpeedDialMenu />
          {!isBrochureRoute ? <GlobalAddButton /> : null}
          {!isBrochureRoute ? (
            <View
              pointerEvents="box-none"
              style={[styles.adBannerOverlay, { paddingBottom: insets.bottom + 65 }]}>
              <AdBanner placement="global_sticky" />
            </View>
          ) : null}
        </SyncBannerVisibilityProvider>
      </NavigationChromeProvider>
    </View>
  );
}

function GlobalAddButton() {
  const { colors } = useTheme();
  const { openQuickAdd } = useNavigationChrome();
  const insets = useSafeAreaInsets();
  const { data: position = DEFAULT_FAB_POSITION } = useFabPosition();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.addButtonWrap,
        position === 'left' ? styles.addButtonWrapLeft : styles.addButtonWrapRight,
        // Bottom-Safe-Area ist ein echter Laufzeitwert (Geraet-abhaengig),
        // kann nicht als statischer Layoutwert ausgedrueckt werden.
        { paddingBottom: insets.bottom },
      ]}>
      <FloatingActionButton label="Neu hinzufügen" onPress={openQuickAdd}>
        <PlusIcon color={colors.onAccent} />
      </FloatingActionButton>
    </View>
  );
}
