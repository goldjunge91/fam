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
  const { colors } = useTheme();
  const activeDays = Math.min(count, DAY_COUNT);
  const todayIndex = activeDays - 1;

  return (
    <View
      accessibilityLabel={`${activeDays} von ${DAY_COUNT} Streak-Tagen aktiv`}
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

function StreakDashboardCard({ size, onLongPress }: DashboardCardProps) {
  const { colors } = useTheme();
  const streak = useStreak();
  const hasStreak = streak.count > 0;
  const status = hasStreak
    ? streak.activeToday
      ? 'Heute aktiv'
      : 'Gestern aktiv'
    : streak.best > 0
      ? 'Neue Serie starten'
      : 'Starte deine erste Serie';
  const accessibilityLabel = `Kochstreak: ${streak.count} ${streak.count === 1 ? 'Tag' : 'Tage'} am Stück, ${status}, bester Wert ${streak.best} Tage`;

  return (
    <Pressable
      onLongPress={onLongPress}
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
          KOCHSTREAK
        </Txt>
        <Txt variant="caption" tone="secondary">
          {hasStreak ? 'Dranbleiben' : 'Dein Fortschritt'}
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
          {streak.count === 1 ? 'Tag am Stück' : 'Tage am Stück'}
        </Txt>
      </View>

      <StreakDays count={streak.count} activeToday={streak.activeToday} />

      <View style={[styles.status, { borderTopColor: colors.border }]}>
        <Txt variant="body" tone={hasStreak ? 'success' : 'secondary'} weight="600">
          {status}
        </Txt>
        <Txt variant="caption" tone="secondary">
          Bester Wert: {streak.best} Tage
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
