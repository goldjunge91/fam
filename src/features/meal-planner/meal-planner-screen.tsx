import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useHouseholdMembers } from '@/features/household/api';
import { useRecipes } from '@/features/recipes/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { type EntryFormInitial, EntryFormModal } from './components/entry-form-modal';
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
  useMealPlanEntries,
  useReuseLastWeekMutation,
  useUpdateEntryMutation,
} from './use-meal-plans';
import { defaultWeekPlanName, getWeekStart, nextWeekStart, previousWeekStart } from './week';

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type PendingDrop = { date: string; slot: MealSlot; recipe: DraggableRecipe };

/**
 * Meal-Planner-Screen (#129): Wochenplan-Grid mit Drag & Drop +
 * "letzte Woche erneut verwenden".
 */
export function MealPlannerScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;

  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayIso()));
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealPlanEntry | null>(null);

  const { data: plan, isLoading: planLoading } = useMealPlan(householdId, weekStart);
  const { data: entries = [] } = useMealPlanEntries(plan?.id);
  const { data: recipes = [] } = useRecipes(householdId);
  const { data: members = [] } = useHouseholdMembers(householdId ?? '');
  const { data: portionsPerPerson } = usePortionsPerPerson();

  const ensurePlan = useEnsureMealPlanMutation();
  const addEntry = useAddEntryMutation();
  const updateEntry = useUpdateEntryMutation();
  const deleteEntry = useDeleteEntryMutation();
  const reuseLastWeek = useReuseLastWeekMutation();

  // Wochenplan bei Bedarf automatisch anlegen, sobald diese Woche betreten
  // wird — sonst haette ein Drop keinen meal_plan_id, auf den er zeigen kann.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ensurePlan.mutate ist stabil genug, Aufnahme wuerde eine Endlosschleife riskieren.
  useEffect(() => {
    if (!householdId || !userId || planLoading || plan) return;
    ensurePlan.mutate({
      household_id: householdId,
      week_start_date: weekStart,
      created_by: userId,
    });
  }, [householdId, userId, weekStart, plan, planLoading]);

  const draggableRecipes: DraggableRecipe[] = recipes.map((r) => ({ id: r.id, title: r.title }));

  function handleDropRecipe(date: string, slot: MealSlot, recipe: DraggableRecipe) {
    setPendingDrop({ date, slot, recipe });
  }

  function handleTapEntry(entry: MealPlanEntry) {
    setEditingEntry(entry);
  }

  function handleSaveNewEntry(resolved: ResolvedServings) {
    if (!pendingDrop || !plan || !householdId || !userId) return;
    addEntry.mutate(
      {
        meal_plan_id: plan.id,
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
    let targetPlanId = plan?.id;
    if (!targetPlanId) {
      const created = await ensurePlan.mutateAsync({
        household_id: householdId,
        week_start_date: weekStart,
        created_by: userId,
      });
      targetPlanId = created.id;
    }
    reuseLastWeek.mutate(
      {
        household_id: householdId,
        week_start_date: weekStart,
        target_meal_plan_id: targetPlanId,
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
      title="Wochenplan"
      subtitle={plan?.name ?? defaultWeekPlanName(weekStart)}
      scroll={false}
      back={{ label: 'Rezepte' }}>
      <View style={styles.weekNav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vorherige Woche"
          onPress={() => setWeekStart((w) => previousWeekStart(w))}
          style={[styles.weekNavButton, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText>‹</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{defaultWeekPlanName(weekStart)}</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nächste Woche"
          onPress={() => setWeekStart((w) => nextWeekStart(w))}
          style={[styles.weekNavButton, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText>›</ThemedText>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Letzte Woche erneut verwenden"
        onPress={handleReuseLastWeek}
        style={styles.reuseButton}>
        <ThemedText type="link">Letzte Woche erneut verwenden</ThemedText>
      </Pressable>

      {planLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <WeekGrid
          weekStart={weekStart}
          entries={entries}
          recipes={draggableRecipes}
          onDropRecipe={handleDropRecipe}
          onTapEntry={handleTapEntry}
        />
      )}

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
  reuseButton: { alignItems: 'center', marginBottom: Spacing.two },
  loading: { marginTop: Spacing.five },
});
