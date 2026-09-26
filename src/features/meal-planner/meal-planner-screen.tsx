import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { MenuButton } from '@/components/ui/menu-button';
import { Button, MIN_TOUCH_SIZE, Press, SegmentedControl, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useHouseholdMembers } from '@/features/household/api';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import { useRecipes } from '@/features/recipes/hooks/use-recipes';
import {
  DEFAULT_MODULE_PREFERENCES,
  useModulePreferences,
} from '@/features/settings/module-preferences';
import { useFeatureAccess } from '@/features/settings/use-feature-access';
import { type EntryFormInitial, EntryFormModal } from './components/entry-form-modal';
import { type RecipeOption, RecipePickerModal } from './components/recipe-picker-modal';
import { WeekGrid } from './components/week-grid';
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

type PendingRecipe = { date: string; slot: MealSlot; recipe: RecipeOption };
type PendingCell = { date: string; slot: MealSlot };

const styles = StyleSheet.create((theme) => ({
  content: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
  },
  periodRow: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.space.md,
  },
  // Die Mindestflaeche muss auf dem `style` liegen: `containerStyle` von Press
  // landet auf dem animated Wrapper, der selbst nicht antippbar ist.
  periodButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCopy: {
    flex: 1,
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.space.md,
    paddingTop: theme.space.md,
  },
  actionContainer: {
    flex: 1,
  },
  calendarIcon: {
    width: 19,
    height: 19,
  },
}));

export function MealPlannerScreen() {
  const { colors } = useTheme();
  const { openDrawer } = useNavigationChrome();
  const { session } = useSession();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;
  const { data: rawModules } = useModulePreferences(userId);
  const { getFeatureFlagState } = useFeatureAccess();
  const recipesFeatureEnabled = getFeatureFlagState('module-recipes') !== false;
  const recipesEnabled =
    (rawModules ?? DEFAULT_MODULE_PREFERENCES).recipes && recipesFeatureEnabled;

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => todayIso());
  const [pendingCell, setPendingCell] = useState<PendingCell | null>(null);
  const [pendingRecipe, setPendingRecipe] = useState<PendingRecipe | null>(null);
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
  const { data: recipes = [] } = useRecipes(recipesEnabled ? householdId : undefined);
  const { data: members = [] } = useHouseholdMembers(householdId ?? '');
  const { data: portionsPerPerson } = usePortionsPerPerson();

  const ensurePlan = useEnsureMealPlanMutation();
  const addEntry = useAddEntryMutation();
  const updateEntry = useUpdateEntryMutation();
  const deleteEntry = useDeleteEntryMutation();
  const reuseLastWeek = useReuseLastWeekMutation();

  const recipeOptions: RecipeOption[] = recipesEnabled
    ? recipes.map((r) => ({
        id: r.id,
        title: r.title,
        coverImagePath: r.cover_image_path,
      }))
    : [];

  function handleTapEmptyCell(date: string, slot: MealSlot) {
    if (!recipesEnabled) return;
    setPendingCell({ date, slot });
  }

  function handlePickRecipe(recipe: RecipeOption) {
    if (!pendingCell) return;
    setPendingRecipe({ date: pendingCell.date, slot: pendingCell.slot, recipe });
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
    if (!pendingRecipe || !householdId || !userId) return;
    const targetPlan = await ensurePlanForDate(pendingRecipe.date);
    addEntry.mutate(
      {
        meal_plan_id: targetPlan.id,
        household_id: householdId,
        recipe_id: pendingRecipe.recipe.id,
        entry_date: pendingRecipe.date,
        meal_slot: pendingRecipe.slot,
        servings_mode: resolved.servings_mode,
        portions: resolved.portions,
        people_count: resolved.people_count,
        created_by: userId,
      },
      { onSuccess: () => setPendingRecipe(null) },
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
    <HubScreen
      header={{
        title: 'Essensplan',
        align: 'center',
        leading: <MenuButton onPress={openDrawer} />,
        trailing: (
          <HeaderIconButton
            label="Aktuelle Woche anzeigen"
            onPress={() => setAnchorDate(todayIso())}>
            <Image
              source="sf:calendar"
              contentFit="contain"
              tintColor={colors.accent}
              style={styles.calendarIcon}
            />
          </HeaderIconButton>
        ),
      }}>
      <View style={styles.content}>
        {/* Ansichtsmodus-Tabs (Tag / Woche) */}
        <SegmentedControl
          label="Zeitraum"
          options={VIEW_MODES.map((mode) => ({
            value: mode,
            label: VIEW_MODE_LABELS[mode],
            accessibilityLabel: `${VIEW_MODE_LABELS[mode]}-Ansicht`,
          }))}
          selected={viewMode}
          onSelect={setViewMode}
          selectionRole="tab"
          appearance="surface"
        />

        {/* Zeitraum-Navigation mit Pfeilen & Monats-/Datumsangabe */}
        <View style={styles.periodRow}>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Vorheriger Zeitraum"
            onPress={() => setAnchorDate((date) => shiftAnchor(date, viewMode, -1))}
            style={styles.periodButton}>
            <Txt variant="title" tone="secondary">
              ‹
            </Txt>
          </Press>
          <View style={styles.periodCopy}>
            <Txt variant="body" weight="700">
              {periodLabel(dates)}
            </Txt>
          </View>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Nächster Zeitraum"
            onPress={() => setAnchorDate((date) => shiftAnchor(date, viewMode, 1))}
            style={styles.periodButton}>
            <Txt variant="title" tone="secondary">
              ›
            </Txt>
          </Press>
        </View>

        {viewMode === 'week' ? (
          <View style={styles.actionsRow}>
            <Button
              title="Vorwoche übernehmen"
              variant="secondary"
              size="sm"
              style={styles.actionContainer}
              accessibilityLabel="Vorwoche übernehmen"
              onPress={handleReuseLastWeek}
            />
            <Button
              title="Einkauf vorbereiten"
              variant="secondary"
              size="sm"
              style={styles.actionContainer}
              accessibilityLabel="Einkauf vorbereiten"
              disabled={!plan}
              onPress={() => {
                if (!plan) return;
                router.push({
                  pathname: '/meal-planner/shopping-needs',
                  params: { mealPlanId: plan.id },
                });
              }}
            />
          </View>
        ) : null}

        <WeekGrid
          dates={dates}
          entries={entries}
          canAddRecipes={recipesEnabled}
          onTapEntry={handleTapEntry}
          onTapEmptyCell={handleTapEmptyCell}
        />
      </View>

      {/* Rezept-Auswahlmodal beim Tippen auf einen leeren Slot */}
      <RecipePickerModal
        visible={pendingCell !== null}
        recipes={recipeOptions}
        onDismiss={() => setPendingCell(null)}
        onSelect={handlePickRecipe}
      />

      {/* Portions- & Slot-Formular für neu hinzugefügte Mahlzeiten */}
      {pendingRecipe ? (
        <EntryFormModal
          visible
          recipeTitle={pendingRecipe.recipe.title}
          entryDate={pendingRecipe.date}
          mealSlot={pendingRecipe.slot}
          portionsPerPerson={portionsPerPerson ?? 1.25}
          householdMemberCount={members.length}
          onDismiss={() => setPendingRecipe(null)}
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
    </HubScreen>
  );
}
