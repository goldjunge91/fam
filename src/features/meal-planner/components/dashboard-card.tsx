import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { RecipeArtwork } from '@/features/recipes/components/recipe-preview-card';
import { useRecipeCoverUrl } from '@/features/recipes/data/household-recipe-images';
import { addDays } from '../week';
import { getUpcomingMealEntries } from './dashboard-meals';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const styles = StyleSheet.create({
  smallCard: {
    padding: 0,
  },
  smallContent: {
    flex: 1,
  },
  smallArtwork: {
    position: 'relative',
    flex: 1,
    overflow: 'hidden',
  },
  smallArtworkImage: {
    flex: 1,
  },
  smallTitle: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    left: space.lg,
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

  const { data: mealEntries = [] } = useMealPlanEntriesInRange(
    householdId,
    todayIso,
    addDays(todayIso, 1),
  );

  const upcomingMeals = getUpcomingMealEntries(mealEntries, new Date());
  const upcomingMealKey = upcomingMeals
    .map((meal) => `${meal.id}:${meal.entry_date}:${meal.meal_slot}`)
    .join('|');
  const [rotationIndex, setRotationIndex] = useState(0);

  useEffect(() => {
    if (!upcomingMealKey) return;
    setRotationIndex(0);
  }, [upcomingMealKey]);

  useEffect(() => {
    if (upcomingMeals.length <= 1) return;
    const interval = setInterval(() => {
      setRotationIndex((current) => (current + 1) % upcomingMeals.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [upcomingMeals.length]);

  const nextMeal = upcomingMeals[rotationIndex % Math.max(upcomingMeals.length, 1)];
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
          <View style={styles.smallArtwork}>
            {nextMeal ? (
              <View style={styles.smallArtworkImage}>
                <RecipeArtwork
                  title={nextMeal.recipe_title}
                  coverUrl={coverUrl}
                  coverPath={nextMeal.recipe_cover_image_path}
                  paletteIndex={nextMeal.recipe_id.length}
                />
              </View>
            ) : (
              <Image source={mealArtwork} contentFit="fill" style={styles.smallArtworkImage} />
            )}
            <View style={styles.smallTitle}>
              <Txt variant="body" tone="onAccent" numberOfLines={2}>
                {nextMeal?.recipe_title ?? t('dashboard.cards.mealPlan.nothingPlanned')}
              </Txt>
            </View>
          </View>
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
        {nextMeal ? (
          <RecipeArtwork
            testID="meal-plan-large-artwork"
            title={nextMeal.recipe_title}
            coverUrl={coverUrl}
            coverPath={nextMeal.recipe_cover_image_path}
            paletteIndex={nextMeal.recipe_id.length}
          />
        ) : (
          <Image
            testID="meal-plan-large-artwork"
            source={artworkSource}
            contentFit="fill"
            style={styles.largeArtworkImage}
          />
        )}
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
