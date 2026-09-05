import { router } from 'expo-router';
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
    gap: 2,
  },
  spacer: {
    flex: 1,
  },
});

function ExpiryDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
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
        accessibilityLabel="Alle bald ablaufenden Artikel im Vorrat anzeigen"
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
          <Txt variant="body" weight="700">
            Läuft bald ab
          </Txt>
        </View>
        <View style={styles.content}>
          {topItems.length > 0 ? (
            topItems.map((item) => (
              <Txt key={item.id} variant="body" tone="secondary" numberOfLines={1}>
                {item.name}
              </Txt>
            ))
          ) : (
            <Txt variant="body" tone="secondary">
              Alles frisch
            </Txt>
          )}
        </View>
        <Txt variant="body" weight="700">
          Vorrat prüfen
        </Txt>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      onPress={() => router.push({ pathname: '/fridge', params: { filter: 'expiring' } })}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Alle bald ablaufenden Artikel im Vorrat anzeigen"
      glassStyle={styles.widget}
      fallbackStyle={[styles.widget, { backgroundColor: colors.backgroundElement }]}
      outerStyle={[styles.pressable, shadow.sm, { shadowColor: colors.shadowCard }]}>
      <View style={[styles.badge, { backgroundColor: withAlpha(colors.carrot, 0.2) }]}>
        <Txt variant="body" tone="warning" weight="700">
          {expiringCount}
        </Txt>
      </View>
      <View style={styles.spacer} />
      <Txt variant="body" tone="secondary">
        Läuft bald ab
      </Txt>
      <Txt variant="body" weight="700">
        Vorrat prüfen
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
