import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Tabs sind statisch. Expo Router remountet den Navigator, wenn Trigger zur
 * Laufzeit dazukommen oder verschwinden — der komplette Navigationszustand
 * ginge verloren. Die Modul-Aktivierung (#95) blendet deshalb Inhalte aus,
 * nicht Tabs.
 *
 * Icons kommen als SF Symbols (iOS) und Material Symbols (Android) direkt vom
 * System statt als PNG-Assets. Das spart fuenf mal drei Bitmaps und sieht auf
 * beiden Plattformen nativ aus.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="chart.pie.fill" md="dashboard" />
        <NativeTabs.Trigger.Label>Übersicht</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="fridge">
        <NativeTabs.Trigger.Icon sf="archivebox.fill" md="kitchen" />
        <NativeTabs.Trigger.Label>Vorrat</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shopping-list">
        <NativeTabs.Trigger.Icon sf="cart.fill" md="shopping_cart" />
        <NativeTabs.Trigger.Label>Einkauf</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diary">
        <NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
        <NativeTabs.Trigger.Label>Tagebuch</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="recipes">
        <NativeTabs.Trigger.Icon sf="book.fill" md="menu_book" />
        <NativeTabs.Trigger.Label>Rezepte</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Einstellungen</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
