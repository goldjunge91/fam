import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Radius, withAlpha } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useHouseholdMembers } from '@/features/household/api';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useProfileInitials } from '@/features/navigation/use-profile-initials';
import { useRecipes } from '@/features/recipes/use-recipes';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { type EntryFormInitial, EntryFormModal } from './components/entry-form-modal';
import { MealPlannerVersionSwitcher } from './components/meal-planner-version-switcher';
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
  periodLabel,
  rangeDates,
  shiftAnchor,
  todayIso,
  VIEW_MODE_LABELS,
  VIEW_MODES,
  type ViewMode,
} from './week';

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
export function MealPlannerScreenV2() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const { openDrawer, openProfile } = useNavigationChrome();
  const initials = useProfileInitials();
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

  const draggableRecipes: DraggableRecipe[] = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    coverImagePath: r.cover_image_path,
  }));

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
      {
        id: editingEntry.id,
        meal_plan_id: editingEntry.meal_plan_id,
        household_id: householdId,
      },
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
      title="Essensplan V2"
      scroll={false}
      chrome={{
        onMenuPress: openDrawer,
        onAvatarPress: openProfile,
        initials,
        trailing: (
          <HeaderIconButton
            label="Aktuelle Woche anzeigen"
            onPress={() => setAnchorDate(todayIso())}>
            <Image
              source="sf:calendar"
              contentFit="contain"
              tintColor={theme.accent}
              style={styles.calendarIcon}
            />
          </HeaderIconButton>
        ),
      }}
      backgroundGradient={hubGradient}>
      <View style={styles.content}>
        <MealPlannerVersionSwitcher selected="v2" />

        <SegmentedControl
          label="Zeitraum"
          options={VIEW_MODES.map((mode) => ({
            value: mode,
            label: VIEW_MODE_LABELS[mode],
            accessibilityLabel: `${VIEW_MODE_LABELS[mode]}-Ansicht`,
          }))}
          selected={viewMode}
          onSelect={setViewMode}
          labelStyle={styles.viewModeLabel}
        />

        <View style={styles.periodRow}>
          <Pressable
            role="button"
            aria-label="Vorheriger Zeitraum"
            onPress={() => setAnchorDate((date) => shiftAnchor(date, viewMode, -1))}
            style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}>
            <ThemedText themeColor="accent" style={styles.chevron}>
              ‹
            </ThemedText>
          </Pressable>
          <View style={styles.periodCopy}>
            <ThemedText style={styles.periodTitle}>{periodLabel(dates)}</ThemedText>
          </View>
          <Pressable
            role="button"
            aria-label="Nächster Zeitraum"
            onPress={() => setAnchorDate((date) => shiftAnchor(date, viewMode, 1))}
            style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}>
            <ThemedText themeColor="accent" style={styles.chevron}>
              ›
            </ThemedText>
          </Pressable>
        </View>

        {viewMode === 'week' ? (
          <View style={styles.actionsRow}>
            <Pressable
              role="button"
              aria-label="Vorwoche übernehmen"
              onPress={handleReuseLastWeek}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: withAlpha(theme.backgroundElement, 0.78) },
                pressed && styles.pressed,
              ]}>
              <ThemedText themeColor="accent" style={styles.actionLabel}>
                Vorwoche übernehmen
              </ThemedText>
            </Pressable>
            <Pressable
              role="button"
              aria-label="Einkauf vorbereiten"
              disabled={!plan}
              onPress={() => {
                if (!plan) return;
                router.push({
                  pathname: '/meal-planner/shopping-needs',
                  params: { mealPlanId: plan.id },
                });
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: withAlpha(theme.backgroundElement, 0.78) },
                !plan && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <ThemedText themeColor="accent" style={styles.actionLabel}>
                Einkauf vorbereiten
              </ThemedText>
            </Pressable>
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
      </View>

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
  calendarIcon: {
    width: 19,
    height: 19,
  },
  content: {
    flex: 1,
  },
  viewModeLabel: {
    ...FontSize[18],
    lineHeight: 22,
  },
  periodRow: {
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 9,
  },
  periodButton: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    ...FontSize[19],
    lineHeight: 22,
    fontWeight: 500,
  },
  periodCopy: {
    flex: 1,
    alignItems: 'center',
  },
  periodTitle: {
    ...FontSize[17],
    lineHeight: 21,
    fontWeight: 700,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 7,
    paddingTop: 9,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.controlLarge,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
  },
  actionLabel: {
    ...FontSize[10],
    lineHeight: 13,
    fontWeight: 700,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
});
