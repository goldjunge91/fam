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

/**
 * Ob `GlassCard` gerade echtes Glas rendert oder auf die solide
 * Fallback-Karte zurueckfaellt — u. a. fuer die Debug-Kachel im Dashboard
 * genutzt, die den rohen Wert anzeigt (s. dashboard-screen.tsx).
 */
export function useGlassAvailable(): boolean {
  const reduceTransparency = useReduceTransparency();
  return isGlassEffectAPIAvailable() && !reduceTransparency;
}

type GlassCardProps = {
  /** Groesse/Position der Kachel (Hoehe, evtl. `flex: 1` fuer nebeneinander stehende Widgets). */
  outerStyle?: StyleProp<ViewStyle>;
  /** Radius/Padding/Gap/Ausrichtung der Glas-Flaeche — `GlassView` hat kein
   * `cssInterop` (s. docs/design-system/nativewind-liquid-glass-migration.md,
   * Abschnitt "KRITISCH"), deshalb hier als RN-Style statt Tailwind-Klasse. */
  glassStyle: StyleProp<ViewStyle>;
  /** Aequivalente Tailwind-Klasse fuer den soliden Fallback (Android, iOS < 26,
   * Reduce-Transparency) — traegt Radius/Padding/Gap/Hintergrund/Schatten in einem. */
  fallbackClassName: string;
  onPress: () => void;
  accessibilityRole: AccessibilityRole;
  accessibilityLabel: string;
  children: ReactNode;
};

/**
 * Navigierbare Dashboard-Kachel mit echtem Liquid Glass auf iOS 26+
 * (`expo-glass-effect`), sonst eine solide Karte wie vor Phase C. Nur fuer
 * Chrome/Steuerelemente gedacht (Apple HIG: Glas ist fuer Interaktion, nicht
 * fuer reine Inhaltsflaechen) — die Kalorien-Karte auf dem Dashboard bleibt
 * deshalb bewusst ausserhalb, s. Mock-Variante B.
 */
export function GlassCard({
  outerStyle,
  glassStyle,
  fallbackClassName,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  children,
}: GlassCardProps) {
  const canUseGlass = useGlassAvailable();

  if (!canUseGlass) {
    return (
      <Pressable
        onPress={onPress}
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
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={outerStyle}>
      <GlassView glassEffectStyle="regular" isInteractive style={[{ flex: 1 }, glassStyle]}>
        {children}
      </GlassView>
    </Pressable>
  );
}
