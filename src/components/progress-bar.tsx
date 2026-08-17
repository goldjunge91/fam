import { View } from 'react-native';

type ProgressBarProps = {
  /** 0..1 — Werte ausserhalb werden geklemmt. */
  value: number;
  color?: string;
  height?: number;
  trackColor?: string;
  className?: string;
};

/**
 * Schmaler Fortschrittsbalken — Grundbaustein fuer Karten mit Fortschritt
 * (Einkaufslisten pro Markt, perspektivisch weitere). Bewusst ohne Animation
 * und Label: die Karte drumherum traegt den Text, dieser Baustein nur die
 * Leiste selbst.
 */
export function ProgressBar({
  value,
  color,
  height = 4,
  trackColor,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 1);

  return (
    <View
      className={`w-full overflow-hidden bg-border rounded-full ${height === 4 ? 'h-1' : ''} ${className}`.trim()}
      style={
        height !== 4 || trackColor
          ? { height, backgroundColor: trackColor, borderRadius: height / 2 }
          : undefined
      }>
      <View
        className="h-full rounded-full bg-accent"
        style={{
          width: `${clamped * 100}%`,
          ...(color ? { backgroundColor: color } : {}),
          ...(height !== 4 ? { borderRadius: height / 2 } : {}),
        }}
      />
    </View>
  );
}
