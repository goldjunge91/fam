import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FamIcon } from '@/components/icons/fam-icon';
import { space } from '@/components/theme/index';
import { Txt } from '@/constants/ui';
import { DashboardCardShell } from '@/features/dashboard/components/dashboard-card-shell';
import { type DashboardCardProps, registerCard } from '@/features/dashboard/registry';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useMealPlanEntriesInRange } from '@/features/meal-planner/use-meal-plans';
import { MEAL_SLOTS } from '@/features/meal-planner/week';
import { useRecipeCoverUrl } from '@/features/recipes/data/household-recipe-images';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const styles = StyleSheet.create({
  smallCard: {
    justifyContent: 'space-between',
    gap: space.sm,
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
  },
  smallArtworkImage: {
    width: 44,
    height: 44,
  },
  largeCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
    padding: 0,
  },
  largeArtwork: {
    width: '50%',
    height: '100%',
  },
  largeArtworkImage: {
    width: '100%',
    height: '100%',
  },
  largeCopy: {
    minWidth: 0,
    flex: 1,
    justifyContent: 'center',
    gap: space.xs,
    padding: space.lg,
  },
  largeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
});

const mealArtwork = require('@/assets/images/figma/meal-artwork.svg');

function MealPlanDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { t } = useTranslation();
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
  const { data: coverUrl } = useRecipeCoverUrl(nextMeal?.recipe_cover_image_path);
  const artworkSource = coverUrl ? { uri: coverUrl } : mealArtwork;

  if (size === 'small') {
    return (
      <DashboardCardShell
        size={size}
        onPress={() => router.push('/meal-planner')}
        onLongPress={onLongPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.cards.mealPlan.accessibility')}
        style={styles.smallCard}>
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
            {coverUrl ? (
              <Image
                testID="meal-plan-small-artwork"
                source={artworkSource}
                contentFit="cover"
                style={styles.smallArtworkImage}
              />
            ) : (
              <FamIcon name="mealArtwork" size={44} />
            )}
          </View>
          <Txt variant="body" weight="700" numberOfLines={2}>
            {nextMeal?.recipe_title ?? t('dashboard.cards.mealPlan.nothingPlanned')}
          </Txt>
        </View>
      </DashboardCardShell>
    );
  }

  return (
    <DashboardCardShell
      size={size}
      onPress={() => router.push('/meal-planner')}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.cards.mealPlan.accessibility')}
      style={styles.largeCard}>
      <View style={styles.largeArtwork}>
        <Image
          testID="meal-plan-large-artwork"
          source={artworkSource}
          contentFit={coverUrl ? 'cover' : 'fill'}
          style={styles.largeArtworkImage}
        />
      </View>
      <View style={styles.largeCopy}>
        <Txt variant="caption" tone="danger" weight="700" style={{ letterSpacing: 0.1 }}>
          {t('dashboard.cards.mealPlan.plannedToday')}
        </Txt>
        <Txt variant="body" weight="700" numberOfLines={2}>
          {nextMeal?.recipe_title ?? t('dashboard.cards.mealPlan.nothingPlannedYet')}
        </Txt>
        <View style={styles.largeFooter}>
          <Txt variant="caption" tone="secondary">
            {nextMeal
              ? t('dashboard.cards.mealPlan.portions', {
                  meal: nextMealLabel,
                  count: nextMeal.portions,
                })
              : t('dashboard.cards.mealPlan.openWeek')}
          </Txt>
          <FamIcon name="chevron" size={20} />
        </View>
      </View>
    </DashboardCardShell>
  );
}

registerCard({
  id: 'mealPlanner',
  moduleKey: 'mealPlanner',
  order: 20,
  defaultSize: 'large',
  component: MealPlanDashboardCard,
});
