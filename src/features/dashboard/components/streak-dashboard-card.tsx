import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { borderWidth, radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { DashboardCardShell } from '@/features/dashboard/components/dashboard-card-shell';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useStreak } from '@/features/gamification/streak';

const DAY_COUNT = 7;
const STREAK_DAYS = ['day-1', 'day-2', 'day-3', 'day-4', 'day-5', 'day-6', 'day-7'] as const;

const styles = StyleSheet.create({
  days: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  smallCard: {
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  smallMetric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: space.sm,
  },
});

function StreakDays({ count, activeToday }: { count: number; activeToday: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const activeDays = Math.min(count, DAY_COUNT);
  const todayIndex = activeDays - 1;

  return (
    <View
      accessibilityLabel={t('dashboard.cards.streak.activeDays', {
        active: activeDays,
        total: DAY_COUNT,
      })}
      style={styles.days}>
      {STREAK_DAYS.map((day, index) => {
        const active = index < activeDays;
        const isToday = activeToday && index === todayIndex;

        return (
          <View
            key={day}
            testID={`streak-day-${index + 1}`}
            style={{
              width: 12,
              height: 12,
              borderRadius: radius.xs,
              backgroundColor: active ? colors.warning : colors.backgroundSoft,
              borderWidth: isToday ? borderWidth.strong : 0,
              borderColor: isToday ? colors.accent : 'transparent',
            }}
          />
        );
      })}
    </View>
  );
}

function StreakDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const streak = useStreak();
  const isSmall = size === 'small';
  const hasStreak = streak.count > 0;
  const status = hasStreak
    ? streak.activeToday
      ? t('dashboard.cards.streak.activeToday')
      : t('dashboard.cards.streak.activeYesterday')
    : streak.best > 0
      ? t('dashboard.cards.streak.startNew')
      : t('dashboard.cards.streak.startFirst');
  const dayLabel = t('dashboard.cards.streak.days', { count: streak.count });
  const bestValue = t('dashboard.cards.streak.bestValue', { count: streak.best });
  const accessibilityLabel = t('dashboard.cards.streak.accessibility', {
    count: streak.count,
    unit: dayLabel,
    status,
    best: bestValue,
  });

  return (
    <DashboardCardShell
      size={size}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={isSmall ? styles.smallCard : undefined}>
      <View style={styles.header}>
        <Txt variant="eyebrow" tone="accent" weight="700">
          {t('dashboard.cards.streak.title')}
        </Txt>
        {!isSmall ? (
          <Txt variant="caption" tone="secondary">
            {hasStreak
              ? t('dashboard.cards.streak.keepGoing')
              : t('dashboard.cards.streak.yourProgress')}
          </Txt>
        ) : null}
      </View>

      {isSmall ? (
        <View style={styles.smallMetric}>
          <Txt variant="title" selectable>
            {streak.count}
          </Txt>
          <Txt variant="body" tone="secondary">
            {t('dashboard.cards.streak.daysShort', { count: streak.count })}
          </Txt>
        </View>
      ) : (
        <>
          <View style={styles.metric}>
            <Txt variant="body" selectable>
              🔥
            </Txt>
            <Txt variant="title" selectable>
              {streak.count}
            </Txt>
            <Txt variant="body" tone="secondary">
              {dayLabel}
            </Txt>
          </View>

          <StreakDays count={streak.count} activeToday={streak.activeToday} />
        </>
      )}

      {!isSmall ? (
        <View style={[styles.status, { borderTopColor: colors.border }]}>
          <Txt variant="body" tone={hasStreak ? 'success' : 'secondary'} weight="600">
            {status}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {bestValue}
          </Txt>
        </View>
      ) : null}
    </DashboardCardShell>
  );
}

registerCard({
  id: 'streak',
  order: 5,
  defaultSize: 'small',
  component: StreakDashboardCard,
});

export { StreakDashboardCard };
