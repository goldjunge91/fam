import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamIcon } from '@/components/fam-icon';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useCurrentGoal, useFoodEntries } from '@/features/calorie-tracking/api';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { getExpiryInfo } from '@/features/fridge/expiry';
import { useExpiryNotifications } from '@/features/fridge/use-expiry-notifications';
import { useFridgeItems } from '@/features/fridge/use-fridge-items';
import { useActiveHousehold } from '@/features/household/active-household-provider';
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

  const { data: fridgeItems = [] } = useFridgeItems(householdId);
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

  // Kein natives Tab-Bar-Polster mehr noetig (#150) — nur noch Puffer fuer
  // den schwebenden Plus-Button.
  const bottomPadding = insets.bottom + Spacing.four + Spacing.six;

  return (
    <Screen
      title="Übersicht"
      subtitle={heute}
      scroll={false}
      chrome={{ onMenuPress: openDrawer, onAvatarPress: openProfile, initials }}
      backgroundGradient={hubGradient}>
      <ScrollView
        testID="dashboard-scroll-view"
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
          style={[
            styles.glassCard,
            styles.calorieCard,
            {
              backgroundColor: theme.backgroundElement,
              boxShadow: `0 8px 22px ${withAlpha(theme.shadowCard, 0.1)}`,
            },
          ]}>
          <View style={styles.ringWrap}>
            <ProgressRing
              value={aufgenommen}
              target={ziel}
              size={94}
              strokeWidth={10}
              label="Kalorien"
              displayMode="percent"
              progressColor="#D9785C"
              trackColor="#DAD3DB"
            />
          </View>
          <View style={styles.calorieCopy}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.calorieLabel}>
              Kalorien heute
            </ThemedText>
            <ThemedText type="title" style={styles.calorieValue}>
              {Math.round(aufgenommen).toLocaleString('de-DE')}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor={ziel === 0 ? 'textSecondary' : 'accent'}
              style={styles.calorieRemaining}>
              {ziel === 0
                ? 'Noch kein Ziel gesetzt'
                : verbleibend >= 0
                  ? `${verbleibend} kcal verbleibend`
                  : `${Math.abs(verbleibend)} kcal über dem Ziel`}
            </ThemedText>
          </View>
        </View>

        {/* Heute geplant (#150, Figma "Heute geplant") */}
        <Pressable
          onPress={() => router.push('/meal-planner')}
          accessibilityRole="button"
          accessibilityLabel="Essensplan öffnen"
          style={[
            styles.glassCard,
            styles.plannedCard,
            {
              backgroundColor: theme.backgroundElement,
              boxShadow: `0 8px 22px ${withAlpha(theme.shadowCard, 0.1)}`,
            },
          ]}>
          <FamIcon name="mealArtwork" size={79} />
          <View style={styles.plannedCopy}>
            <ThemedText type="small" themeColor="danger" style={styles.plannedKicker}>
              HEUTE GEPLANT
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.plannedTitle}>
              {nextMeal?.recipe_title ?? 'Noch nichts geplant'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.plannedMeta}>
              {nextMeal
                ? `${MEAL_SLOT_LABELS[nextMeal.meal_slot]} · ${nextMeal.portions} Portionen`
                : 'Wochenplan öffnen'}
            </ThemedText>
          </View>
          <FamIcon name="chevron" size={20} />
        </Pressable>

        {/* Vorrat / Einkauf — kompakte Navigations-Kacheln statt Inline-Liste (#150) */}
        <View style={styles.widgetRow}>
          <Pressable
            onPress={() => router.push({ pathname: '/fridge', params: { filter: 'expiring' } })}
            accessibilityRole="button"
            accessibilityLabel="Alle bald ablaufenden Artikel im Vorrat anzeigen"
            style={[
              styles.glassCard,
              styles.widget,
              {
                backgroundColor: theme.backgroundElement,
                boxShadow: `0 8px 20px ${withAlpha(theme.shadowCard, 0.08)}`,
              },
            ]}>
            <View style={[styles.widgetBadge, { backgroundColor: `${theme.warning}33` }]}>
              <ThemedText type="smallBold" themeColor="warning">
                {expiringCount}
              </ThemedText>
            </View>
            <View style={styles.widgetSpacer} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.widgetLabel}>
              Läuft bald ab
            </ThemedText>
            <ThemedText type="smallBold" style={styles.widgetAction}>
              Vorrat prüfen
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => router.push('/shopping-list')}
            accessibilityRole="button"
            accessibilityLabel="Einkaufsliste öffnen"
            style={[
              styles.glassCard,
              styles.widget,
              {
                backgroundColor: theme.backgroundElement,
                boxShadow: `0 8px 20px ${withAlpha(theme.shadowCard, 0.08)}`,
              },
            ]}>
            <View style={[styles.widgetBadge, { backgroundColor: `${theme.accent}26` }]}>
              <ThemedText type="smallBold" themeColor="accent">
                {openShoppingCount}
              </ThemedText>
            </View>
            <View style={styles.widgetSpacer} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.widgetLabel}>
              Einkauf
            </ThemedText>
            <ThemedText type="smallBold" style={styles.widgetAction}>
              {openShoppingCount > 0 ? 'Noch offen' : 'Erledigt'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    borderCurve: 'continuous',
  },
  calorieCard: {
    height: 176,
    borderRadius: Radius.large,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 22,
    paddingVertical: 20,
    marginBottom: 15,
  },
  ringWrap: {
    width: 113,
    height: 113,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieCopy: {
    flex: 1,
    gap: 4,
  },
  calorieLabel: {
    ...FontSize[13],
    lineHeight: 18,
    fontWeight: '400',
  },
  calorieValue: {
    ...FontSize[27],
    lineHeight: 34,
    fontWeight: '500',
  },
  calorieRemaining: {
    ...FontSize[13],
    lineHeight: 18,
    fontWeight: '400',
  },
  plannedCard: {
    height: 140,
    borderRadius: Radius.large,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 16,
    paddingRight: 18,
    paddingVertical: 16,
    marginBottom: 15,
  },
  plannedCopy: {
    flex: 1,
    gap: 5,
  },
  plannedKicker: {
    ...FontSize[11],
    lineHeight: 16,
    letterSpacing: 0.1,
    fontWeight: '500',
  },
  plannedTitle: {
    ...FontSize[17],
    lineHeight: 22,
    fontWeight: '500',
  },
  plannedMeta: {
    ...FontSize[12],
    lineHeight: 16,
    fontWeight: '400',
  },
  widgetRow: {
    flexDirection: 'row',
    gap: 12,
  },
  widget: {
    flex: 1,
    height: 138,
    borderRadius: Radius.large,
    padding: 16,
    gap: 8,
  },
  widgetBadge: {
    alignSelf: 'flex-start',
    minWidth: 36,
    height: 28,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  widgetSpacer: {
    flex: 1,
  },
  widgetLabel: {
    ...FontSize[14],
    lineHeight: 20,
    fontWeight: '400',
  },
  widgetAction: {
    ...FontSize[17],
    lineHeight: 22,
    fontWeight: '500',
  },
});
