import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { MacroBar } from '@/components/macro-bar';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import {
  type FoodEntryRow,
  type MealType,
  useCurrentGoal,
  useFoodEntries,
} from '@/features/calorie-tracking/api';
import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';
import { useTheme } from '@/hooks/use-theme';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(iso: string, delta: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + delta);
  return toIsoDate(date);
}

function formatDiaryDate(iso: string, todayIso: string): string {
  if (iso === todayIso) return 'Heute';
  if (iso === addDays(todayIso, -1)) return 'Gestern';
  return parseIsoDate(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Tagebuch (#85, #87, #88): Datumsnavigation, Tagessummen, Mahlzeiten-Gliederung. */
export function DiaryScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;

  const todayIso = toIsoDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const isToday = selectedDate === todayIso;

  const { data: entries = [], isLoading } = useFoodEntries(userId, selectedDate);
  const { data: currentGoal } = useCurrentGoal(userId);

  const totals = calculateDailyTotals(
    entries.map((e) => ({ kcal: e.kcal, proteinG: e.protein_g, carbsG: e.carbs_g, fatG: e.fat_g })),
  );

  const entriesByMeal = MEAL_ORDER.reduce<Record<MealType, FoodEntryRow[]>>(
    (acc, meal) => {
      acc[meal] = entries.filter((e) => e.meal_type === meal);
      return acc;
    },
    { breakfast: [], lunch: [], dinner: [], snack: [] },
  );

  function openEntry(mealType: MealType, entryId?: string) {
    router.push({
      pathname: '/add-food-entry',
      params: { date: selectedDate, mealType, ...(entryId ? { entryId } : {}) },
    });
  }

  return (
    <Screen title="Tagebuch">
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setSelectedDate((d) => addDays(d, -1))}
          accessibilityRole="button"
          accessibilityLabel="Vorheriger Tag"
          style={styles.dateArrow}>
          <ThemedText type="subtitle">‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{formatDiaryDate(selectedDate, todayIso)}</ThemedText>
        <Pressable
          onPress={() => !isToday && setSelectedDate((d) => addDays(d, 1))}
          disabled={isToday}
          accessibilityRole="button"
          accessibilityLabel="Nächster Tag"
          style={[styles.dateArrow, isToday && styles.dateArrowDisabled]}>
          <ThemedText type="subtitle">›</ThemedText>
        </Pressable>
      </View>

      <Card>
        <ProgressRing value={totals.kcal} target={currentGoal?.daily_kcal ?? 0} label="Kalorien" />
        {!currentGoal ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Noch kein Kalorienziel gesetzt. Lege es unter Einstellungen an.
          </ThemedText>
        ) : null}
      </Card>

      <Card title="Makronährstoffe">
        <View style={styles.macros}>
          <MacroBar label="Eiweiß" value={totals.proteinG} target={currentGoal?.protein_g ?? 0} />
          <MacroBar
            label="Kohlenhydrate"
            value={totals.carbsG}
            target={currentGoal?.carbs_g ?? 0}
          />
          <MacroBar label="Fett" value={totals.fatG} target={currentGoal?.fat_g ?? 0} />
        </View>
      </Card>

      {isLoading ? (
        <ThemedText type="small" themeColor="textSecondary">
          Lade Tagebuch...
        </ThemedText>
      ) : (
        MEAL_ORDER.map((meal) => (
          <Card key={meal} title={MEAL_LABELS[meal]}>
            {entriesByMeal[meal].length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Noch nichts erfasst.
              </ThemedText>
            ) : (
              <View style={styles.entryList}>
                {entriesByMeal[meal].map((entry) => (
                  <Pressable
                    key={entry.id}
                    onPress={() => openEntry(meal, entry.id)}
                    style={[styles.entryRow, { borderBottomColor: theme.border }]}>
                    <View style={styles.entryInfo}>
                      <ThemedText type="smallBold">{entry.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {entry.quantity} {entry.unit}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {entry.kcal !== null ? `${Math.round(entry.kcal)} kcal` : '–'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable onPress={() => openEntry(meal)} style={styles.addRow}>
              <ThemedText type="small" themeColor="accent">
                + Hinzufügen
              </ThemedText>
            </Pressable>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingBottom: Spacing.one,
  },
  dateArrow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  dateArrowDisabled: {
    opacity: 0.3,
  },
  centered: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  macros: {
    gap: Spacing.three,
  },
  entryList: {
    gap: 0,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  entryInfo: {
    flex: 1,
    gap: 2,
  },
  addRow: {
    paddingTop: Spacing.two,
  },
});
