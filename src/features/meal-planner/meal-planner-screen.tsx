import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { HeaderIconButton, MenuButton } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useHouseholdMembers } from '@/features/household/api';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
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

export function MealPlannerScreen() {
  const theme = useTheme();
  const { openDrawer } = useNavigationChrome();
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

  // Der sichtbare Wochenplan wird nur fuer wochenweite Aktionen benoetigt.
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

  // Ein 3-Tage-Fenster kann Eintraege in zwei Wochenplaenen anlegen.
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
    <HubScreen
      rootClassName="mp-root"
      safeAreaClassName="mp-safe-area"
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
              tintColor={theme.accent}
              // expo-image unterstuetzt kein NativeWind-className.
              style={{ width: 19, height: 19 }}
            />
          </HeaderIconButton>
        ),
      }}>
      <View className="mp-content">
        <View className="flex-row gap-two" role="tablist" aria-label="Zeitraum">
          {VIEW_MODES.map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              role="tab"
              aria-label={`${VIEW_MODE_LABELS[mode]}-Ansicht`}
              aria-selected={viewMode === mode}
              className={`tab-btn ${viewMode === mode ? 'tab-btn-active' : 'tab-btn-idle'}`}>
              <ThemedText
                type="controlActionLarge"
                themeColor={viewMode === mode ? 'onAccent' : 'textSecondary'}
                className="tab-btn-label">
                {VIEW_MODE_LABELS[mode]}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View className="mp-period-row">
          <Pressable
            role="button"
            aria-label="Vorheriger Zeitraum"
            onPress={() => setAnchorDate((date) => shiftAnchor(date, viewMode, -1))}
            className="mp-period-button">
            <ThemedText themeColor="accent" className="mp-chevron">
              ‹
            </ThemedText>
          </Pressable>
          <View className="mp-period-copy">
            <ThemedText className="mp-period-title">{periodLabel(dates)}</ThemedText>
          </View>
          <Pressable
            role="button"
            aria-label="Nächster Zeitraum"
            onPress={() => setAnchorDate((date) => shiftAnchor(date, viewMode, 1))}
            className="mp-period-button">
            <ThemedText themeColor="accent" className="mp-chevron">
              ›
            </ThemedText>
          </Pressable>
        </View>

        {viewMode === 'week' ? (
          <View className="mp-actions-row">
            <Pressable
              role="button"
              aria-label="Vorwoche übernehmen"
              onPress={handleReuseLastWeek}
              className="mp-action-button"
              // borderCurve ist ein echter Laufzeitwert ohne Tailwind-Aequivalent.
              style={{ borderCurve: 'continuous' }}>
              <ThemedText themeColor="accent" className="mp-action-label">
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
              className={`mp-action-button ${!plan ? 'mp-action-button-disabled' : ''}`}
              // borderCurve ist ein echter Laufzeitwert ohne Tailwind-Aequivalent.
              style={{ borderCurve: 'continuous' }}>
              <ThemedText themeColor="accent" className="mp-action-label">
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
    </HubScreen>
  );
}
