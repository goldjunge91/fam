import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PlusIcon } from '@/components/icons/fam-icon';
import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MenuButton } from '@/components/ui/buttons';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Txt } from '@/constants/ui';
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
import { Glp1Card } from '@/features/glp1/components/glp1-card';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useChildProfiles } from '@/features/household/api';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfile } from '@/features/profile/api';
import { getLogicalDateForTimestamp } from '@/features/tracking/domain/day-boundary';

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

function formatKcal(value: number): string {
  return `${Math.round(value).toLocaleString('de-DE')} kcal`;
}

function MacroChip({ label, value, target }: { label: string; value: number; target: number }) {
  const { colors } = useTheme();
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
      <Txt
        variant="label"
        style={{ fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
        {label}
      </Txt>
      <Txt
        variant="body"
        tone="secondary"
        style={{ fontSize: 13, lineHeight: 16, fontWeight: '700' }}>
        {Math.round(value)} / {target > 0 ? Math.round(target) : '–'} g
      </Txt>
      <ProgressBar
        value={target > 0 ? value / target : 0}
        color={exceeded ? colors.carrot : colors.basil}
        trackColor={colors.surfaceSoft}
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
    <View className={!isLast ? 'diary-meal-section' : undefined}>
      <View className="diary-meal-header pt-[6px]">
        <View className="diary-meal-heading">
          <Txt
            variant="subheading"
            style={{ fontSize: 20, lineHeight: 24, fontWeight: '700' }}>
            {MEAL_LABELS[meal]}
          </Txt>
          <Txt
            variant="body"
            tone="secondary"
            style={{ marginTop: 1, fontSize: 13, lineHeight: 17, fontWeight: '500' }}>
            {formatKcal(mealKcal)}
          </Txt>
        </View>
        <Pressable
          onPress={onAdd}
          role="button"
          aria-label={`Zu ${MEAL_LABELS[meal]} hinzufügen`}
          className="diary-add-button"
          // borderCurve ist ein echter Laufzeitwert ohne Tailwind-Aequivalent.
          style={{ borderCurve: 'continuous' }}>
          <PlusIcon size={18} color={colors.inverse} />
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
            <Txt
              variant="body"
              numberOfLines={1}
              style={{ fontSize: 11, lineHeight: 14, fontWeight: '700' }}>
              {entry.name}
            </Txt>
            <Txt
              variant="body"
              tone="secondary"
              numberOfLines={1}
              style={{ marginTop: 1, fontSize: 10, lineHeight: 12, fontWeight: '500' }}>
              {entry.quantity} {entry.unit}
            </Txt>
          </View>
          <Txt
            variant="body"
            tone="secondary"
            style={{ fontSize: 10, lineHeight: 12, fontWeight: '600' }}>
            {entry.kcal !== null ? formatKcal(entry.kcal) : '–'}
          </Txt>
        </Pressable>
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
    setSelectedLogicalDate((current) => (current === previousToday ? todayLogicalDate : current));
  }, [todayLogicalDate]);

  const { activeHousehold } = useActiveHousehold();
  const { data: childProfiles = [] } = useChildProfiles(activeHousehold?.id ?? '');
  const { profile, setProfile } = useActiveProfile(activeHousehold?.id);
  const childProfileId = profile?.type === 'child' ? profile.childProfileId : null;

  const { data: entries = [], isLoading } = useFoodEntries(
    userId,
    selectedLogicalDate,
    childProfileId,
  );
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
            onPress={() => setSelectedLogicalDate((date) => addDays(date, -1))}
            role="button"
            aria-label="Vorheriger Tag"
            className="diary-date-arrow">
            <Txt
              variant="body"
              tone="secondary"
              style={{ fontSize: 28, lineHeight: 32, fontWeight: '500' }}>
              ‹
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => setSelectedLogicalDate(todayLogicalDate)}
            role="button"
            aria-label="Heutigen Tag anzeigen"
            className="diary-date-copy">
            <Txt
              variant="body"
              tone="primary"
              style={{ fontSize: 14, lineHeight: 18, fontWeight: '700' }}>
              {relativeDateLabel(selectedLogicalDate, todayLogicalDate)}
            </Txt>
            <Txt
              variant="body"
              tone="secondary"
              numberOfLines={1}
              style={{ marginTop: 1, fontSize: 16, lineHeight: 20, fontWeight: '500' }}>
              {fullDateLabel(selectedLogicalDate)}
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => setSelectedLogicalDate((date) => addDays(date, 1))}
            role="button"
            aria-label="Nächster Tag"
            className="diary-date-arrow">
            <Txt
              variant="body"
              tone="secondary"
              style={{ fontSize: 28, lineHeight: 32, fontWeight: '500' }}>
              ›
            </Txt>
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
            <Txt
              variant="display"
              style={{ fontSize: 30, lineHeight: 34, fontWeight: '700' }}>
              {Math.round(calorieGoal > 0 ? Math.abs(remaining) : totals.kcal).toLocaleString(
                'de-DE',
              )}
            </Txt>
            <Txt
              variant="body"
              tone="secondary"
              style={{ fontSize: 13, lineHeight: 16, fontWeight: '600' }}>
              {calorieGoal > 0
                ? `kcal ${remaining < 0 ? 'über Ziel' : 'übrig'} · von ${Math.round(calorieGoal).toLocaleString('de-DE')}`
                : 'kcal gegessen · kein Tagesziel'}
            </Txt>
          </View>
          <ProgressBar
            value={calorieGoal > 0 ? totals.kcal / calorieGoal : 0}
            color={remaining < 0 ? colors.carrot : colors.basil}
            trackColor={colors.surfaceSoft}
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
            logicalDate={selectedLogicalDate}
            dayStartTime={userProfile.tracking_day_start_time}
          />
        ) : null}

        {/* Intervallfasten-Karte (optional) */}
        {userProfile?.tracking_method === 'fasting' ? (
          <FastingCard userId={userId} childProfileId={childProfileId} />
        ) : null}

        {/* Mahlzeiten-Abschnitte (Frühstück, Mittagessen, Abendessen, Snacks) */}
        {isLoading ? (
          <Txt variant="caption" tone="secondary" className="diary-loading-text">
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
