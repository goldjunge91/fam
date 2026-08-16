import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Flaeche fuer zusammengehoerende Inhalte. Antippbar, sobald `onPress` gesetzt ist. */
export function Card({ children, title, footer, onPress, style }: CardProps) {
  const theme = useTheme();
  const content = (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { shadowColor: theme.shadowCard }, style]}>
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
    borderRadius: Radius.large,
    gap: Spacing.two,
    // Weicher, warmer Schatten statt harter Kante — passend zum
    // "surface-elevated"-Look des fam-Design-Systems (Figma, #150).
    // shadowColor kommt inline aus Colors.shadowCard (theme.ts), da
    // StyleSheet.create hier keinen Hook-Zugriff hat.
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
