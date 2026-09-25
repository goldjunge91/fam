import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { type ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  type AccessibilityRole,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/components/theme';

export type GlassCardShape = 'card' | 'control' | 'pill';

const styles = StyleSheet.create((theme) => ({
  shape: {
    variants: {
      shape: {
        card: {
          borderRadius: theme.radius.xl,
          borderCurve: 'continuous',
        },
        control: {
          borderRadius: theme.radius.lg,
          borderCurve: 'continuous',
        },
        pill: {
          borderRadius: theme.radius.pill,
        },
      },
    },
  },
  fallback: {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
    borderWidth: theme.borderWidth.base,
  },
  glassContent: {
    flex: 1,
  },
  fallbackPressed: {
    opacity: 0.8,
  },
  dashboardTint: {
    backgroundColor: withAlpha(theme.accent, 0.08),
  },
}));

function useReduceTransparency(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (mounted) setReduceTransparency(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceTransparency;
}

export function useGlassAvailable(): boolean {
  const reduceTransparency = useReduceTransparency();
  return isGlassEffectAPIAvailable() && !reduceTransparency;
}

type GlassCardProps = {
  /** Layout-Styles; Form und Fläche bleiben beim GlassCard-Rezept. */
  outerStyle?: StyleProp<ViewStyle>;
  /** Layout-Styles für GlassView; Form und native GlassView-API bleiben getrennt. */
  glassStyle: StyleProp<ViewStyle>;
  /** Layout-Styles für den Fallback; die Fläche kommt aus dem aktiven Theme. */
  fallbackStyle?: StyleProp<ViewStyle>;
  /** Aktiviert den dezenten, zentralen Dashboard-Farbakzent. */
  tinted?: boolean;
  /** Semantische Form der GlassCard. */
  shape?: GlassCardShape;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel: string;
  children: ReactNode;
};

export function GlassCard({
  outerStyle,
  glassStyle,
  fallbackStyle,
  tinted = false,
  shape = 'card',
  onPress,
  onLongPress,
  disabled = false,
  accessibilityRole,
  accessibilityLabel,
  children,
}: GlassCardProps) {
  const canUseGlass = useGlassAvailable();
  const [fallbackPressed, setFallbackPressed] = useState(false);
  styles.useVariants({ shape });
  if (!canUseGlass) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => setFallbackPressed(true)}
        onPressOut={() => setFallbackPressed(false)}
        style={[
          fallbackStyle,
          outerStyle,
          styles.fallback,
          tinted && styles.dashboardTint,
          styles.shape,
          fallbackPressed && styles.fallbackPressed,
        ]}>
        {children}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[outerStyle, styles.shape]}>
      <GlassView
        glassEffectStyle="regular"
        isInteractive={!disabled}
        style={[styles.glassContent, glassStyle, tinted && styles.dashboardTint, styles.shape]}>
        {children}
      </GlassView>
    </Pressable>
  );
}
