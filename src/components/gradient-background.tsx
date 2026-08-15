import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type GradientBackgroundProps = {
  /** Farbstopps in Reihenfolge, z. B. ['#ffccb2', '#f9f2eb', '#e8def2']. */
  colors: string[];
  locations?: number[];
};

/**
 * Flaechiger Verlauf als Bildschirmhintergrund fuer die warmen fam-Hub-Screens
 * (unter anderem Übersicht und Rezepte). Farben bleiben Props, damit alle
 * Bereiche denselben Renderer verwenden und nur ihre Figma-Stopps festlegen.
 *
 * Ueber `react-native-svg` statt `expo-linear-gradient`, weil Ersteres schon
 * Projektabhaengigkeit ist (siehe `ProgressRing`) — keine neue Dependency
 * fuer eine reine Hintergrunddarstellung.
 */
export function GradientBackground({ colors, locations }: GradientBackgroundProps) {
  const resolvedLocations = locations ?? (colors.length === 3 ? [0, 0.40385, 0.96154] : undefined);
  const stops = colors.map((color, index) => ({
    offset: resolvedLocations?.[index] ?? (colors.length > 1 ? index / (colors.length - 1) : 0),
    color,
  }));

  return (
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
