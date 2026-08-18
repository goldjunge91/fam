import { router } from 'expo-router';
import { View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { withAlpha } from '@/constants/theme';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useShoppingList } from '@/features/shopping-list/use-shopping-list';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
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
          height: 140,
          borderRadius: 28,
          borderCurve: 'continuous',
          boxShadow: `0 8px 22px ${withAlpha(theme.shadowCard, 0.1)}`,
        }}>
        <View className="flex-row items-center gap-three">
          <View className="dashboard-widget-badge bg-accent/[15%]">
            <ThemedText type="smallBold" themeColor="accent">
              {openCount}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">Einkauf</ThemedText>
        </View>
        <View className="flex-1 justify-center gap-two">
          {totalCount > 0 ? (
            <>
              <ProgressBar value={progress} />
              <ThemedText type="small" themeColor="textSecondary">
                {checkedCount} von {totalCount} erledigt
              </ThemedText>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Liste ist leer
            </ThemedText>
          )}
        </View>
        <ThemedText type="smallBold" className="dashboard-widget-action">
          {openCount > 0 ? 'Noch offen' : 'Erledigt'}
        </ThemedText>
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
        height: 138,
        borderRadius: 28,
        borderCurve: 'continuous',
        boxShadow: `0 8px 20px ${withAlpha(theme.shadowCard, 0.08)}`,
      }}>
      <View className="dashboard-widget-badge bg-accent/[15%]">
        <ThemedText type="smallBold" themeColor="accent">
          {openCount}
        </ThemedText>
      </View>
      <View className="flex-1" />
      <ThemedText type="small" themeColor="textSecondary" className="dashboard-widget-label">
        Einkauf
      </ThemedText>
      <ThemedText type="smallBold" className="dashboard-widget-action">
        {openCount > 0 ? 'Noch offen' : 'Erledigt'}
      </ThemedText>
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
