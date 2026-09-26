import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useCurrentGoal, useFoodEntries } from '@/features/calorie-tracking/api';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { DashboardCardShell } from '@/features/dashboard/components/dashboard-card-shell';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';

const styles = StyleSheet.create({
  smallCard: {
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
  },
  largeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
  ringWrap: {
    width: 113,
    height: 113,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    minWidth: 0,
    flex: 1,
    gap: space.xs,
  },
});

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function CalorieDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { i18n, t } = useTranslation();
  const { colors } = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const todayIso = toIsoDate(new Date());

  const { data: currentGoal } = useCurrentGoal(userId);
  const { data: todayEntries = [] } = useFoodEntries(userId, todayIso);

  const totals = calculateDailyTotals(
    todayEntries.map((e) => ({
      kcal: e.kcal,
      proteinG: e.protein_g,
      carbsG: e.carbs_g,
      fatG: e.fat_g,
    })),
  );

  const aufgenommen = totals.kcal;
  const ziel = currentGoal?.daily_kcal ?? 0;
  const verbleibend = Math.round(ziel - aufgenommen);

  if (size === 'small') {
    return (
      <DashboardCardShell
        size={size}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityLabel={t('dashboard.cards.calories.titleSmall')}
        style={styles.smallCard}>
        <View style={styles.row}>
          <Txt variant="eyebrow" tone="secondary" weight="700">
            {t('dashboard.cards.calories.titleSmall')}
          </Txt>
          <Txt variant="label" tone={ziel === 0 ? 'secondary' : 'primary'}>
            {ziel === 0 ? '—' : `${Math.round((aufgenommen / (ziel || 1)) * 100)}%`}
          </Txt>
        </View>

        <View style={styles.smallRing}>
          <ProgressRing
            value={aufgenommen}
            target={ziel}
            preset="compact"
            label="kcal"
            displayMode="count"
            progressColor={colors.danger}
            trackColor={colors.border}
          />
        </View>

        <View style={styles.centered}>
          <Txt
            variant="caption"
            tone={ziel === 0 ? 'secondary' : verbleibend < 0 ? 'danger' : 'primary'}
            weight="500"
            numberOfLines={2}>
            {ziel === 0
              ? t('dashboard.cards.calories.noGoal')
              : verbleibend >= 0
                ? t('dashboard.cards.calories.remaining', { count: verbleibend })
                : t('dashboard.cards.calories.over', { count: Math.abs(verbleibend) })}
          </Txt>
        </View>
      </DashboardCardShell>
    );
  }

  return (
    <DashboardCardShell
      size={size}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityLabel={t('dashboard.cards.calories.today')}
      style={styles.largeCard}>
      <View style={styles.ringWrap}>
        <ProgressRing
          value={aufgenommen}
          target={ziel}
          preset="dashboard"
          label={t('dashboard.cards.calories.ringLabel')}
          displayMode="percent"
          progressColor={colors.danger}
          trackColor={colors.border}
        />
      </View>
      <View style={styles.copy}>
        <Txt variant="label" tone="secondary">
          {t('dashboard.cards.calories.today')}
        </Txt>
        <Txt variant="title">
          {new Intl.NumberFormat(i18n.language).format(Math.round(aufgenommen))}
        </Txt>
        <Txt
          variant="body"
          tone={ziel === 0 ? 'secondary' : verbleibend < 0 ? 'danger' : 'primary'}>
          {ziel === 0
            ? t('dashboard.cards.calories.noGoalSet')
            : verbleibend >= 0
              ? t('dashboard.cards.calories.remainingLong', { count: verbleibend })
              : t('dashboard.cards.calories.overGoal', { count: Math.abs(verbleibend) })}
        </Txt>
      </View>
    </DashboardCardShell>
  );
}

registerCard({
  id: 'calories',
  moduleKey: 'calories',
  order: 10,
  defaultSize: 'large',
  component: CalorieDashboardCard,
});
