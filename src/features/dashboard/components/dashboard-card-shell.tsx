import type { ReactNode } from 'react';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { dashboardCardSizes } from '@/components/theme';
import { GlassCard } from '@/components/ui/glass-card';
import type { CardSize } from '@/features/dashboard/registry';

type DashboardCardShellProps = {
  size: CardSize;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Gemeinsame sichtbare und interaktive Hülle für jedes Dashboard-Widget. */
export function DashboardCardShell({
  size,
  onPress,
  onLongPress,
  disabled = false,
  accessibilityRole,
  accessibilityLabel,
  style,
  children,
}: DashboardCardShellProps) {
  const sizeStyle =
    size === 'small'
      ? { outer: styles.small, content: styles.smallContent }
      : { outer: styles.large, content: styles.largeContent };

  return (
    <GlassCard
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      tinted
      glassStyle={[styles.card, sizeStyle.content, style]}
      fallbackStyle={[styles.card, sizeStyle.outer, sizeStyle.content, style]}
      outerStyle={[styles.outer, sizeStyle.outer]}>
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
  },
  card: {
    width: '100%',
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  small: {
    height: dashboardCardSizes.small.height,
  },
  smallContent: {
    padding: dashboardCardSizes.small.padding,
  },
  large: {
    height: dashboardCardSizes.large.height,
  },
  largeContent: {
    padding: dashboardCardSizes.large.padding,
  },
});
