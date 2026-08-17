import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from '@/components/fam-icon';
import { FloatingActionButton } from '@/components/ui/buttons';
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
  const { openQuickAdd } = useNavigationChrome();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      className="app-shell-wrap"
      // Bottom-Safe-Area ist ein echter Laufzeitwert (Geraet-abhaengig),
      // kann nicht als Tailwind-Klasse ausgedrueckt werden.
      style={{ paddingBottom: insets.bottom }}>
      <FloatingActionButton label="Neu hinzufügen" onPress={openQuickAdd}>
        <PlusIcon color={theme.onAccent} />
      </FloatingActionButton>
    </View>
  );
}
