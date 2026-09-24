import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const WEEK_DAYS = 14;
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

const styles = StyleSheet.create((theme) => ({
  content: {
    paddingHorizontal: theme.space.xl + theme.space.xs,
    paddingTop: 2,
    paddingBottom: 126,
    gap: theme.space.sm,
  },
  macroChip: {
    width: '48%',
    backgroundColor: theme.backgroundElement,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.sm,
    padding: theme.space.lg,
    gap: 6,
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
    paddingTop: 6,
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
    marginBottom: 6,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  entryInfo: {
    flex: 1,
    minWidth: 0,
  },
  hero: {
    paddingBottom: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    gap: 6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.space.sm,
  },
  heroBar: {
    marginTop: 2,
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
    marginTop: 1,
  },
  loadingText: {
    paddingVertical: theme.space.xl + theme.space.xs,
  },
  emptyState: {
    alignSelf: 'center',
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.xs,
  },
}));

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, delta: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + delta);
  return toIsoDate(date);
}

function relativeDateLabel(iso: string, todayLogicalDate: string): string {
  if (iso === todayLogicalDate) return 'Heute';
  if (iso === addDays(todayLogicalDate, -1)) return 'Gestern';
  if (iso === addDays(todayLogicalDate, 1)) return 'Morgen';
  return parseIsoDate(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
  });
}

function fullDateLabel(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function weekdayLabel(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
}

function formatKcal(value: number): string {
  return `${Math.round(value).toLocaleString('de-DE')} kcal`;
}

function MacroChip({ label, value, target }: { label: string; value: number; target: number }) {
  const { colors } = useTheme();
  const exceeded = target > 0 && value > target;

  return (
    <View
      style={styles.macroChip}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        target > 0
          ? `${label}: ${Math.round(value)} von ${Math.round(target)} Gramm`
          : `${label}: ${Math.round(value)} Gramm, kein Ziel gesetzt`
      }>
      <Txt variant="caption" weight="700">
        {label}
      </Txt>
      <Txt variant="label" tone="secondary" weight="700">
        {Math.round(value)} / {target > 0 ? Math.round(target) : '–'} g
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
  const mealKcal = entries.reduce((sum, entry) => sum + (entry.kcal ?? 0), 0);

  return (
    <View style={!isLast ? styles.mealSection : undefined}>
      <View style={styles.mealHeader}>
        <View style={styles.mealHeading}>
          <Txt variant="subheading">{MEAL_LABELS[meal]}</Txt>
          <Txt variant="caption" tone="secondary" style={styles.textOffset}>
            {formatKcal(mealKcal)}
          </Txt>
        </View>
        <Press
          onPress={onAdd}
          role="button"
          aria-label={`Zu ${MEAL_LABELS[meal]} hinzufügen`}
          hitSlop={8}
          style={styles.addButton}>
          <PlusIcon size={18} color={colors.onAccent} />
        </Press>
      </View>
      {entries.map((entry) => (
        <Press
          key={entry.id}
          onPress={() => onEntry(entry.id)}
          role="button"
          aria-label={`${entry.name} bearbeiten`}
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
              {entry.quantity} {entry.unit}
            </Txt>
          </View>
          <Txt variant="caption" tone="secondary" weight="600">
            {entry.kcal !== null ? formatKcal(entry.kcal) : '–'}
          </Txt>
        </Press>
      ))}
    </View>
  );
}

/** Tagebuch: Tagesbilanz, Makros und kompakte Mahlzeitenliste. */
export function DiaryScreen() {
  const { colors } = useTheme();
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
      weekday: weekdayLabel(isoDate),
      relativeLabel: relativeDateLabel(isoDate, todayLogicalDate),
      fullLabel: fullDateLabel(isoDate),
      kcal,
      kcalLabel: kcal > 0 ? formatKcal(kcal) : 'keine Einträge',
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
        title: 'Tagebuch',
        align: 'center',
        leading: <MenuButton onPress={openDrawer} />,
        trailing: (
          <IconButton
            icon="activity"
            accessibilityLabel="Gewichtsverlauf öffnen"
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
              ? `${formatKcal(Math.abs(remaining))} ${remaining < 0 ? 'über dem Tagesziel' : 'übrig'}, Ziel ${formatKcal(calorieGoal)}`
              : `${formatKcal(totals.kcal)} gegessen, kein Tagesziel hinterlegt`
          }>
          <View style={styles.heroRow}>
            <Txt variant="title" weight="700">
              {Math.round(calorieGoal > 0 ? Math.abs(remaining) : totals.kcal).toLocaleString(
                'de-DE',
              )}
            </Txt>
            <Txt variant="label" tone="secondary" weight="600">
              {calorieGoal > 0
                ? `kcal ${remaining < 0 ? 'über Ziel' : 'übrig'} · von ${Math.round(calorieGoal).toLocaleString('de-DE')}`
                : 'kcal gegessen · kein Tagesziel'}
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
          <MacroChip label="Protein" value={totals.proteinG} target={currentGoal?.protein_g ?? 0} />
          <MacroChip
            label="Kohlenhydrate"
            value={totals.carbsG}
            target={currentGoal?.carbs_g ?? 0}
          />
          <MacroChip label="Fett" value={totals.fatG} target={currentGoal?.fat_g ?? 0} />
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
            Keine Einträge an diesem Tag
          </Txt>
        ) : null}

        {/* Mahlzeiten-Abschnitte (Frühstück, Mittagessen, Abendessen, Snacks) */}
        {isLoading ? (
          <Txt variant="caption" tone="secondary" style={styles.loadingText}>
            Lade Tagebuch...
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
