import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlusIcon } from '@/components/fam-icon';
import { FilterChipBar } from '@/components/filter-chip-bar';
import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { ProgressBar } from '@/components/progress-bar';
import { ProgressRing } from '@/components/progress-ring';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton, MenuButton } from '@/components/ui/buttons';
import { Radius } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveProfile } from '@/features/calorie-tracking/active-profile-store';
import {
  type FoodEntryRow,
  type MealType,
  useCurrentGoal,
  useFoodEntries,
} from '@/features/calorie-tracking/api';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useChildProfiles } from '@/features/household/api';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

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

function relativeDateLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return 'Heute';
  if (iso === addDays(todayIso, -1)) return 'Gestern';
  if (iso === addDays(todayIso, 1)) return 'Morgen';
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

function formatKcal(value: number): string {
  return `${Math.round(value).toLocaleString('de-DE')} kcal`;
}

function MacroSummary({ label, value, target }: { label: string; value: number; target: number }) {
  const theme = useTheme();
  const exceeded = target > 0 && value > target;

  return (
    <View
      style={[styles.macroCard, { backgroundColor: `${theme.backgroundElement}D6` }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        target > 0
          ? `${label}: ${Math.round(value)} von ${Math.round(target)} Gramm`
          : `${label}: ${Math.round(value)} Gramm, kein Ziel gesetzt`
      }>
      <View style={styles.macroLabels}>
        <ThemedText style={styles.macroLabel}>{label}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.macroValue}>
          {Math.round(value)} / {target > 0 ? Math.round(target) : '–'} g
        </ThemedText>
      </View>
      <ProgressBar
        value={target > 0 ? value / target : 0}
        color={exceeded ? theme.warning : theme.accent}
        trackColor={theme.backgroundSelected}
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
  const theme = useTheme();
  const mealKcal = entries.reduce((sum, entry) => sum + (entry.kcal ?? 0), 0);

  return (
    <View style={!isLast ? [styles.mealSection, { borderBottomColor: theme.border }] : undefined}>
      <View style={styles.mealHeader}>
        <View style={styles.mealHeading}>
          <ThemedText style={styles.mealTitle}>{MEAL_LABELS[meal]}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.mealKcal}>
            {formatKcal(mealKcal)}
          </ThemedText>
        </View>
        <Pressable
          onPress={onAdd}
          role="button"
          aria-label={`Zu ${MEAL_LABELS[meal]} hinzufügen`}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}>
          <PlusIcon size={18} color={theme.onAccent} />
        </Pressable>
      </View>
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={() => onEntry(entry.id)}
          role="button"
          aria-label={`${entry.name} bearbeiten`}
          style={({ pressed }) => [
            styles.entryRow,
            { backgroundColor: `${theme.backgroundSelected}78` },
            pressed && styles.pressed,
          ]}>
          <View style={styles.entryInfo}>
            <ThemedText style={styles.entryName} numberOfLines={1}>
              {entry.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.entryQuantity} numberOfLines={1}>
              {entry.quantity} {entry.unit}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.entryKcal}>
            {entry.kcal !== null ? formatKcal(entry.kcal) : '–'}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText themeColor="textSecondary" style={styles.summaryLabel}>
        {label}
      </ThemedText>
      <ThemedText themeColor={accent ? 'accent' : 'text'} style={styles.summaryValue}>
        {value}
      </ThemedText>
    </View>
  );
}

/** Tagebuch nach Figma: Tagesbilanz, Makros und kompakte Mahlzeitenliste. */
export function DiaryScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const { openDrawer } = useNavigationChrome();
  const { session } = useSession();
  const userId = session?.user.id;

  const todayIso = toIsoDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const { activeHousehold } = useActiveHousehold();
  const { data: childProfiles = [] } = useChildProfiles(activeHousehold?.id ?? '');
  const { profile, setProfile } = useActiveProfile(activeHousehold?.id);
  const childProfileId = profile?.type === 'child' ? profile.childProfileId : null;

  const { data: entries = [], isLoading } = useFoodEntries(userId, selectedDate, childProfileId);
  const { data: currentGoal } = useCurrentGoal(userId, childProfileId);
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

  const entriesByMeal = MEAL_ORDER.reduce<Record<MealType, FoodEntryRow[]>>(
    (grouped, meal) => {
      grouped[meal] = entries.filter((entry) => entry.meal_type === meal);
      return grouped;
    },
    { breakfast: [], lunch: [], dinner: [], snack: [] },
  );
  const profileOptions = [
    { value: 'adult', label: 'Ich' },
    ...childProfiles.map((child) => ({ value: child.id, label: child.display_name })),
  ];

  function selectProfile(value: string) {
    if (value === 'adult') {
      if (userId) setProfile({ type: 'adult', userId });
    } else if (activeHousehold) {
      setProfile({ type: 'child', childProfileId: value, householdId: activeHousehold.id });
    }
  }

  function openEntry(mealType: MealType, entryId?: string) {
    if (entryId) {
      router.push({
        pathname: '/add-food-entry',
        params: { date: selectedDate, mealType, entryId },
      });
      return;
    }
    router.push({ pathname: '/food-search', params: { date: selectedDate, mealType } });
  }

  return (
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Tagebuch"
          align="center"
          leading={<MenuButton onPress={openDrawer} />}
          trailing={
            <HeaderIconButton
              label="Ziele und Fortschritt öffnen"
              onPress={() => router.push('/settings/goals')}>
              <View style={styles.goalIcon}>
                <View
                  style={[styles.goalBar, styles.goalBarShort, { backgroundColor: theme.accent }]}
                />
                <View
                  style={[styles.goalBar, styles.goalBarTall, { backgroundColor: theme.accent }]}
                />
                <View
                  style={[styles.goalBar, styles.goalBarMid, { backgroundColor: theme.accent }]}
                />
              </View>
            </HeaderIconButton>
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never">
          {childProfiles.length > 0 ? (
            <FilterChipBar
              label="Tagebuchprofil"
              options={profileOptions}
              selected={childProfileId ?? 'adult'}
              onSelect={selectProfile}
            />
          ) : null}

          <View style={styles.dateRow}>
            <Pressable
              onPress={() => setSelectedDate((date) => addDays(date, -1))}
              role="button"
              aria-label="Vorheriger Tag"
              style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}>
              <ThemedText themeColor="accent" style={styles.chevron}>
                ‹
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setSelectedDate(todayIso)}
              role="button"
              aria-label="Heutigen Tag anzeigen"
              style={styles.dateCopy}>
              <ThemedText themeColor="accent" style={styles.relativeDate}>
                {relativeDateLabel(selectedDate, todayIso)}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.fullDate}>
                {fullDateLabel(selectedDate)}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setSelectedDate((date) => addDays(date, 1))}
              role="button"
              aria-label="Nächster Tag"
              style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]}>
              <ThemedText themeColor="accent" style={styles.chevron}>
                ›
              </ThemedText>
            </Pressable>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: `${theme.backgroundElement}D6` }]}>
            <ProgressRing
              value={totals.kcal}
              target={calorieGoal}
              label="Kalorien"
              displayMode="remaining"
              size={128}
              strokeWidth={3}
              progressColor={theme.accent}
              trackColor={theme.backgroundSelected}
            />
            <View style={styles.summaryStats}>
              <SummaryRow label="Gegessen" value={formatKcal(totals.kcal)} />
              <SummaryRow
                label="Grundziel"
                value={calorieGoal > 0 ? formatKcal(calorieGoal) : '–'}
              />
              <SummaryRow
                label="Übrig"
                value={calorieGoal > 0 ? formatKcal(remaining) : 'Kein Ziel'}
                accent={remaining >= 0}
              />
              <ThemedText
                themeColor={currentGoal ? 'success' : 'textSecondary'}
                style={styles.goalStatus}>
                {currentGoal ? 'Tagesziel ist aktiv' : 'Noch kein Tagesziel hinterlegt'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.macroRow}>
            <MacroSummary
              label="Protein"
              value={totals.proteinG}
              target={currentGoal?.protein_g ?? 0}
            />
            <MacroSummary
              label="Kohlenhydrate"
              value={totals.carbsG}
              target={currentGoal?.carbs_g ?? 0}
            />
            <MacroSummary label="Fett" value={totals.fatG} target={currentGoal?.fat_g ?? 0} />
          </View>

          <View style={[styles.mealsCard, { backgroundColor: `${theme.backgroundElement}D6` }]}>
            {isLoading ? (
              <ThemedText
                type="captionCompact"
                themeColor="textSecondary"
                style={styles.loadingText}>
                Lade Tagebuch...
              </ThemedText>
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
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 126, gap: 8 },
  goalIcon: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  goalBar: { width: 4, borderRadius: Radius.hairline },
  goalBarShort: { height: 7 },
  goalBarTall: { height: 17 },
  goalBarMid: { height: 12 },
  dateRow: { height: 42, flexDirection: 'row', alignItems: 'center' },
  dateArrow: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  chevron: { ...FontSize[21], lineHeight: 23, fontWeight: 500 },
  dateCopy: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  relativeDate: { ...FontSize[14], lineHeight: 17, fontWeight: 700 },
  fullDate: { marginTop: 1, ...FontSize[10], lineHeight: 12, fontWeight: 500 },
  summaryCard: {
    minHeight: 160,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryStats: { flex: 1, minWidth: 0, gap: 9 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  summaryLabel: { ...FontSize[10], lineHeight: 12, fontWeight: 500 },
  summaryValue: { ...FontSize[10], lineHeight: 12, fontWeight: 700, textAlign: 'right' },
  goalStatus: { marginTop: 2, ...FontSize[9], lineHeight: 12, fontWeight: 600 },
  macroRow: { flexDirection: 'row', gap: 7 },
  macroCard: {
    flex: 1,
    minWidth: 0,
    height: 58,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },
  macroLabels: { gap: 1 },
  macroLabel: { ...FontSize[10], lineHeight: 12, fontWeight: 700 },
  macroValue: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  mealsCard: { borderRadius: Radius.sheet, borderCurve: 'continuous', overflow: 'hidden' },
  mealSection: { borderBottomWidth: StyleSheet.hairlineWidth },
  mealHeader: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mealHeading: { flex: 1, minWidth: 0 },
  mealTitle: { ...FontSize[12], lineHeight: 15, fontWeight: 700 },
  mealKcal: { marginTop: 1, ...FontSize[9], lineHeight: 11, fontWeight: 500 },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryRow: {
    minHeight: 42,
    marginHorizontal: 8,
    marginBottom: 6,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  entryInfo: { flex: 1, minWidth: 0 },
  entryName: { ...FontSize[10], lineHeight: 12, fontWeight: 700 },
  entryQuantity: { marginTop: 1, ...FontSize[9], lineHeight: 11, fontWeight: 500 },
  entryKcal: { ...FontSize[9], lineHeight: 11, fontWeight: 600 },
  loadingText: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    ...FontSize[11],
    lineHeight: 14,
  },
  pressed: { opacity: 0.72 },
});
