import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Surface, Txt } from '@/constants/ui';

export type ComponentCategory = 'surfaces' | 'controls' | 'feedback';

const styles = StyleSheet.create((theme) => ({
  container: {
    padding: theme.space.lg,
  },
  stack: {
    gap: theme.space.sm,
  },
}));

export function ComponentsShowcase({ category }: { category: ComponentCategory }) {
  return (
    <Surface tone="soft" style={styles.container}>
      <View style={styles.stack}>
        <Txt variant="heading">Komponenten</Txt>
        <Txt tone="secondary">
          Die nativen Expo-UI-Beispiele sind auf iOS und Android verfügbar.
        </Txt>
        <Txt variant="caption" tone="secondary">
          Kategorie: {category}
        </Txt>
      </View>
    </Surface>
  );
}
