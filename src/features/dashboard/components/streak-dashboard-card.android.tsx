import { Pressable, View } from 'react-native';

import { space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useStreak } from '@/lib/streak';

const DAY_COUNT = 7;
const STREAK_DAYS = ['day-1', 'day-2', 'day-3', 'day-4', 'day-5', 'day-6', 'day-7'] as const;

function StreakDays({ count, activeToday }: { count: number; activeToday: boolean }) {
  const { colors } = useTheme();
  const activeDays = Math.min(count, DAY_COUNT);
  const todayIndex = activeDays - 1;

  return (
    <View
      accessibilityLabel={`${activeDays} von ${DAY_COUNT} Streak-Tagen aktiv`}
      className="flex-row items-center"
      style={{ gap: space.xs }}>
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
              backgroundColor: active ? colors.carrot : colors.surfaceSoft,
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
      className="rounded-fam-large p-four"
      style={{
        width: '100%',
        minHeight: size === 'large' ? 140 : 138,
        backgroundColor: colors.backgroundElement,
        borderCurve: 'continuous',
        boxShadow: `0 8px ${size === 'large' ? 22 : 20}px ${withAlpha(colors.text, 0.1)}`,
      }}>
      <View className="flex-row items-center justify-between">
        <Txt variant="captionCompact" tone="accent" weight="700" style={{ letterSpacing: 0.5 }}>
          KOCHSTREAK
        </Txt>
        <Txt variant="detail" tone="secondary">
          {hasStreak ? 'Dranbleiben' : 'Dein Fortschritt'}
        </Txt>
      </View>

      <View className="flex-row items-baseline gap-two">
        <Txt variant="bodyLarge" selectable>
          🔥
        </Txt>
        <Txt variant="metricValue" selectable>
          {streak.count}
        </Txt>
        <Txt variant="bodySmall" tone="secondary">
          {streak.count === 1 ? 'Tag am Stück' : 'Tage am Stück'}
        </Txt>
      </View>

      <StreakDays count={streak.count} activeToday={streak.activeToday} />

      <View
        className="flex-row items-center justify-between"
        style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm }}>
        <Txt variant="bodySmall" tone={hasStreak ? 'success' : 'secondary'} weight="600">
          {status}
        </Txt>
        <Txt variant="detail" tone="secondary">
          Bester Wert: {streak.best} Tage
        </Txt>
      </View>
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
