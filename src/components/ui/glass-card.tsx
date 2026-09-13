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

const styles = StyleSheet.create({
  glassContent: {
    flex: 1,
  },
  fallbackPressed: {
    opacity: 0.8,
  },
});

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
  /** GlassView-Styles bleiben native Styles, da GlassView keine CSS-Interop hat. */
  glassStyle: StyleProp<ViewStyle>;
  /** Styles for the solid fallback when the platform glass API is unavailable. */
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
  fallbackStyle,
  onPress,
  onLongPress,
  disabled = false,
  accessibilityRole,
  accessibilityLabel,
  children,
}: GlassCardProps) {
  const canUseGlass = useGlassAvailable();
  const [fallbackPressed, setFallbackPressed] = useState(false);

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
        style={[fallbackStyle, outerStyle, fallbackPressed && styles.fallbackPressed]}>
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
        style={[styles.glassContent, glassStyle]}>
        {children}
      </GlassView>
    </Pressable>
  );
}
