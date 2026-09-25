import type { ReactNode } from 'react';
import type { AccessibilityRole, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { dashboardCardSizes } from '@/components/theme';
import { GlassCard, type GlassCardShadow } from '@/components/ui/glass-card';
import type { CardSize } from '@/features/dashboard/registry';

type DashboardCardShellProps = {
  size: CardSize;
  shadow: GlassCardShadow;
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
  shadow,
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
      shadow={shadow}
      tinted
      glassStyle={[styles.card, sizeStyle.content, style]}
      fallbackStyle={[styles.card, sizeStyle.outer, sizeStyle.content, style]}
      outerStyle={[styles.outer, sizeStyle.outer]}>
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  outer: {
    width: '100%',
    overflow: 'visible',
    borderColor: theme.border,
    borderWidth: theme.borderWidth.base,
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
}));
