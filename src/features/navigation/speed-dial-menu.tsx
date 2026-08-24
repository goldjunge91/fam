import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FamIcon } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { getSpeedDialOptions } from '@/constants/feature-registry';
import { IconSize, Layout, Spacing } from '@/constants/layout';
import { DEFAULT_FAB_POSITION, useFabPosition } from '@/features/navigation/fab-position-settings';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { useNavigationChrome } from './navigation-chrome-provider';

/**
 * Schnellauswahl fuer den globalen Plus-Button (#150, Folgeentscheidung
 * "F2 Speed-Dial") — faechert vom Auslöser in der Bildschirmecke nach oben
 * auf, statt eines Vollflaechen-Sheets. Kein Scrim: die Chips sitzen sichtbar
 * ueber dem Inhalt, ein Tap daneben schliesst genauso wie ein Tap auf eine
 * der Optionen.
 */
export function SpeedDialMenu() {
  const { isQuickAddOpen } = useNavigationChrome();
  const mounted = useDeferredMount(isQuickAddOpen, 180);

  if (!mounted) return null;

  return <SpeedDialMenuContent />;
}

function SpeedDialMenuContent() {
  const insets = useSafeAreaInsets();
  const { isQuickAddOpen, closeQuickAdd } = useNavigationChrome();
  const { data: position = DEFAULT_FAB_POSITION } = useFabPosition();
  const { isFeatureEnabled } = useFeatureAccess();
  const isRight = position !== 'left';

  function go(href: string) {
    closeQuickAdd();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  const speedDialOptions = getSpeedDialOptions();
  const visibleOptions = speedDialOptions.filter((option) => isFeatureEnabled(option.feature));

  return (
    <Modal visible={isQuickAddOpen} transparent animationType="fade" onRequestClose={closeQuickAdd}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="speed-dial-backdrop"
          onPress={closeQuickAdd}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        />
        <View
          pointerEvents="box-none"
          className={`speed-dial-column ${isRight ? 'items-end' : 'items-start'}`}
          // Ecke (links/rechts) und Sicherheitsabstand zum Auslöser sind
          // Laufzeitwerte (Einstellung + Safe-Area-Insets), kein Tailwind-Token.
          style={{
            [isRight ? 'right' : 'left']: Spacing.four,
            bottom: insets.bottom + Layout.floatingActionAreaHeight,
          }}>
          {visibleOptions.map((option) => (
            <Pressable
              key={option.title}
              onPress={() => go(typeof option.href === 'function' ? option.href() : option.href)}
              accessibilityRole="button"
              // Icon sitzt immer an der Bildschirmkante, Label rueckt zur
              // Mitte hin — deshalb Reihenfolge nur in der rechten Ecke
              // umkehren (JSX-Reihenfolge chip->label ist links schon korrekt).
              className={`speed-dial-row ${isRight ? 'flex-row-reverse' : ''}`}>
              <View
                className="speed-dial-chip"
                style={{ backgroundColor: option.backgroundColor, borderCurve: 'continuous' }}>
                <FamIcon name={option.icon} size={IconSize.nav} />
              </View>
              <ThemedText type="smallBold" className="speed-dial-label">
                {option.title}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
