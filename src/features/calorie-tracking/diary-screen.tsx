import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { PlusIcon } from '@/components/icons/fam-icon';
import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MenuButton } from '@/components/ui/menu-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { IconButton, Press, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  type FoodEntryRow,
  type MealType,
  useCurrentGoal,
  useFoodEntries,
  useFoodEntriesForDateRange,
} from '@/features/calorie-tracking/api';
import {
  DiaryWeekStrip,
  type DiaryWeekStripDay,
} from '@/features/calorie-tracking/components/diary-week-strip';
import { FastingCard } from '@/features/calorie-tracking/components/fasting-card';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { getLogicalDateForTimestamp } from '@/features/calorie-tracking/domain/day-boundary';
import { Glp1Card } from '@/features/glp1/components/glp1-card';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfile } from '@/features/profile/api';
import { i18n } from '@/i18n';
import { parseIsoDate, toIsoDate } from '@/lib/format/format-date';
import { getUnitLabel } from '@/lib/units';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const WEEK_DAYS = 14;

export function getMealLabel(t: TFunction, meal: MealType): string {
  switch (meal) {
    case 'breakfast':
      return t('calorieTracking.meal.breakfast');
    case 'lunch':
      return t('calorieTracking.meal.lunch');
    case 'dinner':
      return t('calorieTracking.meal.dinner');
    case 'snack':
      return t('calorieTracking.meal.snack');
  }
}

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: theme.space.xxl,
    paddingTop: theme.space.xs,
    paddingBottom: theme.space.xxxxl,
    gap: theme.space.sm,
  },
  macroChip: {
    width: '48%',
    backgroundColor: theme.backgroundElement,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    padding: theme.space.lg,
    gap: theme.space.sm,
  },
  mealSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  mealHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
    paddingTop: theme.space.sm,
  },
  mealHeading: {
    flex: 1,
    minWidth: 0,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
    borderCurve: 'continuous',
  },
  entryRow: {
    minHeight: 36,
    marginBottom: theme.space.sm,
    paddingVertical: theme.space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  entryInfo: {
    flex: 1,
    minWidth: 0,
  },
  hero: {
    paddingBottom: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    gap: theme.space.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.space.sm,
  },
  heroBar: {
    marginTop: theme.space.xs,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.space.sm,
    paddingBottom: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  textOffset: {
    marginTop: theme.space.xs,
  },
  loadingText: {
    paddingVertical: theme.space.xxl,
  },
  emptyState: {
    alignSelf: 'center',
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.xs,
  },
}));

function addDays(iso: string, delta: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + delta);
  return toIsoDate(date);
}

function relativeDateLabel(iso: string, todayLogicalDate: string, t: TFunction): string {
  if (iso === todayLogicalDate) return t('calorieTracking.diary.today');
  if (iso === addDays(todayLogicalDate, -1)) return t('calorieTracking.diary.yesterday');
  if (iso === addDays(todayLogicalDate, 1)) return t('calorieTracking.diary.tomorrow');
  return parseIsoDate(iso).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
  });
}

function fullDateLabel(iso: string, locale: string): string {
  return parseIsoDate(iso).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function weekdayLabel(iso: string, locale: string): string {
  return parseIsoDate(iso).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
}

function formatKcal(value: number, t: TFunction): string {
  return `${Math.round(value).toLocaleString(i18n.language)} ${t('calorieTracking.units.kcal')}`;
}

function MacroChip({ label, value, target }: { label: string; value: number; target: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const exceeded = target > 0 && value > target;

  return (
    <View
      style={styles.macroChip}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        target > 0
          ? t('calorieTracking.diary.macroAccessibility', {
              label,
              value: Math.round(value),
              target: Math.round(target),
            })
          : t('calorieTracking.diary.macroAccessibilityNoGoal', {
              label,
              value: Math.round(value),
            })
      }>
      <Txt variant="caption" weight="700">
        {label}
      </Txt>
      <Txt variant="label" tone="secondary" weight="700">
        {Math.round(value)} / {target > 0 ? Math.round(target) : '–'}{' '}
        {t('calorieTracking.units.gramShort')}
      </Txt>
      <ProgressBar
        value={target > 0 ? value / target : 0}
        color={exceeded ? colors.warning : colors.accent}
        trackColor={colors.backgroundSoft}
        height={4}
      />
    </View>
  );
}

type MealSectionProps = {
  meal: MealType;
  entries: FoodEntryRow[];
  isLast: boolean;
  onAdd: () => void;
  onEntry: (entryId: string) => void;
};

function MealSection({ meal, entries, isLast, onAdd, onEntry }: MealSectionProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const mealKcal = entries.reduce((sum, entry) => sum + (entry.kcal ?? 0), 0);

  return (
    <View style={!isLast ? styles.mealSection : undefined}>
      <View style={styles.mealHeader}>
        <View style={styles.mealHeading}>
          <Txt variant="subheading">{getMealLabel(t, meal)}</Txt>
          <Txt variant="caption" tone="secondary" style={styles.textOffset}>
            {formatKcal(mealKcal, t)}
          </Txt>
        </View>
        <Press
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('calorieTracking.meal.add', { meal: getMealLabel(t, meal) })}
          hitSlop={8}
          style={styles.addButton}>
          <PlusIcon size={18} color={colors.onAccent} />
        </Press>
      </View>
      {entries.map((entry) => (
        <Press
          key={entry.id}
          onPress={() => onEntry(entry.id)}
          accessibilityRole="button"
          accessibilityLabel={t('calorieTracking.diary.entryEdit', { name: entry.name })}
          hitSlop={4}
          style={styles.entryRow}>
          <View style={styles.entryInfo}>
            <Txt variant="caption" weight="700" numberOfLines={1}>
              {entry.name}
            </Txt>
            <Txt
              variant="caption"
              tone="secondary"
              weight="500"
              style={styles.textOffset}
              numberOfLines={1}>
              {t('calorieTracking.diary.entryQuantity', {
                quantity: entry.quantity,
                unit: getUnitLabel(entry.unit, t),
              })}
            </Txt>
          </View>
          <Txt variant="caption" tone="secondary" weight="600">
            {entry.kcal !== null
              ? formatKcal(entry.kcal, t)
              : t('calorieTracking.diary.noCalories')}
          </Txt>
        </Press>
      ))}
    </View>
  );
}

/** Tagebuch: Tagesbilanz, Makros und kompakte Mahlzeitenliste. */
export function DiaryScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { openDrawer } = useNavigationChrome();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: userProfile } = useProfile(userId);

  const todayLogicalDate = getLogicalDateForTimestamp(
    new Date(),
    userProfile?.tracking_day_start_time ?? '00:00',
  );
  const [selectedLogicalDate, setSelectedLogicalDate] = useState(todayLogicalDate);
  const previousTodayLogicalDate = useRef(todayLogicalDate);

  useEffect(() => {
    const previousToday = previousTodayLogicalDate.current;
    previousTodayLogicalDate.current = todayLogicalDate;
    const weekStart = addDays(todayLogicalDate, 1 - WEEK_DAYS);
    setSelectedLogicalDate((current) =>
      current === previousToday || current < weekStart || current > todayLogicalDate
        ? todayLogicalDate
        : current,
    );
  }, [todayLogicalDate]);

  const { data: entries = [], isLoading } = useFoodEntries(userId, selectedLogicalDate);
  const weekStart = addDays(todayLogicalDate, 1 - WEEK_DAYS);
  const { data: weekEntries = [] } = useFoodEntriesForDateRange(
    userId,
    weekStart,
    todayLogicalDate,
  );
  const { data: currentGoal } = useCurrentGoal(userId);
  const totals = calculateDailyTotals(
    entries.map((entry) => ({
      kcal: entry.kcal,
      proteinG: entry.protein_g,
      carbsG: entry.carbs_g,
      fatG: entry.fat_g,
    })),
  );
  const calorieGoal = currentGoal?.daily_kcal ?? 0;
  const remaining = calorieGoal - totals.kcal;
  const weekCalories = weekEntries.reduce<Map<string, number>>((byDate, entry) => {
    byDate.set(entry.logged_on, (byDate.get(entry.logged_on) ?? 0) + (entry.kcal ?? 0));
    return byDate;
  }, new Map());
  const weekDays: DiaryWeekStripDay[] = Array.from({ length: WEEK_DAYS }, (_, index) => {
    const isoDate = addDays(weekStart, index);
    const kcal = weekCalories.get(isoDate) ?? 0;
    return {
      isoDate,
      weekday: weekdayLabel(isoDate, i18n.language),
      relativeLabel: relativeDateLabel(isoDate, todayLogicalDate, t),
      fullLabel: fullDateLabel(isoDate, i18n.language),
      kcal,
      kcalLabel: kcal > 0 ? formatKcal(kcal, t) : t('calorieTracking.diary.dayHasNoEntries'),
      overGoal: calorieGoal > 0 && kcal > calorieGoal,
    };
  });

  const entriesByMeal = MEAL_ORDER.reduce<Record<MealType, FoodEntryRow[]>>(
    (grouped, meal) => {
      grouped[meal] = entries.filter((entry) => entry.meal_type === meal);
      return grouped;
    },
    { breakfast: [], lunch: [], dinner: [], snack: [] },
  );
  function openEntry(mealType: MealType, entryId?: string) {
    if (entryId) {
      router.push({
        pathname: '/add-food-entry',
        params: { date: selectedLogicalDate, mealType, entryId },
      });
      return;
    }
    router.push({
      pathname: '/add-food-entry',
      params: { date: selectedLogicalDate, mealType },
    });
  }

  return (
    <HubScreen
      header={{
        title: t('calorieTracking.diary.title'),
        align: 'center',
        leading: <MenuButton onPress={openDrawer} />,
        trailing: (
          <IconButton
            icon="activity"
            accessibilityLabel={t('calorieTracking.diary.weightTrend')}
            onPress={() => router.push('/weight')}
            size={39}
            iconSize={19}
          />
        ),
      }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never">
        <DiaryWeekStrip
          days={weekDays}
          selectedDate={selectedLogicalDate}
          onSelect={(date) => setSelectedLogicalDate(date)}
        />

        {/* Kalorien-Bilanz: grosse Zahl + duenner Balken statt Ring + vier
            Textzeilen (Redesign "Kompakter Fokus", Design-Audit 2026-08-29) */}
        <View
          style={styles.hero}
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            calorieGoal > 0
              ? t('calorieTracking.diary.heroAccessibilityRemaining', {
                  value: formatKcal(Math.abs(remaining), t),
                  status:
                    remaining < 0
                      ? t('calorieTracking.diary.overDayGoal')
                      : t('calorieTracking.diary.remainingShort'),
                  goal: formatKcal(calorieGoal, t),
                })
              : t('calorieTracking.diary.heroAccessibilityEaten', {
                  value: formatKcal(totals.kcal, t),
                })
          }>
          <View style={styles.heroRow}>
            <Txt variant="title" weight="700">
              {Math.round(calorieGoal > 0 ? Math.abs(remaining) : totals.kcal).toLocaleString(
                i18n.language,
              )}
            </Txt>
            <Txt variant="label" tone="secondary" weight="600">
              {calorieGoal > 0
                ? t('calorieTracking.diary.heroRemaining', {
                    status:
                      remaining < 0
                        ? t('calorieTracking.diary.overShort')
                        : t('calorieTracking.diary.remainingShort'),
                    goal: Math.round(calorieGoal).toLocaleString(i18n.language),
                  })
                : t('calorieTracking.diary.heroEaten')}
            </Txt>
          </View>
          <View style={styles.heroBar}>
            <ProgressBar
              value={calorieGoal > 0 ? totals.kcal / calorieGoal : 0}
              color={remaining < 0 ? colors.warning : colors.accent}
              trackColor={colors.backgroundSoft}
              height={6}
            />
          </View>
        </View>

        {/* Makronährstoff-Chips (Protein, Kohlenhydrate, Fett) */}
        <View style={styles.macroGrid}>
          <MacroChip
            label={t('calorieTracking.diary.macroProtein')}
            value={totals.proteinG}
            target={currentGoal?.protein_g ?? 0}
          />
          <MacroChip
            label={t('calorieTracking.diary.macroCarbs')}
            value={totals.carbsG}
            target={currentGoal?.carbs_g ?? 0}
          />
          <MacroChip
            label={t('calorieTracking.diary.macroFat')}
            value={totals.fatG}
            target={currentGoal?.fat_g ?? 0}
          />
        </View>

        {/* GLP-1 Tracking-Karte (optional) */}
        {userProfile?.tracking_method === 'glp1' ? (
          <Glp1Card
            userId={userId}
            logicalDate={selectedLogicalDate}
            dayStartTime={userProfile.tracking_day_start_time}
          />
        ) : null}

        {/* Intervallfasten-Karte (optional) */}
        {userProfile?.tracking_method === 'fasting' ? <FastingCard userId={userId} /> : null}

        {!isLoading && entries.length === 0 ? (
          <Txt variant="caption" tone="secondary" weight="600" style={styles.emptyState} center>
            {t('calorieTracking.diary.noEntries')}
          </Txt>
        ) : null}

        {/* Mahlzeiten-Abschnitte (Frühstück, Mittagessen, Abendessen, Snacks) */}
        {isLoading ? (
          <Txt variant="caption" tone="secondary" style={styles.loadingText}>
            {t('calorieTracking.diary.loading')}
          </Txt>
        ) : (
          MEAL_ORDER.map((meal, index) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={entriesByMeal[meal]}
              isLast={index === MEAL_ORDER.length - 1}
              onAdd={() => openEntry(meal)}
              onEntry={(entryId) => openEntry(meal, entryId)}
            />
          ))
        )}
      </ScrollView>
    </HubScreen>
  );
}
