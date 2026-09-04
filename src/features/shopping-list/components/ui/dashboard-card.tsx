import { router } from 'expo-router';
import { View } from 'react-native';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Txt } from '@/constants/ui';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useShoppingList } from '@/features/shopping-list/hooks/use-shopping-list';

// GlassView hat kein cssInterop, deshalb RN-Style.
const WIDGET_GLASS_STYLE = {
  borderRadius: 28,
  padding: 16,
  gap: 8,
};

/**
 * Einkaufs-Dashboard-Card: zeigt offene Einkaufslisteneintraege.
 * Large = Badge + Label + Fortschrittsbalken + Action.
 * Small = Badge + Label + Action (wie bisher).
 */
function ShoppingDashboardCard({ size, onLongPress }: DashboardCardProps) {
  const { colors: theme } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;
  const { data: shoppingGroups = [] } = useShoppingList(householdId);

  const allItems = shoppingGroups.flatMap((g) => g.items);
  const openCount = allItems.filter((item) => item.checked_at === null).length;
  const totalCount = allItems.length;

  if (size === 'large') {
    const checkedCount = totalCount - openCount;
    const progress = totalCount > 0 ? checkedCount / totalCount : 0;

    return (
      <GlassCard
        onPress={() => router.push('/shopping-list')}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel="Einkaufsliste öffnen"
        fallbackClassName="dashboard-planned-card"
        glassStyle={{ ...WIDGET_GLASS_STYLE, flexDirection: 'column' as const }}
        outerStyle={{
          minHeight: 140,
          borderRadius: 28,
          borderCurve: 'continuous',
          boxShadow: `0 8px 22px ${withAlpha(theme.text, 0.1)}`,
        }}>
        <View className="flex-row items-center gap-three">
          <View className="dashboard-widget-badge bg-accent/[15%]">
            <Txt variant="body" weight="700" tone="primary">
              {openCount}
            </Txt>
          </View>
          <Txt variant="body" weight="700">
            Einkauf
          </Txt>
        </View>
        <View className="flex-1 justify-center gap-two">
          {totalCount > 0 ? (
            <>
              <ProgressBar value={progress} />
              <Txt variant="body" tone="secondary">
                {checkedCount} von {totalCount} erledigt
              </Txt>
            </>
          ) : (
            <Txt variant="body" tone="secondary">
              Liste ist leer
            </Txt>
          )}
        </View>
        <Txt variant="controlValueLarge" weight="700">
          {openCount > 0 ? 'Noch offen' : 'Erledigt'}
        </Txt>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      onPress={() => router.push('/shopping-list')}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Einkaufsliste öffnen"
      fallbackClassName="dashboard-widget"
      glassStyle={WIDGET_GLASS_STYLE}
      outerStyle={{
        width: '100%',
        minHeight: 138,
        borderRadius: 28,
        borderCurve: 'continuous',
        boxShadow: `0 8px 20px ${withAlpha(theme.text, 0.08)}`,
      }}>
      <View className="dashboard-widget-badge bg-accent/[15%]">
        <Txt variant="body" weight="700" tone="primary">
          {openCount}
        </Txt>
      </View>
      <View className="flex-1" />
      <Txt variant="bodyLarge" tone="secondary">
        Einkauf
      </Txt>
      <Txt variant="controlValueLarge" weight="700">
        {openCount > 0 ? 'Noch offen' : 'Erledigt'}
      </Txt>
    </GlassCard>
  );
}

registerCard({
  id: 'shoppingList',
  moduleKey: 'shoppingList',
  order: 31,
  defaultSize: 'small',
  component: ShoppingDashboardCard,
});
