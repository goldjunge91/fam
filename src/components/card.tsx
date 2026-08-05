import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type CardProps = {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Flaeche fuer zusammengehoerende Inhalte. Antippbar, sobald `onPress` gesetzt ist. */
export function Card({ children, title, footer, onPress, style }: CardProps) {
  const content = (
    <ThemedView type="backgroundElement" style={[styles.card, style]}>
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      {children}
      {footer}
    </ThemedView>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
