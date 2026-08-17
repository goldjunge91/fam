import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { withAlpha } from '@/constants/theme';
import type { MealType } from '@/features/calorie-tracking/api';
import { useTheme } from '@/hooks/use-theme';

import { useNavigationChrome } from './navigation-chrome-provider';

type QuickAddOption = {
  title: string;
  subtitle: string;
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

/** Grobe Tageszeit-Heuristik, damit der Schnellzugriff nicht mit einer leeren Mahlzeit startet. */
function defaultMealType(): MealType {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

const OPTIONS: QuickAddOption[] = [
  {
    title: 'Vorratsartikel',
    subtitle: 'Lebensmittel einlagern oder scannen',
    href: '/add-item',
    backgroundColor: '#F0E2DF',
  },
  {
    title: 'Einkaufsartikel',
    subtitle: 'Etwas auf die gemeinsame Liste setzen',
    href: '/shopping-list?action=add',
    backgroundColor: '#EBE5F1',
  },
  {
    title: 'Tagebucheintrag',
    subtitle: 'Mahlzeit oder Lebensmittel erfassen',
    // `/add-food-entry` braucht date+mealType (#food-entries-query) — ohne das
    // laeuft der Tagebuch-Query mit dem String "undefined" gegen Postgres.
    href: () => `/add-food-entry?date=${todayIso()}&mealType=${defaultMealType()}`,
    backgroundColor: '#F3E9D7',
  },
  {
    title: 'Rezept',
    subtitle: 'Ein neues Rezept erstellen',
    href: '/recipe/create',
    backgroundColor: '#E4EDE3',
  },
];

/**
 * Schnellauswahl fuer den globalen Plus-Button (#150, Figma "00.04 ·
 * Plus-Menü") — ersetzt das fruehere, ueber jeden Hub-Screen verstreute
 * Hinzufuegen (Kopfzeilen-Button je Screen).
 */
export function QuickAddSheet() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isQuickAddOpen, closeQuickAdd } = useNavigationChrome();

  function go(href: string) {
    closeQuickAdd();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <Modal
      visible={isQuickAddOpen}
      transparent
      animationType="slide"
      onRequestClose={closeQuickAdd}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="sheet-dim"
          onPress={closeQuickAdd}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        />
        <View
          className="quick-add-sheet bg-background-element"
          // bottom (Safe-Area-Insets) und boxShadow (dynamische Opazitaet)
          // sind echte Laufzeitwerte. borderCurve hat keine Tailwind-
          // Entsprechung (natives iOS-"Squircle"-Rendering).
          style={{
            bottom: Math.max(insets.bottom / 3, 10),
            boxShadow: `0 -8px 28px ${withAlpha(theme.shadowSheet, 0.18)}`,
            borderCurve: 'continuous',
          }}>
          <View className="quick-add-handle-area">
            <View className="quick-add-handle" />
          </View>

          <ThemedText type="smallBold" className="quick-add-title">
            Neu hinzufügen
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" className="quick-add-subtitle">
            Wähle, wo dein neuer Eintrag hingehört.
          </ThemedText>

          <View className="quick-add-grid">
            {OPTIONS.map((option) => (
              <Pressable
                key={option.title}
                onPress={() => go(typeof option.href === 'function' ? option.href() : option.href)}
                accessibilityRole="button"
                className="quick-add-tile"
                // backgroundColor variiert pro Kachel (Datenobjekt), kein
                // fester Token; borderCurve wie oben.
                style={{ backgroundColor: option.backgroundColor, borderCurve: 'continuous' }}>
                <View className="quick-add-tile-icon" style={{ borderCurve: 'continuous' }} />
                <ThemedText type="smallBold" className="quick-add-tile-title">
                  {option.title}
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  className="quick-add-tile-subtitle">
                  {option.subtitle}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
