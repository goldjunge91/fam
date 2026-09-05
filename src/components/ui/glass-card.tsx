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
  /** Groesse/Position der Kachel (Hoehe, evtl. `flex: 1` fuer nebeneinander stehende Widgets). */
  outerStyle?: StyleProp<ViewStyle>;
  /** (s. docs/design-system/nativewind-liquid-glass-migration.md,
   * Abschnitt "KRITISCH"), deshalb hier als RN-Style statt Tailwind-Klasse. */
  glassStyle: StyleProp<ViewStyle>;
  /** Legacy-Tailwind-Fallback fuer bestehende Aufrufer. */
  fallbackClassName?: string;
  /** Native fallback styles for callers that do not use a global class. */
  fallbackStyle?: StyleProp<ViewStyle>;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  children: ReactNode;
};

export function GlassCard({
  outerStyle,
  glassStyle,
  fallbackClassName,
  fallbackStyle,
  onPress,
  onLongPress,
  disabled = false,
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
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        className={fallbackClassName}
        style={[fallbackStyle, outerStyle]}>
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
      style={outerStyle}>
      <GlassView
        glassEffectStyle="regular"
        isInteractive={!disabled}
        style={[{ flex: 1 }, glassStyle]}>
        {children}
      </GlassView>
    </Pressable>
  );
}
