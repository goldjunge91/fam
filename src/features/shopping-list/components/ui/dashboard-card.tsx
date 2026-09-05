import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { radius, shadow, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Txt } from '@/constants/ui';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useShoppingList } from '@/features/shopping-list/hooks/use-shopping-list';

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  widget: {
    width: '100%',
    minHeight: 138,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
  },
  largeWidget: {
    flexDirection: 'column',
    minHeight: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  badge: {
    alignSelf: 'flex-start',
    minWidth: 36,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: space.sm,
  },
  spacer: {
    flex: 1,
  },
});

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
        glassStyle={[styles.widget, styles.largeWidget]}
        fallbackStyle={[
          styles.widget,
          styles.largeWidget,
          { backgroundColor: theme.backgroundElement },
        ]}
        outerStyle={[styles.pressable, shadow.sm, { shadowColor: theme.shadowCard }]}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: withAlpha(theme.accent, 0.15) }]}>
            <Txt variant="body" weight="700" tone="primary">
              {openCount}
            </Txt>
          </View>
          <Txt variant="body" weight="700">
            Einkauf
          </Txt>
        </View>
        <View style={styles.content}>
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
        <Txt variant="body" weight="700">
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
      glassStyle={styles.widget}
      fallbackStyle={[styles.widget, { backgroundColor: theme.backgroundElement }]}
      outerStyle={[styles.pressable, shadow.sm, { shadowColor: theme.shadowCard }]}>
      <View style={[styles.badge, { backgroundColor: withAlpha(theme.accent, 0.15) }]}>
        <Txt variant="body" weight="700" tone="primary">
          {openCount}
        </Txt>
      </View>
      <View style={styles.spacer} />
      <Txt variant="body" tone="secondary">
        Einkauf
      </Txt>
      <Txt variant="body" weight="700">
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
