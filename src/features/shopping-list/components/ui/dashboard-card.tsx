import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Txt } from '@/constants/ui';
import { DashboardCardShell } from '@/features/dashboard/components/dashboard-card-shell';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useShoppingList } from '@/features/shopping-list/hooks/use-shopping-list';

const styles = StyleSheet.create({
  widget: {
    gap: space.sm,
  },
  largeWidget: {
    flexDirection: 'column',
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
function ShoppingDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { t } = useTranslation();
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
      <DashboardCardShell
        size={size}
        onPress={() => router.push('/shopping-list')}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.cards.shopping.accessibility')}
        style={[styles.widget, styles.largeWidget]}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: withAlpha(theme.accent, 0.15) }]}>
            <Txt variant="body" weight="700" tone="primary">
              {openCount}
            </Txt>
          </View>
          <Txt variant="body" weight="700">
            {t('dashboard.cards.shopping.title')}
          </Txt>
        </View>
        <View style={styles.content}>
          {totalCount > 0 ? (
            <>
              <ProgressBar value={progress} />
              <Txt variant="body" tone="secondary">
                {t('dashboard.cards.shopping.progress', {
                  checked: checkedCount,
                  total: totalCount,
                })}
              </Txt>
            </>
          ) : (
            <Txt variant="body" tone="secondary">
              {t('dashboard.cards.shopping.empty')}
            </Txt>
          )}
        </View>
        <Txt variant="body" weight="700">
          {openCount > 0 ? t('dashboard.cards.shopping.open') : t('dashboard.cards.shopping.done')}
        </Txt>
      </DashboardCardShell>
    );
  }

  return (
    <DashboardCardShell
      size={size}
      onPress={() => router.push('/shopping-list')}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.cards.shopping.accessibility')}
      style={styles.widget}>
      <View style={[styles.badge, { backgroundColor: withAlpha(theme.accent, 0.15) }]}>
        <Txt variant="body" weight="700" tone="primary">
          {openCount}
        </Txt>
      </View>
      <View style={styles.spacer} />
      <Txt variant="body" tone="secondary">
        {t('dashboard.cards.shopping.title')}
      </Txt>
      <Txt variant="body" weight="700">
        {openCount > 0 ? t('dashboard.cards.shopping.open') : t('dashboard.cards.shopping.done')}
      </Txt>
    </DashboardCardShell>
  );
}

registerCard({
  id: 'shoppingList',
  moduleKey: 'shoppingList',
  order: 31,
  defaultSize: 'small',
  component: ShoppingDashboardCard,
});
