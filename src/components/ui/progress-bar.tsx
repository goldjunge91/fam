import { View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';

type ProgressBarProps = {
  /** 0..1 — Werte ausserhalb werden geklemmt. */
  value: number;
  color?: string;
  height?: number;
  trackColor?: string;
};

export function ProgressBar({ value, color, height = 4, trackColor }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(value, 0), 1);

  return (
    <View
      style={{
        width: '100%',
        overflow: 'hidden',
        height,
        backgroundColor: trackColor ?? colors.border,
        borderRadius: height / 2,
      }}>
      <View
        style={{
          height: '100%',
          width: `${clamped * 100}%`,
          backgroundColor: color ?? colors.accent,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}
