import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FridgeSummaryCardProps = {
  totalCount: number;
  criticalCount: number;
  soonCount: number;
};

const RING_SIZE = 112;
const STROKE_WIDTH = 11;

export function FridgeSummaryCard({
  totalCount,
  criticalCount,
  soonCount,
}: FridgeSummaryCardProps) {
  const theme = useTheme();
  const stableCount = Math.max(totalCount - criticalCount - soonCount, 0);
  const radius = (RING_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { count: stableCount, color: theme.success },
    { count: soonCount, color: theme.warning },
    { count: criticalCount, color: theme.danger },
  ].filter((segment) => segment.count > 0);

  const segmentOffsets = segments.map((_, index) =>
    segments
      .slice(0, index)
      .reduce((sum, segment) => sum + (segment.count / Math.max(totalCount, 1)) * circumference, 0),
  );
  const headline =
    criticalCount > 0
      ? `${criticalCount} ${criticalCount === 1 ? 'läuft' : 'laufen'} bald ab`
      : soonCount > 0
        ? `${soonCount} bald fällig`
        : 'Alles gut im Blick';

  return (
    <View
      accessible
      aria-label={`${totalCount} Artikel im Vorrat, ${criticalCount} kritisch, ${soonCount} bald fällig`}
      className="fridge-summary-card"
      // boxShadow (dynamische Opazitaet) und borderCurve (kein Tailwind-
      // Aequivalent) sind Ausnahmen.
      style={{
        boxShadow: `0 12px 30px ${withAlpha(theme.shadowCard, 0.12)}`,
        borderCurve: 'continuous',
      }}>
      <View className="fridge-summary-ring-wrap">
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke={theme.backgroundSelected}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {segments.map((segment, index) => {
            const length = totalCount > 0 ? (segment.count / totalCount) * circumference : 0;

            return (
              <Circle
                key={segment.color}
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-segmentOffsets[index]}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            );
          })}
        </Svg>

        <View className="fridge-summary-ring-center" pointerEvents="none">
          {/* fontVariant hat keine Tailwind-Entsprechung. */}
          <ThemedText
            className="fridge-summary-total-count"
            style={{ fontVariant: ['tabular-nums'] }}>
            {totalCount}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Artikel
          </ThemedText>
        </View>
      </View>

      <View className="fridge-summary-copy">
        <ThemedText type="small" themeColor="textSecondary">
          Dein Vorrat heute
        </ThemedText>
        <ThemedText className="fridge-summary-headline">{headline}</ThemedText>
        <ThemedText type="small" themeColor={criticalCount > 0 ? 'danger' : 'success'}>
          {criticalCount > 0 ? 'Zuerst verbrauchen' : 'Vorrat gut verteilt'}
        </ThemedText>
      </View>
    </View>
  );
}
