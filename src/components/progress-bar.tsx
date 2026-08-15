import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type ProgressBarProps = {
  /** 0..1 — Werte ausserhalb werden geklemmt. */
  value: number;
  color: string;
  height?: number;
  trackColor?: string;
};

/**
 * Schmaler Fortschrittsbalken — Grundbaustein fuer Karten mit Fortschritt
 * (Einkaufslisten pro Markt, perspektivisch weitere). Bewusst ohne Animation
 * und Label: die Karte drumherum traegt den Text, dieser Baustein nur die
 * Leiste selbst.
 */
export function ProgressBar({ value, color, height = 4, trackColor }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.min(Math.max(value, 0), 1);

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? theme.border },
      ]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, borderRadius: height / 2, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
