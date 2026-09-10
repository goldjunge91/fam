import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { radius, shadow, space, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { Txt } from '@/constants/ui';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { getExpiryInfo } from '@/features/inventory/expiry';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';

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
    overflow: 'hidden',
  },
  largeWidget: {
    flexDirection: 'column',
    minHeight: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minWidth: 0,
    width: '100%',
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
    minWidth: 0,
    overflow: 'hidden',
    justifyContent: 'center',
    gap: space.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minWidth: 0,
    width: '100%',
  },
  itemName: {
    flex: 1,
    minWidth: 0,
  },
  itemDate: {
    flexShrink: 0,
    minWidth: 82,
    textAlign: 'right',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
});

function getShortExpiryLabel(
  expiryDate: string | null,
  now: Date,
  translate: (key: string, options?: { count: number }) => string,
): string {
  const daysLeft = getExpiryInfo(expiryDate, now).daysLeft;

  if (daysLeft === null) return translate('dashboard.cards.inventory.withoutExpiry');
  if (daysLeft < 0) return translate('dashboard.cards.inventory.overdue');
  if (daysLeft === 0) return translate('dashboard.cards.inventory.today');
  if (daysLeft === 1) return translate('dashboard.cards.inventory.tomorrow');
  return translate('dashboard.cards.inventory.daysRemaining', { count: daysLeft });
}

function ExpiryDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;
  const { data: fridgeItems = [] } = useInventoryItems(householdId);
  const now = new Date();

  const expiringItems = fridgeItems.filter((item) => {
    if (!item.expiry_date) return false;
    const info = getExpiryInfo(item.expiry_date, now);
    return (
      info.bucket === 'expired' ||
      info.bucket === 'critical' ||
      (info.daysLeft !== null && info.daysLeft <= 3)
    );
  });

  const expiringCount = expiringItems.length;

  if (size === 'large') {
    // Top 3 bald ablaufende Artikel anzeigen
    const topItems = expiringItems.slice(0, 3);

    return (
      <GlassCard
        onPress={() => router.push({ pathname: '/fridge', params: { filter: 'expiring' } })}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.cards.inventory.accessibility')}
        glassStyle={[styles.widget, styles.largeWidget]}
        fallbackStyle={[
          styles.widget,
          styles.largeWidget,
          { backgroundColor: colors.backgroundElement },
        ]}
        outerStyle={[styles.pressable, shadow.sm, { shadowColor: colors.shadowCard }]}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: withAlpha(colors.carrot, 0.2) }]}>
            <Txt variant="body" tone="warning" weight="700">
              {expiringCount}
            </Txt>
          </View>
          <Txt
            variant="body"
            weight="700"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.headerTitle}>
            {t('dashboard.cards.inventory.title')}
          </Txt>
        </View>
        <View style={styles.content}>
          {topItems.length > 0 ? (
            topItems.map((item) => {
              const expiryInfo = getExpiryInfo(item.expiry_date, now);
              return (
                <View key={item.id} style={styles.itemRow}>
                  <Txt
                    variant="body"
                    tone="secondary"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.itemName}>
                    {item.name}
                  </Txt>
                  <Txt
                    variant="caption"
                    tone={expiryInfo.bucket === 'expired' ? 'danger' : 'warning'}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.itemDate}>
                    {getShortExpiryLabel(item.expiry_date, now, t)}
                  </Txt>
                </View>
              );
            })
          ) : (
            <Txt variant="body" tone="secondary" numberOfLines={1} ellipsizeMode="tail">
              {t('dashboard.cards.inventory.empty')}
            </Txt>
          )}
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      onPress={() => router.push({ pathname: '/fridge', params: { filter: 'expiring' } })}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.cards.inventory.accessibility')}
      glassStyle={styles.widget}
      fallbackStyle={[styles.widget, { backgroundColor: colors.backgroundElement }]}
      outerStyle={[styles.pressable, shadow.sm, { shadowColor: colors.shadowCard }]}>
      <View style={[styles.badge, { backgroundColor: withAlpha(colors.carrot, 0.2) }]}>
        <Txt variant="body" tone="warning" weight="700">
          {expiringCount}
        </Txt>
      </View>
      <Txt variant="body" tone="secondary" numberOfLines={1} ellipsizeMode="tail">
        {t('dashboard.cards.inventory.title')}
      </Txt>
    </GlassCard>
  );
}

registerCard({
  id: 'inventory',
  moduleKey: 'fridge',
  order: 30,
  defaultSize: 'small',
  component: ExpiryDashboardCard,
});
