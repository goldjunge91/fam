import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from '@/components/fam-icon';
import { SyncStatusBanner } from '@/components/sync-status-banner';
import { FloatingActionButton } from '@/components/ui/buttons';
import { Layout } from '@/constants/theme';
import {
  NavigationChromeProvider,
  useNavigationChrome,
} from '@/features/navigation/navigation-chrome-provider';
import { NavigationDrawer } from '@/features/navigation/navigation-drawer';
import { ProfileSheet } from '@/features/navigation/profile-sheet';
import { QuickAddSheet } from '@/features/navigation/quick-add-sheet';
import { useTheme } from '@/hooks/use-theme';

export default function AppShell() {
  return (
    <NavigationChromeProvider>
      <SyncStatusBanner />
      <Stack screenOptions={{ headerShown: false }} />
      <NavigationDrawer />
      <ProfileSheet />
      <QuickAddSheet />
      <GlobalAddButton />
    </NavigationChromeProvider>
  );
}

function GlobalAddButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { openQuickAdd } = useNavigationChrome();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          height: Layout.floatingActionAreaHeight + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}>
      <FloatingActionButton label="Neu hinzufügen" onPress={openQuickAdd}>
        <PlusIcon color={theme.onAccent} />
      </FloatingActionButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
});
