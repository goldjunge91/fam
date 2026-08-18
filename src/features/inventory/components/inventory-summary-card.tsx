import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type InventorySummaryCardProps = {
  totalCount: number;
  criticalCount: number;
  soonCount: number;
};

const RING_SIZE = 58;
const STROKE_WIDTH = 7;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type ExpiryRingProps = {
  count: number;
  fraction: number;
  color: string;
  trackColor: string;
};

// Anteilsring statt reiner Deko: die Faerbung zeigt, welchen Teil des
// gesamten Vorrats dieser Ablauf-Status ausmacht (kritisch/bald von total).
function ExpiryRing({ count, fraction, color, trackColor }: ExpiryRingProps) {
  const filled = Math.min(Math.max(fraction, 0), 1) * CIRCUMFERENCE;

  return (
    <View className="inventory-summary-ring-wrap">
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={trackColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {filled > 0 ? (
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        ) : null}
      </Svg>
      {/* fontVariant hat keine Tailwind-Entsprechung. */}
      <ThemedText
        className="inventory-summary-ring-count"
        style={{ fontVariant: ['tabular-nums'] }}>
        {count}
      </ThemedText>
    </View>
  );
}

/**
 * Zwei Ablauf-Ringe statt eines einzelnen Bestandsrings: "Läuft bald ab"
 * (kritisch/abgelaufen) und "Bald fällig" (soon). Der reine Artikel-Zähler
 * aus der Vorgaengerversion trug keine Handlungsinformation — beide Ringe
 * zeigen stattdessen direkt, was Aufmerksamkeit braucht.
 */
export function InventorySummaryCard({
  totalCount,
  criticalCount,
  soonCount,
}: InventorySummaryCardProps) {
  const theme = useTheme();
  const criticalFraction = totalCount > 0 ? criticalCount / totalCount : 0;
  const soonFraction = totalCount > 0 ? soonCount / totalCount : 0;

  return (
    <View
      accessible
      aria-label={`${criticalCount} Artikel laufen bald ab, ${soonCount} bald fällig, ${totalCount} insgesamt im Vorrat`}
      className="inventory-summary-row">
      <View
        className="inventory-summary-ring-card"
        // boxShadow (dynamische Opazitaet) und borderCurve (kein Tailwind-
        // Aequivalent) sind Ausnahmen.
        style={{
          boxShadow: `0 10px 24px ${withAlpha(theme.shadowCard, 0.14)}`,
          borderCurve: 'continuous',
        }}>
        <ExpiryRing
          count={criticalCount}
          fraction={criticalFraction}
          color={theme.danger}
          trackColor={withAlpha(theme.danger, 0.16)}
        />
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          Läuft bald ab
        </ThemedText>
      </View>

      <View
        className="inventory-summary-ring-card"
        style={{
          boxShadow: `0 10px 24px ${withAlpha(theme.shadowCard, 0.14)}`,
          borderCurve: 'continuous',
        }}>
        <ExpiryRing
          count={soonCount}
          fraction={soonFraction}
          color={theme.warning}
          trackColor={withAlpha(theme.warning, 0.16)}
        />
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          Bald fällig
        </ThemedText>
      </View>
    </View>
  );
}
