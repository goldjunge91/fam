import { router } from 'expo-router';
import { View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { withAlpha } from '@/constants/theme';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { getExpiryInfo } from '@/features/inventory/expiry';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';
import { useTheme } from '@/hooks/use-theme';

// GlassView hat kein cssInterop, deshalb RN-Style.
const WIDGET_GLASS_STYLE = {
  borderRadius: 28,
  padding: 16,
  gap: 8,
};

function ExpiryDashboardCard({ size, onLongPress }: DashboardCardProps) {
  const theme = useTheme();
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
    const topItems = expiringItems.slice(0, 3);

    return (
      <GlassCard
        onPress={() => router.push({ pathname: '/fridge', params: { filter: 'expiring' } })}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel="Alle bald ablaufenden Artikel im Vorrat anzeigen"
        fallbackClassName="dashboard-planned-card"
        glassStyle={{ ...WIDGET_GLASS_STYLE, flexDirection: 'column' as const }}
        outerStyle={{
          height: 140,
          borderRadius: 28,
          borderCurve: 'continuous',
          boxShadow: `0 8px 22px ${withAlpha(theme.shadowCard, 0.1)}`,
        }}>
        <View className="flex-row items-center gap-three">
          <View className="dashboard-widget-badge bg-warning/20">
            <ThemedText type="smallBold" themeColor="warning">
              {expiringCount}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">Läuft bald ab</ThemedText>
        </View>
        <View className="flex-1 justify-center gap-[2px]">
          {topItems.length > 0 ? (
            topItems.map((item) => (
              <ThemedText key={item.id} type="small" themeColor="textSecondary" numberOfLines={1}>
                {item.name}
              </ThemedText>
            ))
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Alles frisch
            </ThemedText>
          )}
        </View>
        <ThemedText type="smallBold" className="dashboard-widget-action">
          Vorrat prüfen
        </ThemedText>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      onPress={() => router.push({ pathname: '/fridge', params: { filter: 'expiring' } })}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Alle bald ablaufenden Artikel im Vorrat anzeigen"
      fallbackClassName="dashboard-widget"
      glassStyle={WIDGET_GLASS_STYLE}
      outerStyle={{
        width: '100%',
        height: 138,
        borderRadius: 28,
        borderCurve: 'continuous',
        boxShadow: `0 8px 20px ${withAlpha(theme.shadowCard, 0.08)}`,
      }}>
      <View className="dashboard-widget-badge bg-warning/20">
        <ThemedText type="smallBold" themeColor="warning">
          {expiringCount}
        </ThemedText>
      </View>
      <View className="flex-1" />
      <ThemedText type="small" themeColor="textSecondary" className="dashboard-widget-label">
        Läuft bald ab
      </ThemedText>
      <ThemedText type="smallBold" className="dashboard-widget-action">
        Vorrat prüfen
      </ThemedText>
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
