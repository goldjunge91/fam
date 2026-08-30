import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PlusIcon } from '@/components/icons/fam-icon';
import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { MenuButton } from '@/components/ui/buttons';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useSession } from '@/features/auth/session-provider';
import { useActiveProfile } from '@/features/calorie-tracking/active-profile-store';
import {
  type FoodEntryRow,
  type MealType,
  useCurrentGoal,
  useFoodEntries,
} from '@/features/calorie-tracking/api';
import { FastingCard } from '@/features/calorie-tracking/components/fasting-card';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { getLogicalDateForTimestamp } from '@/features/calorie-tracking/day-boundary';
import { Glp1Card } from '@/features/glp1/components/glp1-card';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useChildProfiles } from '@/features/household/api';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfile } from '@/features/profile/api';
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

function MacroChip({ label, value, target }: { label: string; value: number; target: number }) {
  const theme = useTheme();
  const exceeded = target > 0 && value > target;

  return (
    <View
      className="diary-macro-chip"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        target > 0
          ? `${label}: ${Math.round(value)} von ${Math.round(target)} Gramm`
          : `${label}: ${Math.round(value)} Gramm, kein Ziel gesetzt`
      }>
      <ThemedText className="diary-macro-chip-label">{label}</ThemedText>
      <ThemedText themeColor="textSecondary" className="diary-macro-chip-value">
        {Math.round(value)} / {target > 0 ? Math.round(target) : '–'} g
      </ThemedText>
      <ProgressBar
        value={target > 0 ? value / target : 0}
        color={exceeded ? theme.warning : theme.accent}
        trackColor={theme.backgroundSelected}
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
  const theme = useTheme();
  const mealKcal = entries.reduce((sum, entry) => sum + (entry.kcal ?? 0), 0);

  return (
    <View className={!isLast ? 'diary-meal-section' : undefined}>
      <View className="diary-meal-header">
        <View className="diary-meal-heading">
          <ThemedText className="diary-meal-title">{MEAL_LABELS[meal]}</ThemedText>
          <ThemedText themeColor="textSecondary" className="diary-meal-kcal">
            {formatKcal(mealKcal)}
          </ThemedText>
        </View>
        <Pressable
          onPress={onAdd}
          role="button"
          aria-label={`Zu ${MEAL_LABELS[meal]} hinzufügen`}
          className="diary-add-button"
          // borderCurve ist ein echter Laufzeitwert ohne Tailwind-Aequivalent.
          style={{ borderCurve: 'continuous' }}>
          <PlusIcon size={18} color={theme.onAccent} />
        </Pressable>
      </View>
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={() => onEntry(entry.id)}
          role="button"
          aria-label={`${entry.name} bearbeiten`}
          className="diary-entry-row">
          <View className="diary-entry-info">
            <ThemedText className="diary-entry-name" numberOfLines={1}>
              {entry.name}
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              className="diary-entry-quantity"
              numberOfLines={1}>
              {entry.quantity} {entry.unit}
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" className="diary-entry-kcal">
            {entry.kcal !== null ? formatKcal(entry.kcal) : '–'}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

/** Tagebuch: Tagesbilanz, Makros und kompakte Mahlzeitenliste. */
export function DiaryScreen() {
  const theme = useTheme();
  const { openDrawer } = useNavigationChrome();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: userProfile } = useProfile(userId);

  const todayIso = getLogicalDateForTimestamp(
    new Date(),
    userProfile?.tracking_day_start_time ?? '00:00',
  );
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const previousTodayIso = useRef(todayIso);

  useEffect(() => {
    const previousToday = previousTodayIso.current;
    previousTodayIso.current = todayIso;
    setSelectedDate((current) => (current === previousToday ? todayIso : current));
  }, [todayIso]);

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
    router.push({ pathname: '/add-food-entry', params: { date: selectedDate, mealType } });
  }

  return (
    <HubScreen
      rootClassName="diary-root"
      safeAreaClassName="diary-safe-area"
      header={{
        title: 'Tagebuch',
        align: 'center',
        leading: <MenuButton onPress={openDrawer} />,
      }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="diary-content"
        contentInsetAdjustmentBehavior="never">
        {/* Profil-Auswahl (Erwachsener vs. Kind-Profile) */}
        {childProfiles.length > 0 ? (
          <FilterChipBar
            label="Tagebuchprofil"
            options={profileOptions}
            selected={childProfileId ?? 'adult'}
            onSelect={selectProfile}
          />
        ) : null}

        {/* Datumsnavigation (Gestern, Heute, Morgen, Datumswahl) */}
        <View className="diary-date-row">
          <Pressable
            onPress={() => setSelectedDate((date) => addDays(date, -1))}
            role="button"
            aria-label="Vorheriger Tag"
            className="diary-date-arrow">
            <ThemedText themeColor="accent" className="diary-chevron">
              ‹
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setSelectedDate(todayIso)}
            role="button"
            aria-label="Heutigen Tag anzeigen"
            className="diary-date-copy">
            <ThemedText themeColor="accent" className="diary-relative-date">
              {relativeDateLabel(selectedDate, todayIso)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" className="diary-full-date">
              {fullDateLabel(selectedDate)}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setSelectedDate((date) => addDays(date, 1))}
            role="button"
            aria-label="Nächster Tag"
            className="diary-date-arrow">
            <ThemedText themeColor="accent" className="diary-chevron">
              ›
            </ThemedText>
          </Pressable>
        </View>

        {/* Kalorien-Bilanz: grosse Zahl + duenner Balken statt Ring + vier
            Textzeilen (Redesign "Kompakter Fokus", Design-Audit 2026-08-29) */}
        <View
          className="diary-hero"
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            calorieGoal > 0
              ? `${formatKcal(Math.abs(remaining))} ${remaining < 0 ? 'über dem Tagesziel' : 'übrig'}, Ziel ${formatKcal(calorieGoal)}`
              : `${formatKcal(totals.kcal)} gegessen, kein Tagesziel hinterlegt`
          }>
          <View className="diary-hero-row">
            <ThemedText className="diary-hero-value">
              {Math.round(calorieGoal > 0 ? Math.abs(remaining) : totals.kcal).toLocaleString(
                'de-DE',
              )}
            </ThemedText>
            <ThemedText themeColor="textSecondary" className="diary-hero-label">
              {calorieGoal > 0
                ? `kcal ${remaining < 0 ? 'über Ziel' : 'übrig'} · von ${Math.round(calorieGoal).toLocaleString('de-DE')}`
                : 'kcal gegessen · kein Tagesziel'}
            </ThemedText>
          </View>
          <ProgressBar
            value={calorieGoal > 0 ? totals.kcal / calorieGoal : 0}
            color={remaining < 0 ? theme.warning : theme.accent}
            trackColor={theme.backgroundSelected}
            height={6}
            className="diary-hero-bar"
          />
        </View>

        {/* Makronährstoff-Chips (Protein, Kohlenhydrate, Fett) */}
        <View className="diary-macro-grid">
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
            childProfileId={childProfileId}
            logicalDate={selectedDate}
            dayStartTime={userProfile.tracking_day_start_time}
          />
        ) : null}

        {/* Intervallfasten-Karte (optional) */}
        {userProfile?.tracking_method === 'fasting' ? (
          <FastingCard userId={userId} childProfileId={childProfileId} />
        ) : null}

        {/* Mahlzeiten-Abschnitte (Frühstück, Mittagessen, Abendessen, Snacks) */}
        {isLoading ? (
          <ThemedText
            type="captionCompact"
            themeColor="textSecondary"
            className="diary-loading-text">
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
      </ScrollView>
    </HubScreen>
  );
}
