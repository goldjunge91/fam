import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useHouseholdMembers } from '@/features/household/api';
import { useRecipes } from '@/features/recipes/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { type EntryFormInitial, EntryFormModal } from './components/entry-form-modal';
import { RecipePickerModal } from './components/recipe-picker-modal';
import { type DraggableRecipe, WeekGrid } from './components/week-grid';
import type { ResolvedServings } from './servings';
import { usePortionsPerPerson } from './settings';
import {
  type MealPlanEntry,
  type MealSlot,
  useAddEntryMutation,
  useDeleteEntryMutation,
  useEnsureMealPlanMutation,
  useMealPlan,
  useMealPlanEntriesInRange,
  useReuseLastWeekMutation,
  useUpdateEntryMutation,
} from './use-meal-plans';
import {
  getWeekStart,
  rangeDates,
  rangeLabel,
  shiftAnchor,
  VIEW_MODE_LABELS,
  VIEW_MODES,
  type ViewMode,
} from './week';

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type PendingDrop = { date: string; slot: MealSlot; recipe: DraggableRecipe };
type PendingCell = { date: string; slot: MealSlot };

/**
 * Meal-Planner-Screen (#129, Nachtrag): Tages-/3-Tage-/Wochenraster mit
 * Tippen-zum-Hinzufuegen (Hauptweg) und Drag & Drop (Zusatzweg) +
 * "letzte Woche erneut verwenden".
 *
 * Eigene Seite, nicht Teil von Rezepte — erreichbar von der Uebersicht
 * (Dashboard-Karte) und zusaetzlich als Shortcut aus dem Rezepte-Screen.
 */
export function MealPlannerScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => todayIso());
  const [pendingCell, setPendingCell] = useState<PendingCell | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);

  const dates = rangeDates(anchorDate, viewMode);
  const weekStart = getWeekStart(anchorDate);

  // Wochenplan der sichtbaren Kalenderwoche — nur fuer die wochenweiten
  // Aktionen ("letzte Woche erneut verwenden", "fehlende Zutaten"), die in
  // Tages-/3-Tage-Ansicht ausgeblendet bleiben. Eintraege selbst haengen
  // nicht an einem einzelnen Plan, siehe useMealPlanEntriesInRange.
  const { data: plan } = useMealPlan(householdId, weekStart);
  const { data: entries = [] } = useMealPlanEntriesInRange(
    householdId,
    dates[0],
    dates[dates.length - 1],
  );
  const { data: recipes = [] } = useRecipes(householdId);
  const { data: members = [] } = useHouseholdMembers(householdId ?? '');
  const { data: portionsPerPerson } = usePortionsPerPerson();

  const ensurePlan = useEnsureMealPlanMutation();
  const addEntry = useAddEntryMutation();
  const updateEntry = useUpdateEntryMutation();
  const deleteEntry = useDeleteEntryMutation();
  const reuseLastWeek = useReuseLastWeekMutation();

  const draggableRecipes: DraggableRecipe[] = recipes.map((r) => ({ id: r.id, title: r.title }));

  function handleDropRecipe(date: string, slot: MealSlot, recipe: DraggableRecipe) {
    setPendingDrop({ date, slot, recipe });
  }

  function handleTapEmptyCell(date: string, slot: MealSlot) {
    setPendingCell({ date, slot });
  }

  function handlePickRecipe(recipe: DraggableRecipe) {
    if (!pendingCell) return;
    setPendingDrop({ date: pendingCell.date, slot: pendingCell.slot, recipe });
    setPendingCell(null);
  }

  function handleTapEntry(entry: MealPlanEntry) {
    setEditingEntry(entry);
  }

  // Legt bei Bedarf den Wochenplan der Kalenderwoche an, in der `date` liegt
  // — nicht zwingend die aktuell angezeigte Woche, ein 3-Tage-Fenster kann
  // ueber einen Wochenwechsel hinweg liegen.
  async function ensurePlanForDate(date: string) {
    if (!householdId || !userId) throw new Error('Kein Haushalt/Nutzer');
    return ensurePlan.mutateAsync({
      household_id: householdId,
      week_start_date: getWeekStart(date),
      created_by: userId,
    });
  }

  async function handleSaveNewEntry(resolved: ResolvedServings) {
    if (!pendingDrop || !householdId || !userId) return;
    const targetPlan = await ensurePlanForDate(pendingDrop.date);
    addEntry.mutate(
      {
        meal_plan_id: targetPlan.id,
        household_id: householdId,
        recipe_id: pendingDrop.recipe.id,
        entry_date: pendingDrop.date,
        meal_slot: pendingDrop.slot,
        servings_mode: resolved.servings_mode,
        portions: resolved.portions,
        people_count: resolved.people_count,
        created_by: userId,
      },
      { onSuccess: () => setPendingDrop(null) },
    );
  }

  function handleUpdateEntry(resolved: ResolvedServings) {
    if (!editingEntry || !householdId) return;
    updateEntry.mutate(
      {
        id: editingEntry.id,
        meal_plan_id: editingEntry.meal_plan_id,
        household_id: householdId,
        servings_mode: resolved.servings_mode,
        portions: resolved.portions,
        people_count: resolved.people_count,
      },
      { onSuccess: () => setEditingEntry(null) },
    );
  }

  function handleDeleteEntry() {
    if (!editingEntry || !householdId) return;
    deleteEntry.mutate(
      { id: editingEntry.id, meal_plan_id: editingEntry.meal_plan_id, household_id: householdId },
      { onSuccess: () => setEditingEntry(null) },
    );
  }

  async function handleReuseLastWeek() {
    if (!householdId || !userId) return;
    const targetPlan = await ensurePlanForDate(weekStart);
    reuseLastWeek.mutate(
      {
        household_id: householdId,
        week_start_date: weekStart,
        target_meal_plan_id: targetPlan.id,
        created_by: userId,
      },
      {
        onSuccess: (result) => {
          if (result.copied === 0) {
            Alert.alert('Keine Vorwoche', 'Für die vorherige Woche gibt es keinen Wochenplan.');
          }
        },
      },
    );
  }

  const editingInitial: EntryFormInitial | undefined = editingEntry
    ? {
        servings_mode: editingEntry.servings_mode,
        portions: editingEntry.portions,
        people_count: editingEntry.people_count,
      }
    : undefined;

  return (
    <Screen
      title="Essensplan"
      subtitle={rangeLabel(anchorDate, viewMode)}
      scroll={false}
      back={{ label: 'Übersicht', href: '/' }}>
      <View style={styles.viewModeRow}>
        {VIEW_MODES.map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={`${VIEW_MODE_LABELS[mode]}-Ansicht`}
            accessibilityState={{ selected: viewMode === mode }}
            onPress={() => setViewMode(mode)}
            style={[
              styles.viewModeButton,
              { backgroundColor: viewMode === mode ? theme.accent : theme.backgroundElement },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: viewMode === mode ? '#ffffff' : theme.text }}>
              {VIEW_MODE_LABELS[mode]}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.weekNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => setAnchorDate((d) => shiftAnchor(d, viewMode, -1))}
          style={[styles.weekNavButton, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText>‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{rangeLabel(anchorDate, viewMode)}</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Weiter"
          onPress={() => setAnchorDate((d) => shiftAnchor(d, viewMode, 1))}
          style={[styles.weekNavButton, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText>›</ThemedText>
        </Pressable>
      </View>

      {viewMode === 'week' ? (
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Letzte Woche erneut verwenden"
            onPress={handleReuseLastWeek}>
            <ThemedText type="link">Letzte Woche erneut verwenden</ThemedText>
          </Pressable>
          {plan ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fehlende Zutaten anzeigen"
              onPress={() =>
                router.push({
                  pathname: '/meal-planner/shopping-needs',
                  params: { mealPlanId: plan.id },
                })
              }>
              <ThemedText type="link">Fehlende Zutaten</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <WeekGrid
        dates={dates}
        entries={entries}
        recipes={draggableRecipes}
        onDropRecipe={handleDropRecipe}
        onTapEntry={handleTapEntry}
        onTapEmptyCell={handleTapEmptyCell}
      />

      <RecipePickerModal
        visible={pendingCell !== null}
        recipes={draggableRecipes}
        onDismiss={() => setPendingCell(null)}
        onSelect={handlePickRecipe}
      />

      {pendingDrop ? (
        <EntryFormModal
          visible
          recipeTitle={pendingDrop.recipe.title}
          entryDate={pendingDrop.date}
          mealSlot={pendingDrop.slot}
          portionsPerPerson={portionsPerPerson ?? 1.25}
          householdMemberCount={members.length}
          onDismiss={() => setPendingDrop(null)}
          onSave={handleSaveNewEntry}
        />
      ) : null}

      {editingEntry ? (
        <EntryFormModal
          visible
          recipeTitle={editingEntry.recipe_title}
          entryDate={editingEntry.entry_date}
          mealSlot={editingEntry.meal_slot}
          portionsPerPerson={portionsPerPerson ?? 1.25}
          householdMemberCount={members.length}
          initial={editingInitial}
          onDismiss={() => setEditingEntry(null)}
          onSave={handleUpdateEntry}
          onDelete={handleDeleteEntry}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewModeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  viewModeButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 16,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  weekNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
    marginBottom: Spacing.two,
  },
});
