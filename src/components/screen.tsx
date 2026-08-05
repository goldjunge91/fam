import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing, TabBarHeight } from '@/constants/theme';

type ScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Aktion rechts neben dem Titel, z. B. ein Hinzufuegen-Button. */
  action?: ReactNode;
  scroll?: boolean;
};

/**
 * Gemeinsames Geruest aller Tab-Screens: Safe Area, Titelzeile, begrenzte
 * Breite und genug Abstand nach unten, damit die Tab-Leiste nichts verdeckt.
 *
 * `BottomTabInset` beruecksichtigt, dass die native Tab-Leiste auf iOS und
 * Android unterschiedlich hoch ist — ohne den Abstand liegt der letzte
 * Listeneintrag unter der Leiste und ist nicht antippbar.
 */
export function Screen({ title, subtitle, children, action, scroll = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = <View style={styles.body}>{children}</View>;

  // Die native Tab-Leiste liegt ueber dem Inhalt und wird nicht von der Safe Area
  // erfasst. Ohne diesen Abstand verschwindet der letzte Listeneintrag darunter
  // und ist weder lesbar noch antippbar — im Simulator gemessen: die Leiste
  // beginnt bei 90,5 % der Bildschirmhoehe, der Text lag bei 93,8 %.
  const bottomPadding = insets.bottom + TabBarHeight + Spacing.four;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText type="subtitle">{title}</ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {action}
        </View>

        {scroll ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: bottomPadding }}
            showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.body, { paddingBottom: bottomPadding }]}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  body: {
    gap: Spacing.three,
  },
});
