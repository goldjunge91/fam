import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTheme } from '@/components/theme/ThemeProvider';

type ProgressBarProps = {
  /** 0..1 — Werte ausserhalb werden geklemmt. */
  value: number;
  color?: string;
  height?: number;
  trackColor?: string;
  accessibilityLabel?: string;
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

export function ProgressBar({
  value,
  color,
  height = 4,
  trackColor,
  accessibilityLabel = 'Fortschritt',
}: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(value, 0), 1);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 1, now: clamped }}
      style={[
        styles.track,
        {
          height,
          backgroundColor: trackColor ?? colors.border,
          borderRadius: height / 2,
        },
      ]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: color ?? colors.accent,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
}
