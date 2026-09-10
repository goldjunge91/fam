import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { FamIcon } from '@/components/icons/fam-icon';
import { radius, shadow, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { Txt } from '@/constants/ui';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useMealPlanEntriesInRange } from '@/features/meal-planner/use-meal-plans';
import { MEAL_SLOTS } from '@/features/meal-planner/week';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  smallCard: {
    width: '100%',
    minHeight: 138,
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
  },
  smallContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  smallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallArtwork: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.xs,
  },
  largeCard: {
    width: '100%',
    minHeight: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingLeft: space.lg,
    paddingRight: 18,
    paddingVertical: space.lg,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
  },
  largeCopy: {
    minWidth: 0,
    flex: 1,
    gap: space.xs,
  },
});

function MealPlanDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;
  const todayIso = toIsoDate(new Date());

  const { data: todayMealEntries = [] } = useMealPlanEntriesInRange(
    householdId,
    todayIso,
    todayIso,
  );

  const nextMeal = [...todayMealEntries].sort(
    (a, b) => MEAL_SLOTS.indexOf(a.meal_slot) - MEAL_SLOTS.indexOf(b.meal_slot),
  )[0];
  const nextMealLabel = nextMeal
    ? t(`dashboard.cards.mealPlan.mealSlots.${nextMeal.meal_slot}`)
    : null;

  if (size === 'small') {
    return (
      <GlassCard
        onPress={() => router.push('/meal-planner')}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.cards.mealPlan.accessibility')}
        glassStyle={styles.smallCard}
        fallbackStyle={[styles.smallCard, { backgroundColor: colors.backgroundElement }]}
        outerStyle={[styles.pressable, shadow.sm, { shadowColor: colors.shadowCard }]}>
        <View style={styles.smallContent}>
          <View style={styles.smallHeader}>
            <Txt variant="caption" tone="danger" weight="700" style={{ letterSpacing: 0.5 }}>
              {t('dashboard.cards.mealPlan.planned')}
            </Txt>
            <Txt variant="caption" tone="secondary">
              {nextMealLabel ?? t('dashboard.cards.mealPlan.today')}
            </Txt>
          </View>
          <View style={styles.smallArtwork}>
            <FamIcon name="mealArtwork" size={44} />
          </View>
          <Txt variant="body" weight="700" numberOfLines={2}>
            {nextMeal?.recipe_title ?? t('dashboard.cards.mealPlan.nothingPlanned')}
          </Txt>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      onPress={() => router.push('/meal-planner')}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.cards.mealPlan.accessibility')}
      glassStyle={styles.largeCard}
      fallbackStyle={[styles.largeCard, { backgroundColor: colors.backgroundElement }]}
      outerStyle={[styles.pressable, shadow.sm, { shadowColor: colors.shadowCard }]}>
      <FamIcon name="mealArtwork" size={79} />
      <View style={styles.largeCopy}>
        <Txt variant="caption" tone="danger" weight="700" style={{ letterSpacing: 0.1 }}>
          {t('dashboard.cards.mealPlan.plannedToday')}
        </Txt>
        <Txt variant="body" weight="700" numberOfLines={2}>
          {nextMeal?.recipe_title ?? t('dashboard.cards.mealPlan.nothingPlannedYet')}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {nextMeal
            ? t('dashboard.cards.mealPlan.portions', {
                meal: nextMealLabel,
                count: nextMeal.portions,
              })
            : t('dashboard.cards.mealPlan.openWeek')}
        </Txt>
      </View>
      <FamIcon name="chevron" size={20} />
    </GlassCard>
  );
}

registerCard({
  id: 'mealPlanner',
  moduleKey: 'mealPlanner',
  order: 20,
  defaultSize: 'large',
  component: MealPlanDashboardCard,
});
