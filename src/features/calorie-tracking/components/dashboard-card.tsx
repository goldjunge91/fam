import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { ProgressRing } from '@/components/ui/progress-ring';
import { withAlpha } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useCurrentGoal, useFoodEntries } from '@/features/calorie-tracking/api';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useTheme } from '@/hooks/use-theme';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Kalorien-Dashboard-Card: zeigt den Tagesfortschritt als Ring + Zahlen.
 * Large = voller Ring (94px) + kcal-Wert + verbleibend-Text.
 * Small = kompakter Ring (58px) + nur kcal-Zahl.
 */
function CalorieDashboardCard({ size, onLongPress }: DashboardCardProps) {
  const theme = useTheme();
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
        className="rounded-fam-large flex-col justify-between p-four bg-background-element"
        style={{
          width: '100%',
          height: 138,
          borderCurve: 'continuous',
          boxShadow: `0 8px 20px ${withAlpha(theme.shadowCard, 0.08)}`,
        }}>
        <View className="flex-row items-center justify-between">
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={{ fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5 }}>
            KALORIEN
          </ThemedText>
          <ThemedText
            type="smallBold"
            themeColor={ziel === 0 ? 'textSecondary' : 'accent'}
            style={{ fontSize: 11 }}>
            {ziel === 0 ? '—' : `${Math.round((aufgenommen / (ziel || 1)) * 100)}%`}
          </ThemedText>
        </View>

        <View className="items-center justify-center my-one">
          <ProgressRing
            value={aufgenommen}
            target={ziel}
            preset="compact"
            label="kcal"
            displayMode="count"
            progressColor="#D9785C"
            trackColor="#DAD3DB"
          />
        </View>

        <View className="items-center">
          <ThemedText
            type="small"
            themeColor={ziel === 0 ? 'textSecondary' : 'accent'}
            numberOfLines={1}
            style={{ fontSize: 11, fontWeight: '500' }}>
            {ziel === 0
              ? 'Kein Ziel'
              : verbleibend >= 0
                ? `${verbleibend} kcal übrig`
                : `${Math.abs(verbleibend)} kcal drüber`}
          </ThemedText>
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
        boxShadow: `0 8px 22px ${withAlpha(theme.shadowCard, 0.1)}`,
      }}>
      <View className="dashboard-ring-wrap">
        <ProgressRing
          value={aufgenommen}
          target={ziel}
          preset="dashboard"
          label="Kalorien"
          displayMode="percent"
          progressColor="#D9785C"
          trackColor="#DAD3DB"
        />
      </View>
      <View className="dashboard-calorie-copy">
        <ThemedText type="small" themeColor="textSecondary" className="dashboard-calorie-label">
          Kalorien heute
        </ThemedText>
        <ThemedText type="title" className="dashboard-calorie-value">
          {Math.round(aufgenommen).toLocaleString('de-DE')}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor={ziel === 0 ? 'textSecondary' : 'accent'}
          className="dashboard-calorie-remaining">
          {ziel === 0
            ? 'Noch kein Ziel gesetzt'
            : verbleibend >= 0
              ? `${verbleibend} kcal verbleibend`
              : `${Math.abs(verbleibend)} kcal über dem Ziel`}
        </ThemedText>
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
