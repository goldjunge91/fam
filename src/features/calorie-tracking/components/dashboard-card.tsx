import { Pressable, View } from 'react-native';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useCurrentGoal, useFoodEntries } from '@/features/calorie-tracking/api';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function CalorieDashboardCard({ size, onLongPress }: DashboardCardProps) {
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
      <Pressable
        onLongPress={onLongPress}
        className="rounded-fam-large flex-col justify-between p-four"
        style={{
          width: '100%',
          minHeight: 138,
          backgroundColor: colors.backgroundElement,
          borderCurve: 'continuous',
          boxShadow: `0 8px 20px ${withAlpha(colors.text, 0.08)}`,
        }}>
        <View className="flex-row items-center justify-between">
          <Txt
            variant="captionCompact"
            tone="secondary"
            weight="700"
            style={{ letterSpacing: 0.5 }}>
            KALORIEN
          </Txt>
          <Txt variant="label" tone={ziel === 0 ? 'secondary' : 'primary'}>
            {ziel === 0 ? '—' : `${Math.round((aufgenommen / (ziel || 1)) * 100)}%`}
          </Txt>
        </View>

        <View className="items-center justify-center my-one">
          <ProgressRing
            value={aufgenommen}
            target={ziel}
            preset="compact"
            label="kcal"
            displayMode="count"
            progressColor={colors.tomato}
            trackColor={colors.border}
          />
        </View>

        <View className="items-center">
          <Txt
            variant="detail"
            tone={ziel === 0 ? 'secondary' : verbleibend < 0 ? 'danger' : 'primary'}
            weight="500"
            numberOfLines={2}>
            {ziel === 0
              ? 'Kein Ziel'
              : verbleibend >= 0
                ? `${verbleibend} kcal übrig`
                : `${Math.abs(verbleibend)} kcal drüber`}
          </Txt>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      className="dashboard-calorie-card"
      style={{
        marginBottom: 0,
        borderCurve: 'continuous',
        boxShadow: `0 8px 22px ${withAlpha(colors.text, 0.1)}`,
      }}>
      <View className="dashboard-ring-wrap">
        <ProgressRing
          value={aufgenommen}
          target={ziel}
          preset="dashboard"
          label="Kalorien"
          displayMode="percent"
          progressColor={colors.tomato}
          trackColor={colors.border}
        />
      </View>
      <View className="dashboard-calorie-copy">
        <Txt variant="label" tone="secondary">
          Kalorien heute
        </Txt>
        <Txt variant="metricValue">{Math.round(aufgenommen).toLocaleString('de-DE')}</Txt>
        <Txt
          variant="body"
          tone={ziel === 0 ? 'secondary' : verbleibend < 0 ? 'danger' : 'primary'}>
          {ziel === 0
            ? 'Noch kein Ziel gesetzt'
            : verbleibend >= 0
              ? `${verbleibend} kcal verbleibend`
              : `${Math.abs(verbleibend)} kcal über dem Ziel`}
        </Txt>
      </View>
    </Pressable>
  );
}

registerCard({
  id: 'calories',
  moduleKey: 'calories',
  order: 10,
  defaultSize: 'large',
  component: CalorieDashboardCard,
});
