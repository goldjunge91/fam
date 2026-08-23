import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { GradientSpec } from '@/constants/theme';

type GradientBackgroundProps = GradientSpec;

export function GradientBackground({ colors, locations }: GradientBackgroundProps) {
  const resolvedLocations = locations ?? (colors.length === 3 ? [0, 0.40385, 0.96154] : undefined);
  const stops = colors.map((color, index) => ({
    offset: resolvedLocations?.[index] ?? (colors.length > 1 ? index / (colors.length - 1) : 0),
    color,
  }));

  return (
    // Svg (react-native-svg) ist bei NativeWind nicht registriert (kein
    // cssInterop) — className wird stillschweigend ignoriert, statt einen
    // Fehler zu werfen. style bleibt hier zwingend, sonst verliert der
    // Hintergrund sein position:absolute und verdraengt den Screen-Inhalt.
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="screenGradient" x1="0%" y1="44%" x2="100%" y2="56%">
          {stops.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#screenGradient)" />
    </Svg>
  );
}
