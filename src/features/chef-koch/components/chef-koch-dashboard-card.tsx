import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FamIcon } from '@/components/icons/fam-icon';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { getChefKochDestination } from '@/features/chef-koch/navigation';
import { DashboardCardShell } from '@/features/dashboard/components/dashboard-card-shell';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { getExpiryInfo } from '@/features/inventory/expiry';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';
import { usePremium } from '@/features/premium/premium-provider';

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.backgroundSoft,
    gap: theme.space.md,
  },
  compactCard: {
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  mark: {
    width: theme.controlSizes.touchTarget,
    height: theme.controlSizes.touchTarget,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.premiumGradientStart,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
    borderTopWidth: theme.borderWidth.base,
    borderTopColor: theme.border,
  },
  footerCopy: {
    flex: 1,
    minWidth: 0,
  },
}));

function ChefKochDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const { hasAI } = usePremium();
  const { data: inventory = [] } = useInventoryItems(activeHouseholdId ?? undefined);
  const now = new Date();
  const urgentItems = inventory.filter((item) => {
    const daysLeft = getExpiryInfo(item.expiry_date, now).daysLeft;
    return daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
  });
  const urgentItem = urgentItems[0];
  const isDisabled = disabled || activeHouseholdId === null;
  const hint = !hasAI
    ? t('dashboard.cards.chefKoch.locked')
    : urgentItem
      ? t('dashboard.cards.chefKoch.urgent', { name: urgentItem.name })
      : t('dashboard.cards.chefKoch.description');

  function openChefKoch() {
    if (isDisabled) return;
    router.push(getChefKochDestination());
  }

  return (
    <DashboardCardShell
      size={size}
      onPress={openChefKoch}
      onLongPress={onLongPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={
        hasAI
          ? t('dashboard.cards.chefKoch.accessibility')
          : t('dashboard.cards.chefKoch.accessibilityLocked')
      }
      style={[styles.card, size === 'small' ? styles.compactCard : null]}>
      <View style={styles.header}>
        <View style={styles.mark} importantForAccessibility="no">
          <FamIcon name="recipes" size={24} color={colors.premiumOnSurface} />
        </View>
        <View style={styles.copy}>
          <Txt variant="body" weight="700" numberOfLines={2}>
            {t('dashboard.cards.chefKoch.title')}
          </Txt>
          {size === 'large' ? (
            <Txt variant="caption" tone="secondary" numberOfLines={2}>
              {hint}
            </Txt>
          ) : null}
        </View>
      </View>
      {size === 'large' ? (
        <View style={styles.footer}>
          <Txt variant="caption" tone={urgentItem && hasAI ? 'warning' : 'secondary'}>
            {hasAI ? t('dashboard.cards.chefKoch.cta') : t('dashboard.cards.chefKoch.paywallCta')}
          </Txt>
          <FamIcon name="chevron" size={20} color={colors.text} />
        </View>
      ) : null}
    </DashboardCardShell>
  );
}

registerCard({
  id: 'chefKoch',
  moduleKey: 'recipes',
  order: 10,
  defaultSize: 'large',
  component: ChefKochDashboardCard,
});
