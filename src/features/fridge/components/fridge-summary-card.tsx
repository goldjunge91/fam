import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { FontSize, ThemedText } from '@/components/themed-text';
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
      style={[styles.card, { backgroundColor: `${theme.backgroundElement}E8` }]}>
      <View style={styles.ringWrap}>
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

        <View style={styles.ringCenter} pointerEvents="none">
          <ThemedText style={styles.totalCount}>{totalCount}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Artikel
          </ThemedText>
        </View>
      </View>

      <View style={styles.copy}>
        <ThemedText type="small" themeColor="textSecondary">
          Dein Vorrat heute
        </ThemedText>
        <ThemedText style={styles.headline}>{headline}</ThemedText>
        <ThemedText type="small" themeColor={criticalCount > 0 ? 'danger' : 'success'}>
          {criticalCount > 0 ? 'Zuerst verbrauchen' : 'Vorrat gut verteilt'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 178,
    borderRadius: 26,
    borderCurve: 'continuous',
    paddingHorizontal: 18,
    paddingVertical: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    boxShadow: '0 12px 30px rgba(84, 59, 88, 0.12)',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCount: {
    ...FontSize[24],
    lineHeight: 28,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  headline: {
    ...FontSize[24],
    lineHeight: 29,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
});
