import { View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Graue Ueberlagerung fuer eine gesperrte Modul-Zeile (#183) — macht den Switch
 * unbedienbar und zeigt die "Demnächst verfügbar"-Pille. Onboarding und
 * Einstellungen teilen sich diese eine Instanz, damit Feinschliff (z. B. die
 * Wash-Deckkraft) nur an einer Stelle passiert.
 *
 * Die Farben bleiben Inline-Styles: NativeWind rendert Arbitrary-Alpha auf einer
 * Theme-Custom-Property nicht zuverlaessig und `ThemedText` schlaegt eine
 * `className`-Textfarbe (siehe `src/global.css`).
 */
export function ModuleLockedOverlay() {
  const theme = useTheme();

  return (
    <View
      className="module-row-locked-overlay"
      style={{ backgroundColor: withAlpha(theme.backgroundElement, 0.4) }}>
      <View className="module-row-locked-pill" style={{ backgroundColor: theme.text }}>
        <View className="module-row-locked-pill-dot" />
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          Demnächst verfügbar
        </ThemedText>
      </View>
    </View>
  );
}
