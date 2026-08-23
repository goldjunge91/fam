import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FamIcon, type FamIconName } from '@/components/icons/fam-icon';
import { ThemedText } from '@/components/theme/themed-text';
import { IconSize, Layout, Spacing } from '@/constants/layout';
import type { MealType } from '@/features/calorie-tracking/api';
import { DEFAULT_FAB_POSITION, useFabPosition } from '@/features/navigation/fab-position-settings';
import { useDeferredMount } from '@/hooks/use-deferred-mount';
import { useNavigationChrome } from './navigation-chrome-provider';

type SpeedDialOption = {
  title: string;
  icon: FamIconName;
  href: string | (() => string);
  backgroundColor: string;
};

/** Lokales Datum, nicht UTC — sonst rutscht das Datum kurz nach Mitternacht. */
function todayIso(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Liefert fuer den Schnellzugriff eine passende Mahlzeit zur Tageszeit. */
function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

const OPTIONS: SpeedDialOption[] = [
  { title: 'Vorratsartikel', icon: 'fridge', href: '/add-item', backgroundColor: '#F0E2DF' },
  {
    title: 'Einkaufsartikel',
    icon: 'shopping',
    href: '/shopping-list?action=add',
    backgroundColor: '#EBE5F1',
  },
  {
    title: 'Tagebucheintrag',
    icon: 'diary',
    // Die Zielroute benoetigt beide Query-Parameter.
    href: () => `/add-food-entry?date=${todayIso()}&mealType=${defaultMealType()}`,
    backgroundColor: '#F3E9D7',
  },
  { title: 'Rezept', icon: 'recipes', href: '/recipe/create', backgroundColor: '#E4EDE3' },
];

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
  const isRight = position !== 'left';

  function go(href: string) {
    closeQuickAdd();
    router.push(href as Parameters<typeof router.push>[0]);
  }

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
          // Ecke und Safe-Area-Abstand sind Laufzeitwerte.
          style={{
            [isRight ? 'right' : 'left']: Spacing.four,
            bottom: insets.bottom + Layout.floatingActionAreaHeight,
          }}>
          {OPTIONS.map((option) => (
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
