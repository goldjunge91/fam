import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

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
  const body = <View style={styles.body}>{children}</View>;

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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        ) : (
          body
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
  scrollContent: {
    paddingBottom: BottomTabInset + Spacing.five,
  },
  body: {
    gap: Spacing.three,
  },
});
