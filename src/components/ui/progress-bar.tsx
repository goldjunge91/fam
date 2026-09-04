import { View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';

type ProgressBarProps = {
  /** 0..1 — Werte ausserhalb werden geklemmt. */
  value: number;
  color?: string;
  height?: number;
  trackColor?: string;
  className?: string;
};

export function ProgressBar({
  value,
  color,
  height = 4,
  trackColor,
  className = '',
}: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(value, 0), 1);

  return (
    <View
      className={`w-full overflow-hidden rounded-full ${height === 4 ? 'h-1' : ''} ${className}`.trim()}
      style={
        { height, backgroundColor: trackColor ?? colors.border, borderRadius: height / 2 }
      }>
      <View
        className="h-full rounded-full"
        style={{
          width: `${clamped * 100}%`,
          backgroundColor: color ?? colors.basil,
          ...(height !== 4 ? { borderRadius: height / 2 } : {}),
        }}
      />
    </View>
  );
}
