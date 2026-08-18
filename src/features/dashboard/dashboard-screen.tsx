import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamIcon } from '@/components/icons/fam-icon';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Layout, Spacing } from '@/constants/layout';
import { withAlpha } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useCurrentGoal, useFoodEntries } from '@/features/calorie-tracking/api';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { getExpiryInfo } from '@/features/inventory/expiry';
import { useExpiryNotifications } from '@/features/inventory/use-expiry-notifications';
import { useInventoryItems } from '@/features/inventory/use-inventory-items';
import { useMealPlanEntriesInRange } from '@/features/meal-planner/use-meal-plans';
import { MEAL_SLOT_LABELS, MEAL_SLOTS } from '@/features/meal-planner/week';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useShoppingList } from '@/features/shopping-list/use-shopping-list';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { triggerHouseholdSync } from '@/lib/sync/sync-runner';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// `GlassView` hat kein cssInterop (s. glass-card.tsx), deshalb hier als
// RN-Style statt Tailwind-Klasse — muss in Radius/Padding/Gap mit
// `.dashboard-planned-card`/`.dashboard-widget` in global.css in Sync
// bleiben. `borderRadius` steht bewusst auch im jeweiligen `outerStyle`
// weiter unten, damit der Fallback-Schatten dieselbe Rundung bekommt.
const PLANNED_GLASS_STYLE = {
  borderRadius: 28,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 16,
  paddingLeft: 16,
  paddingRight: 18,
  paddingVertical: 16,
};
const WIDGET_GLASS_STYLE = {
  borderRadius: 28,
  padding: 16,
  gap: 8,
};

export function DashboardScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { openDrawer, openProfile } = useNavigationChrome();
  const initials = useProfileInitials();
  const now = new Date();
  const heute = now.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const { data: fridgeItems = [] } = useInventoryItems(householdId);
  const { data: shoppingGroups = [] } = useShoppingList(householdId);

  // Hintergrund-Benachrichtigungen aktivieren/synchronisieren
  useExpiryNotifications(householdId);

  const { session } = useSession();
  const userId = session?.user.id;
  const todayIso = toIsoDate(now);
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

  // Naechster geplanter Eintrag von heute, in der Reihenfolge Fruehstueck ->
  // Mittag -> Abend — die Slot-Reihenfolge steht nicht in der DB, deshalb
  // client-seitig sortiert (#150, Figma "Heute geplant").
  const { data: todayMealEntries = [] } = useMealPlanEntriesInRange(
    householdId,
    todayIso,
    todayIso,
  );
  const nextMeal = [...todayMealEntries].sort(
    (a, b) => MEAL_SLOTS.indexOf(a.meal_slot) - MEAL_SLOTS.indexOf(b.meal_slot),
  )[0];

  // "Laeuft bald ab" (in <= 3 Tagen oder bereits abgelaufen) fuer das Vorrat-Widget.
  const expiringCount = fridgeItems.filter((item) => {
    if (!item.expiry_date) return false;
    const info = getExpiryInfo(item.expiry_date, now);
    return (
      info.bucket === 'expired' ||
      info.bucket === 'critical' ||
      (info.daysLeft !== null && info.daysLeft <= 3)
    );
  }).length;

  const openShoppingCount = shoppingGroups
    .flatMap((g) => g.items)
    .filter((item) => item.checked_at === null).length;

  // `useSyncEngine` laeuft bereits app-weit gemountet ((app)/_layout.tsx) —
  // ein erneuter Hook-Aufruf hier wuerde gegen dessen
  // Duplicate-Mount-Schutz laufen. Pull-to-Refresh ruft stattdessen die
  // exportierte `triggerHouseholdSync()` direkt auf (#93).
  async function handleRefresh() {
    if (!householdId) return;
    setRefreshing(true);
    try {
      await triggerHouseholdSync([householdId], false, queryClient);
    } finally {
      setRefreshing(false);
    }
  }

  const bottomPadding = insets.bottom + Spacing.four + Layout.floatingActionClearance;

  return (
    <Screen
      title="Übersicht"
      subtitle={heute}
      scroll={false}
      applyBottomPadding={false}
      chrome={{ onMenuPress: openDrawer, onAvatarPress: openProfile, initials }}
      backgroundGradient={hubGradient}>
      <ScrollView
        testID="dashboard-scroll-view"
        className="flex-1"
        // bottomPadding kombiniert Safe-Area-Insets — echter Laufzeitwert.
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            testID="dashboard-refresh-control"
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }>
        {/* Kalorien heute — kompakter Ring + Copy nebeneinander (#150, Figma "Kalorien heute") */}
        <View
          className="dashboard-calorie-card"
          // borderCurve/boxShadow: kein Tailwind-Aequivalent bzw. dynamische
          // Opazitaet (withAlpha).
          style={{
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
        </View>

        {/* Heute geplant (#150, Figma "Heute geplant") — echtes Liquid Glass
        auf iOS 26+, sonst solide Karte wie zuvor (Variante B aus dem
        Glass-Mock: nur Navigations-Kacheln bekommen Glas, s. glass-card.tsx). */}
        <GlassCard
          onPress={() => router.push('/meal-planner')}
          accessibilityRole="button"
          accessibilityLabel="Essensplan öffnen"
          fallbackClassName="dashboard-planned-card"
          glassStyle={PLANNED_GLASS_STYLE}
          outerStyle={{
            height: 140,
            marginBottom: 15,
            borderRadius: 28,
            borderCurve: 'continuous',
            boxShadow: `0 8px 22px ${withAlpha(theme.shadowCard, 0.1)}`,
          }}>
          <FamIcon name="mealArtwork" size={79} />
          <View className="dashboard-planned-copy">
            <ThemedText type="small" themeColor="danger" className="dashboard-planned-kicker">
              HEUTE GEPLANT
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1} className="dashboard-planned-title">
              {nextMeal?.recipe_title ?? 'Noch nichts geplant'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" className="dashboard-planned-meta">
              {nextMeal
                ? `${MEAL_SLOT_LABELS[nextMeal.meal_slot]} · ${nextMeal.portions} Portionen`
                : 'Wochenplan öffnen'}
            </ThemedText>
          </View>
          <FamIcon name="chevron" size={20} />
        </GlassCard>

        {/* Vorrat / Einkauf — kompakte Navigations-Kacheln statt Inline-Liste (#150) */}
        <View className="dashboard-widget-row">
          <GlassCard
            onPress={() => router.push({ pathname: '/fridge', params: { filter: 'expiring' } })}
            accessibilityRole="button"
            accessibilityLabel="Alle bald ablaufenden Artikel im Vorrat anzeigen"
            fallbackClassName="dashboard-widget"
            glassStyle={WIDGET_GLASS_STYLE}
            outerStyle={{
              flex: 1,
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

          <GlassCard
            onPress={() => router.push('/shopping-list')}
            accessibilityRole="button"
            accessibilityLabel="Einkaufsliste öffnen"
            fallbackClassName="dashboard-widget"
            glassStyle={WIDGET_GLASS_STYLE}
            outerStyle={{
              flex: 1,
              height: 138,
              borderRadius: 28,
              borderCurve: 'continuous',
              boxShadow: `0 8px 20px ${withAlpha(theme.shadowCard, 0.08)}`,
            }}>
            <View className="dashboard-widget-badge bg-accent/[15%]">
              <ThemedText type="smallBold" themeColor="accent">
                {openShoppingCount}
              </ThemedText>
            </View>
            <View className="flex-1" />
            <ThemedText type="small" themeColor="textSecondary" className="dashboard-widget-label">
              Einkauf
            </ThemedText>
            <ThemedText type="smallBold" className="dashboard-widget-action">
              {openShoppingCount > 0 ? 'Noch offen' : 'Erledigt'}
            </ThemedText>
          </GlassCard>
        </View>
      </ScrollView>
    </Screen>
  );
}
