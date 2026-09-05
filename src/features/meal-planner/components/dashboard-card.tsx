import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FamIcon } from '@/components/icons/fam-icon';
import { radius, shadow, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { Txt } from '@/constants/ui';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useMealPlanEntriesInRange } from '@/features/meal-planner/use-meal-plans';
import { MEAL_SLOT_LABELS, MEAL_SLOTS } from '@/features/meal-planner/week';

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

function MealPlanDashboardCard({ size, onLongPress }: DashboardCardProps) {
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

  if (size === 'small') {
    return (
      <GlassCard
        onPress={() => router.push('/meal-planner')}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel="Essensplan öffnen"
        glassStyle={styles.smallCard}
        fallbackStyle={[styles.smallCard, { backgroundColor: colors.backgroundElement }]}
        outerStyle={[styles.pressable, shadow.sm, { shadowColor: colors.shadowCard }]}>
        <View style={styles.smallContent}>
          <View style={styles.smallHeader}>
            <Txt variant="caption" tone="danger" weight="700" style={{ letterSpacing: 0.5 }}>
              GEPLANT
            </Txt>
            <Txt variant="caption" tone="secondary">
              {nextMeal ? MEAL_SLOT_LABELS[nextMeal.meal_slot] : 'Heute'}
            </Txt>
          </View>
          <View style={styles.smallArtwork}>
            <FamIcon name="mealArtwork" size={44} />
          </View>
          <Txt variant="body" weight="700" numberOfLines={2}>
            {nextMeal?.recipe_title ?? 'Nichts geplant'}
          </Txt>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      onPress={() => router.push('/meal-planner')}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel="Essensplan öffnen"
      glassStyle={styles.largeCard}
      fallbackStyle={[styles.largeCard, { backgroundColor: colors.backgroundElement }]}
      outerStyle={[styles.pressable, shadow.sm, { shadowColor: colors.shadowCard }]}>
      <FamIcon name="mealArtwork" size={79} />
      <View style={styles.largeCopy}>
        <Txt variant="caption" tone="danger" weight="700" style={{ letterSpacing: 0.1 }}>
          HEUTE GEPLANT
        </Txt>
        <Txt variant="body" weight="700" numberOfLines={2}>
          {nextMeal?.recipe_title ?? 'Noch nichts geplant'}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {nextMeal
            ? `${MEAL_SLOT_LABELS[nextMeal.meal_slot]} · ${nextMeal.portions} Portionen`
            : 'Wochenplan öffnen'}
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
