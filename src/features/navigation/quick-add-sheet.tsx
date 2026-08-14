import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSize, ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { useNavigationChrome } from './navigation-chrome-provider';

type QuickAddOption = {
  title: string;
  subtitle: string;
  href: string;
  backgroundColor: string;
};

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
    href: '/add-food-entry',
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
          style={styles.dim}
          onPress={closeQuickAdd}
          accessibilityRole="button"
          accessibilityLabel="Schließen"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundElement,
              bottom: Math.max(insets.bottom / 3, 10),
            },
          ]}>
          <View style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <ThemedText type="smallBold" style={styles.title}>
            Neu hinzufügen
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Wähle, wo dein neuer Eintrag hingehört.
          </ThemedText>

          <View style={styles.grid}>
            {OPTIONS.map((option) => (
              <Pressable
                key={option.title}
                onPress={() => go(option.href)}
                accessibilityRole="button"
                style={[styles.tile, { backgroundColor: option.backgroundColor }]}>
                <View style={styles.tileIcon} />
                <ThemedText type="smallBold" style={styles.tileTitle}>
                  {option.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.tileSubtitle}>
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

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(31,26,33,0.3)',
  },
  sheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 310,
    borderRadius: 28,
    paddingHorizontal: 15,
    boxShadow: '0 -8px 28px rgba(41, 28, 46, 0.18)',
    borderCurve: 'continuous',
  },
  handleArea: {
    alignItems: 'center',
    height: 29,
    justifyContent: 'center',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  title: {
    ...FontSize[20],
    lineHeight: 24,
    fontWeight: '500',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 13,
    ...FontSize[12],
    lineHeight: 16,
    fontWeight: '400',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  tile: {
    width: '48.6%',
    height: 103,
    borderRadius: 19,
    padding: 13,
    justifyContent: 'space-between',
    borderCurve: 'continuous',
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.59)',
    borderCurve: 'continuous',
  },
  tileTitle: {
    ...FontSize[11],
    lineHeight: 13,
    fontWeight: '500',
  },
  tileSubtitle: {
    ...FontSize[9],
    lineHeight: 12,
    fontWeight: '400',
  },
});
