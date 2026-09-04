import { router } from 'expo-router';
import { View } from 'react-native';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { Txt } from '@/constants/ui';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { getExpiryInfo } from '@/features/inventory/expiry';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';

// GlassView hat kein cssInterop, deshalb RN-Style.
const WIDGET_GLASS_STYLE = {
  borderRadius: 28,
  padding: 16,
  gap: 8,
};

function ExpiryDashboardCard({ size, onLongPress, editHeight }: DashboardCardProps) {
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
        accessibilityRole="button"
        accessibilityLabel="Alle bald ablaufenden Artikel im Vorrat anzeigen"
        fallbackClassName="dashboard-planned-card"
        glassStyle={{ ...WIDGET_GLASS_STYLE, flexDirection: 'column' as const }}
        outerStyle={{
          minHeight: 140,
          height: editHeight,
          borderRadius: 28,
          borderCurve: 'continuous',
          boxShadow: `0 8px 22px ${withAlpha(colors.text, 0.1)}`,
        }}>
        <View className="flex-row items-center gap-three">
          <View
            className="dashboard-widget-badge"
            style={{ backgroundColor: withAlpha(colors.carrot, 0.2) }}>
            <Txt variant="body" tone="warning" weight="700">
              {expiringCount}
            </Txt>
          </View>
          <Txt variant="body" weight="700">
            Läuft bald ab
          </Txt>
        </View>
        <View className="flex-1 justify-center gap-[2px]">
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
        <Txt variant="body" weight="700" className="dashboard-widget-action">
          Vorrat prüfen
        </Txt>
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
        minHeight: 138,
        height: editHeight,
        borderRadius: 28,
        borderCurve: 'continuous',
        boxShadow: `0 8px 20px ${withAlpha(colors.text, 0.08)}`,
      }}>
      <View
        className="dashboard-widget-badge"
        style={{ backgroundColor: withAlpha(colors.carrot, 0.2) }}>
        <Txt variant="body" tone="warning" weight="700">
          {expiringCount}
        </Txt>
      </View>
      <View className="flex-1" />
      <Txt
        variant="body"
        tone="secondary"
        className="dashboard-widget-label"
        style={{ fontSize: 15, lineHeight: 22 }}>
        Läuft bald ab
      </Txt>
      <Txt
        variant="body"
        weight="700"
        className="dashboard-widget-action"
        style={{ fontSize: 18, lineHeight: 24 }}>
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
