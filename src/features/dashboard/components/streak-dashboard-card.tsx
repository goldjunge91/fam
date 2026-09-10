import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, shadow, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Surface, Txt } from '@/constants/ui';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useStreak } from '@/lib/streak';

const DAY_COUNT = 7;
const STREAK_DAYS = ['day-1', 'day-2', 'day-3', 'day-4', 'day-5', 'day-6', 'day-7'] as const;

const styles = StyleSheet.create({
  days: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  cardPressable: {
    width: '100%',
  },
  card: {
    width: '100%',
    padding: space.lg,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
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
              borderRadius: 6,
              backgroundColor: active ? colors.carrot : colors.backgroundSoft,
              borderWidth: isToday ? 2 : 0,
              borderColor: isToday ? colors.basil : 'transparent',
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
    <Pressable
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={styles.cardPressable}>
      <Surface
        tone="surface"
        style={[
          styles.card,
          shadow.sm,
          {
            minHeight: size === 'large' ? 140 : 138,
            shadowColor: colors.shadowCard,
          },
        ]}>
        <View style={styles.header}>
          <Txt variant="caption" tone="accent" weight="700" style={{ letterSpacing: 0.5 }}>
            {t('dashboard.cards.streak.title')}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {hasStreak
              ? t('dashboard.cards.streak.keepGoing')
              : t('dashboard.cards.streak.yourProgress')}
          </Txt>
        </View>

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

        <View style={[styles.status, { borderTopColor: colors.border }]}>
          <Txt variant="body" tone={hasStreak ? 'success' : 'secondary'} weight="600">
            {status}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {bestValue}
          </Txt>
        </View>
      </Surface>
    </Pressable>
  );
}

registerCard({
  id: 'streak',
  order: 5,
  defaultSize: 'small',
  component: StreakDashboardCard,
});

export { StreakDashboardCard };
