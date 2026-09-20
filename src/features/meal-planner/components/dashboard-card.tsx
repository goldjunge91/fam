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
import {
  getDailyMealPlanEmptyArtworkVariant,
  getDailyMealPlanEmptyMessageKey,
  getMealPlanEmptyVariant,
  getUpcomingMealEntries,
  type MealPlanEmptyVariant,
} from './dashboard-meals';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const styles = StyleSheet.create((theme) => ({
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
  emptyArtwork: {
    flex: 1,
    backgroundColor: theme.background,
  },
  weeklyStripArtwork: {
    justifyContent: 'space-between',
    padding: space.lg,
  },
  weeklyStrip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  weeklyDay: {
    width: 34,
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.backgroundElement,
  },
  weeklyDayActive: {
    backgroundColor: theme.backgroundSoft,
    borderColor: theme.textSecondary,
  },
  weeklyDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    backgroundColor: theme.border,
  },
  weeklyDotActive: {
    backgroundColor: theme.text,
  },
  weeklyStripMessage: {
    flexShrink: 1,
  },
  kitchenNoteArtwork: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: space.lg,
    backgroundColor: theme.speedDialRecipes,
  },
  kitchenNoteSheet: {
    width: 78,
    height: 92,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.backgroundElement,
    shadowColor: theme.accent,
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 0,
    elevation: 2,
    transform: [{ rotate: '5deg' }],
  },
  kitchenNoteLine: {
    width: '100%',
    height: 4,
    marginBottom: space.sm,
    borderRadius: 4,
    backgroundColor: theme.border,
  },
  kitchenNoteLineShort: {
    width: '58%',
    backgroundColor: theme.accent,
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
}));

type MealPlanEmptyArtworkProps = {
  message: string;
  showMessage?: boolean;
  variant: MealPlanEmptyVariant;
};

function MealPlanEmptyArtwork({
  message,
  showMessage = false,
  variant,
}: MealPlanEmptyArtworkProps) {
  const { t } = useTranslation();

  if (variant === 'weeklyStrip') {
    return (
      <View
        testID="meal-plan-weekly-strip"
        style={[styles.emptyArtwork, styles.weeklyStripArtwork]}>
        <View style={styles.weeklyStrip}>
          <View style={styles.weeklyDay}>
            <Txt variant="caption" tone="secondary">
              {t('dashboard.cards.mealPlan.emptyArtwork.weekdays.monday')}
            </Txt>
            <View style={styles.weeklyDot} />
          </View>
          <View style={[styles.weeklyDay, styles.weeklyDayActive]}>
            <Txt variant="caption" tone="primary" weight="700">
              {t('dashboard.cards.mealPlan.emptyArtwork.weekdays.tuesday')}
            </Txt>
            <View style={[styles.weeklyDot, styles.weeklyDotActive]} />
          </View>
          <View style={styles.weeklyDay}>
            <Txt variant="caption" tone="secondary">
              {t('dashboard.cards.mealPlan.emptyArtwork.weekdays.wednesday')}
            </Txt>
            <View style={styles.weeklyDot} />
          </View>
        </View>
        {showMessage ? (
          <Txt variant="body" tone="primary" numberOfLines={2} style={styles.weeklyStripMessage}>
            {message}
          </Txt>
        ) : null}
      </View>
    );
  }

  return (
    <View testID="meal-plan-kitchen-note" style={[styles.emptyArtwork, styles.kitchenNoteArtwork]}>
      <View testID="meal-plan-kitchen-note-sheet" style={styles.kitchenNoteSheet}>
        <View style={[styles.kitchenNoteLine, styles.kitchenNoteLineShort]} />
        <View style={styles.kitchenNoteLine} />
        <View style={styles.kitchenNoteLine} />
        <View style={[styles.kitchenNoteLine, styles.kitchenNoteLineShort]} />
      </View>
    </View>
  );
}

function MealPlanDashboardCard({ size, onLongPress, disabled }: DashboardCardProps) {
  const { t } = useTranslation();
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;
  const now = new Date();
  const todayIso = toIsoDate(now);

  const { data: mealEntries = [] } = useMealPlanEntriesInRange(
    householdId,
    todayIso,
    addDays(todayIso, 1),
  );

  const upcomingMeals = getUpcomingMealEntries(mealEntries, now);
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
  const emptyMessage = t(getDailyMealPlanEmptyMessageKey(now));
  const emptyArtworkVariant =
    size === 'large' ? getDailyMealPlanEmptyArtworkVariant(now) : getMealPlanEmptyVariant(size);
  const nextMealLabel = nextMeal
    ? t(`dashboard.cards.mealPlan.mealSlots.${nextMeal.meal_slot}`)
    : null;
  const { data: coverUrl } = useRecipeCoverUrl(nextMeal?.recipe_cover_image_path);
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
          {nextMeal ? (
            <View style={styles.smallArtwork}>
              <View style={styles.smallArtworkImage}>
                <RecipeArtwork
                  title={nextMeal.recipe_title}
                  coverUrl={coverUrl}
                  coverPath={nextMeal.recipe_cover_image_path}
                  paletteIndex={nextMeal.recipe_id.length}
                />
              </View>
              <View style={styles.smallTitle}>
                <Txt variant="body" tone="onAccent" numberOfLines={2}>
                  {nextMeal.recipe_title}
                </Txt>
              </View>
            </View>
          ) : (
            <MealPlanEmptyArtwork
              message={emptyMessage}
              showMessage
              variant={emptyArtworkVariant}
            />
          )}
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
          <MealPlanEmptyArtwork message={emptyMessage} variant={emptyArtworkVariant} />
        )}
      </View>
      <View style={styles.largeCopy}>
        {nextMeal ? (
          <Txt variant="caption" tone="danger" weight="700" style={{ letterSpacing: 0.1 }}>
            {t('dashboard.cards.mealPlan.plannedToday')}
          </Txt>
        ) : null}
        <Txt variant="body" weight="700" numberOfLines={2}>
          {nextMeal?.recipe_title ?? emptyMessage}
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
