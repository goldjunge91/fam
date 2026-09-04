import { router } from 'expo-router';
import { View } from 'react-native';
import { FamIcon } from '@/components/icons/fam-icon';
import { withAlpha } from '@/components/theme/index';
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

// GlassView hat kein cssInterop, deshalb RN-Styles statt Tailwind.
const PLANNED_GLASS_STYLE = {
  borderRadius: 28,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 16,
  paddingLeft: 16,
  paddingRight: 18,
  paddingVertical: 16,
};

const PLANNED_GLASS_STYLE_SMALL = {
  borderRadius: 28,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
  paddingHorizontal: 16,
  paddingVertical: 14,
};

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
        fallbackClassName="dashboard-widget"
        glassStyle={PLANNED_GLASS_STYLE_SMALL}
        outerStyle={{
          width: '100%',
          minHeight: 138,
          borderRadius: 28,
          borderCurve: 'continuous',
          boxShadow: `0 8px 20px ${withAlpha(colors.text, 0.08)}`,
        }}>
        <View className="flex-1 justify-between">
          <View className="flex-row items-center justify-between">
            <Txt variant="captionCompact" tone="danger" weight="700" style={{ letterSpacing: 0.5 }}>
              GEPLANT
            </Txt>
            <Txt variant="detail" tone="secondary">
              {nextMeal ? MEAL_SLOT_LABELS[nextMeal.meal_slot] : 'Heute'}
            </Txt>
          </View>
          <View className="items-center justify-center my-one">
            <FamIcon name="mealArtwork" size={44} />
          </View>
          <Txt variant="bodySmall" weight="700" numberOfLines={2}>
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
      fallbackClassName="dashboard-planned-card"
      glassStyle={PLANNED_GLASS_STYLE}
      outerStyle={{
        minHeight: 140,
        borderRadius: 28,
        borderCurve: 'continuous',
        boxShadow: `0 8px 22px ${withAlpha(colors.text, 0.1)}`,
      }}>
      <FamIcon name="mealArtwork" size={79} />
      <View className="dashboard-planned-copy">
        <Txt variant="caption" tone="danger" weight="700" style={{ letterSpacing: 0.1 }}>
          HEUTE GEPLANT
        </Txt>
        <Txt variant="controlValueLarge" weight="700" numberOfLines={2}>
          {nextMeal?.recipe_title ?? 'Noch nichts geplant'}
        </Txt>
        <Txt variant="detail" tone="secondary">
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
