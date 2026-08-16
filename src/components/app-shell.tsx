import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
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

/**
 * Ersetzt die frueheren `NativeTabs` (#150, Figma "00 · Screens — Übersicht &
 * Navigation"): Stack-Navigation ohne eigenes Chrome, Hamburger-Drawer +
 * Profil-Sheet je Hub-Screen (siehe `Screen`-Prop `chrome`), globaler
 * Plus-Button unten mittig statt sieben einzelner Tab-Icons.
 *
 * Die sechs frueheren Tab-Routen (index, fridge, shopping-list, diary,
 * recipes, meal-planner) bleiben als Stack-Screens bestehen — nur die
 * Navigations-Chrome drumherum ist neu. `settings` ist weiterhin erreichbar,
 * aber nur noch ueber den Drawer-Fussbereich, nicht als gleichrangiger
 * Eintrag.
 */
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
  const insets = useSafeAreaInsets();
  const { openQuickAdd } = useNavigationChrome();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          height: 88 + insets.bottom,
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
