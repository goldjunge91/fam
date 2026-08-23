import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { type ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  type AccessibilityRole,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
  outerStyle?: StyleProp<ViewStyle>;
  /** Radius/Padding/Gap/Ausrichtung der Glas-Flaeche — `GlassView` hat kein
   * `cssInterop` (s. docs/design-system/nativewind-liquid-glass-migration.md,
   * Abschnitt "KRITISCH"), deshalb hier als RN-Style statt Tailwind-Klasse. */
  glassStyle: StyleProp<ViewStyle>;
  fallbackClassName: string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  children: ReactNode;
};

export function GlassCard({
  outerStyle,
  glassStyle,
  fallbackClassName,
  onPress,
  onLongPress,
  accessibilityRole,
  accessibilityLabel,
  children,
}: GlassCardProps) {
  const canUseGlass = useGlassAvailable();

  if (!canUseGlass) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        className={fallbackClassName}
        style={outerStyle}>
        {children}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={outerStyle}>
      <GlassView glassEffectStyle="regular" isInteractive style={[{ flex: 1 }, glassStyle]}>
        {children}
      </GlassView>
    </Pressable>
  );
}
