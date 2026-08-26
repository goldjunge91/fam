import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { FilterIcon, SearchIcon } from '@/components/icons/fam-icon';
import { HubScreen } from '@/components/layout/hub-screen';
import { SectionHeading } from '@/components/layout/section-heading';
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton, Button, HeaderIconButton, MenuButton } from '@/components/ui/buttons';
import { IconSize } from '@/constants/layout';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import {
  CALORIE_BUCKETS,
  isInCalorieBucket,
  type RecipeTemplateWithNutrition,
  useRecipeTemplatesWithNutrition,
} from '@/features/recipes/templates/use-recipe-templates';
import { useTheme } from '@/hooks/use-theme';
import { CalorieCarousel } from './components/calorie-carousel';
import { CATEGORY_TILES, CategoryCarousel } from './components/category-carousel';
import {
  EMPTY_RECIPE_FILTERS,
  RecipeFilterModal,
  type RecipeFilters,
  recipeFilterCount,
} from './components/recipe-filter-modal';
import { RecipePreviewCard } from './components/recipe-preview-card';
import { type RecipeFavoriteKey, useRecipeFavorites } from './recipe-favorites';
import { type DishType, type RecipeListItem, useRecipes } from './use-recipes';
import { DIFFICULTY_LABELS } from './wizard/recipe-metadata-options';

/** Reihenfolge der "Nach Mahlzeiten"-Carousels — Snack und Dessert teilen sich eine Reihe. */
const MEAL_SECTIONS: { key: string; title: string; dishTypes: DishType[] }[] = [
  { key: 'breakfast', title: 'Frühstück', dishTypes: ['breakfast'] },
  { key: 'lunch', title: 'Mittagessen', dishTypes: ['lunch'] },
  { key: 'dinner', title: 'Abendessen', dishTypes: ['dinner'] },
  { key: 'snackDessert', title: 'Snacks & Dessert', dishTypes: ['snack', 'dessert'] },
];

type RecipeView = 'discover' | 'favorites' | 'filtered' | 'household' | 'templates';

type RecipeEntry = {
  key: string;
  id: string;
  kind: 'recipe' | 'template';
  title: string;
  coverImagePath: string | null;
  cookTimeMinutes: number | null;
  difficultyLabel: string | null;
  servings: number;
  dishTypes: DishType[];
  dietaryTags: string[];
  hashtags: string[];
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
};

function recipeEntry(recipe: RecipeListItem): RecipeEntry {
  return {
    key: `recipe-${recipe.id}`,
    id: recipe.id,
    kind: 'recipe',
    title: recipe.title,
    coverImagePath: recipe.cover_image_path,
    cookTimeMinutes: recipe.cook_time_minutes,
    difficultyLabel: recipe.difficulty ? DIFFICULTY_LABELS[recipe.difficulty] : null,
    servings: recipe.default_servings,
    dishTypes: recipe.dish_types,
    dietaryTags: recipe.dietary_tags,
    hashtags: recipe.hashtags,
    kcalPerServing: recipe.kcalPerServing ?? null,
    proteinGPerServing: recipe.proteinGPerServing ?? null,
    carbsGPerServing: recipe.carbsGPerServing ?? null,
  };
}

function templateEntry(template: RecipeTemplateWithNutrition): RecipeEntry {
  return {
    key: `template-${template.id}`,
    id: template.id,
    kind: 'template',
    title: template.title,
    coverImagePath: template.cover_image_path,
    cookTimeMinutes: template.cook_time_minutes,
    difficultyLabel: template.difficulty ? DIFFICULTY_LABELS[template.difficulty] : null,
    servings: template.default_servings,
    dishTypes: template.dish_types,
    dietaryTags: template.dietary_tags,
    hashtags: [],
    kcalPerServing: template.kcalPerServing,
    proteinGPerServing: template.proteinGPerServing,
    carbsGPerServing: template.carbsGPerServing,
  };
}

function matchesCategory(entry: RecipeEntry, categoryKey: string | null) {
  if (!categoryKey) return true;
  switch (categoryKey) {
    case 'breakfast':
    case 'lunch':
    case 'dinner':
    case 'snack':
    case 'dessert':
      return entry.dishTypes.includes(categoryKey);
    case 'vegan':
    case 'vegetarian':
      return entry.dietaryTags.includes(categoryKey);
    case 'high_protein':
      return (
        entry.kcalPerServing !== null &&
        entry.kcalPerServing > 0 &&
        entry.proteinGPerServing !== null &&
        (entry.proteinGPerServing * 4) / entry.kcalPerServing >= 0.25
      );
    case 'low_carb':
      return entry.carbsGPerServing !== null && entry.carbsGPerServing < 20;
    case 'quick':
      return entry.cookTimeMinutes !== null && entry.cookTimeMinutes <= 20;
    default:
      return true;
  }
}

function matchesFilters(entry: RecipeEntry, filters: RecipeFilters) {
  if (!matchesCategory(entry, filters.categoryKey)) return false;

  const calorieBucket =
    filters.calorieIndex !== null ? CALORIE_BUCKETS[filters.calorieIndex] : null;
  if (
    calorieBucket &&
    (entry.kcalPerServing === null || !isInCalorieBucket(entry.kcalPerServing, calorieBucket))
  ) {
    return false;
  }

  const meal = filters.mealKey
    ? MEAL_SECTIONS.find((section) => section.key === filters.mealKey)
    : null;
  if (meal && !meal.dishTypes.some((dishType) => entry.dishTypes.includes(dishType))) return false;

  if (
    filters.tags.length > 0 &&
    (entry.kind !== 'recipe' || !filters.tags.every((tag) => entry.hashtags.includes(tag)))
  ) {
    return false;
  }

  return true;
}

function openEntry(entry: RecipeEntry) {
  if (entry.kind === 'template') {
    router.push({ pathname: '/recipe/template-detail', params: { id: entry.id } });
    return;
  }
  router.push({ pathname: '/recipe/detail', params: { id: entry.id } });
}

function favoriteKey(entry: RecipeEntry): RecipeFavoriteKey {
  return `${entry.kind}:${entry.id}`;
}

function RecipeList({ entries }: { entries: RecipeEntry[] }) {
  return (
    <View className="gap-[10px]">
      {entries.map((entry, index) => (
        <RecipePreviewCard
          key={entry.key}
          title={entry.title}
          coverImagePath={entry.coverImagePath}
          cookTimeMinutes={entry.cookTimeMinutes}
          difficultyLabel={entry.difficultyLabel}
          servings={entry.servings}
          paletteIndex={index + entry.title.length}
          onPress={() => openEntry(entry)}
        />
      ))}
    </View>
  );
}

/** Horizontal scrollende Foto-Karten fuer eine Mahlzeitenkategorie. */
function MealSection({ title, entries }: { title: string; entries: RecipeEntry[] }) {
  return (
    <View className="mb-five">
      <SectionHeading title={title} />
      <ScrollView
        horizontal
        role="list"
        aria-label={`${title} Rezepte`}
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-[10px]">
        {entries.map((entry, index) => (
          <View key={entry.key} className="w-[260px]">
            <RecipePreviewCard
              title={entry.title}
              coverImagePath={entry.coverImagePath}
              cookTimeMinutes={entry.cookTimeMinutes}
              difficultyLabel={entry.difficultyLabel}
              servings={entry.servings}
              paletteIndex={index + entry.title.length}
              onPress={() => openEntry(entry)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function EmptyPanel({ children }: { children: string }) {
  return (
    <View className="min-h-[124px] rounded-sheet items-center justify-center px-seven py-[22px] bg-background-element/80">
      <ThemedText type="body" className="font-bold text-center">
        {children}
      </ThemedText>
      <ThemedText
        type="caption"
        themeColor="textSecondary"
        className="text-center mt-[5px] font-medium">
        Über den Plus-Button kannst du jederzeit ein neues Rezept anlegen.
      </ThemedText>
      <Button label="Rezept hinzufügen" onPress={() => {}} />
    </View>
  );
}

export function RecipesScreen() {
  const theme = useTheme();
  const { openDrawer } = useNavigationChrome();
  const [view, setView] = useState<RecipeView>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RecipeFilters>(EMPTY_RECIPE_FILTERS);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string | null>(null);
  const [templateCalorieFilter, setTemplateCalorieFilter] = useState<number | null>(null);

  const { activeHouseholdId } = useActiveHousehold();
  const { data: recipes = [], isLoading: recipesLoading } = useRecipes(
    activeHouseholdId ?? undefined,
  );
  const { data: templates = [], isLoading: templatesLoading } = useRecipeTemplatesWithNutrition();
  const { favorites } = useRecipeFavorites();

  const query = searchQuery.trim().toLocaleLowerCase('de');

  const householdEntries = useMemo(
    () =>
      recipes
        .map(recipeEntry)
        .filter((entry) => !query || entry.title.toLocaleLowerCase('de').includes(query)),
    [recipes, query],
  );

  const searchedTemplates = useMemo(
    () => templates.filter((t) => !query || t.title.toLocaleLowerCase('de').includes(query)),
    [templates, query],
  );
  const templateEntries = useMemo(() => searchedTemplates.map(templateEntry), [searchedTemplates]);

  const filteredTemplateEntries = useMemo(() => {
    if (!templateCategoryFilter && templateCalorieFilter === null) return templateEntries;
    const tile = templateCategoryFilter
      ? CATEGORY_TILES.find((t) => t.key === templateCategoryFilter)
      : null;
    const bucket = templateCalorieFilter !== null ? CALORIE_BUCKETS[templateCalorieFilter] : null;
    return searchedTemplates
      .filter((t) => !tile || tile.matches(t))
      .filter(
        (t) =>
          !bucket || (t.kcalPerServing !== null && isInCalorieBucket(t.kcalPerServing, bucket)),
      )
      .map(templateEntry);
  }, [searchedTemplates, templateEntries, templateCategoryFilter, templateCalorieFilter]);

  const mealSections = useMemo(
    () =>
      MEAL_SECTIONS.map((section) => ({
        ...section,
        entries: searchedTemplates
          .filter((t) => section.dishTypes.some((type) => t.dish_types.includes(type)))
          .map(templateEntry),
      })).filter((section) => section.entries.length > 0),
    [searchedTemplates],
  );

  const allEntries = [...householdEntries, ...templateEntries];
  const availableTags = [...new Set(recipes.flatMap((recipe) => recipe.hashtags))].sort((a, b) =>
    a.localeCompare(b, 'de'),
  );
  const filterEntries = (nextFilters: RecipeFilters) =>
    allEntries.filter((entry) => matchesFilters(entry, nextFilters));
  const filteredEntries = filterEntries(filters);
  const favoriteEntries = [...householdEntries, ...templateEntries].filter((entry) =>
    favorites.has(favoriteKey(entry)),
  );
  const activeFilterCount = recipeFilterCount(filters);
  const isLoading = recipesLoading || templatesLoading;

  function openTemplates() {
    setTemplateCategoryFilter(null);
    setTemplateCalorieFilter(null);
    setView('templates');
  }

  function selectCategoryTile(key: string | null) {
    setTemplateCategoryFilter(key);
    setTemplateCalorieFilter(null);
    if (key) setView('templates');
  }

  function selectCalorieTile(index: number | null) {
    setTemplateCalorieFilter(index);
    setTemplateCategoryFilter(null);
    if (index !== null) setView('templates');
  }

  function goBackToDiscover() {
    setTemplateCategoryFilter(null);
    setTemplateCalorieFilter(null);
    setFilters(EMPTY_RECIPE_FILTERS);
    setView('discover');
  }

  function applyFilters(nextFilters: RecipeFilters) {
    setFilters(nextFilters);
    setShowFilters(false);
    setView(recipeFilterCount(nextFilters) > 0 ? 'filtered' : 'discover');
  }

  const activeCategoryTile = templateCategoryFilter
    ? CATEGORY_TILES.find((t) => t.key === templateCategoryFilter)
    : null;
  const activeCalorieBucket =
    templateCalorieFilter !== null ? CALORIE_BUCKETS[templateCalorieFilter] : null;
  const screenTitle =
    view === 'favorites'
      ? 'Meine Favoriten'
      : view === 'filtered'
        ? 'Gefilterte Rezepte'
        : view === 'household'
          ? 'Eigene Rezepte'
          : view === 'templates'
            ? (activeCategoryTile?.label ?? activeCalorieBucket?.label ?? 'Vorlagen')
            : 'Rezepte';

  return (
    <HubScreen
      safeAreaClassName="flex-1 w-full max-w-[800px] self-center"
      header={{
        title: screenTitle,
        align: 'center',
        titleSize: 'large',
        leading:
          view === 'discover' || view === 'favorites' || view === 'household' ? (
            <MenuButton onPress={openDrawer} />
          ) : (
            <BackButton label="Zurück zu Rezepte" variant="header" onPress={goBackToDiscover} />
          ),
        trailing: (
          <View className="flex-row gap-[6px]">
            <HeaderIconButton
              label="Rezepte durchsuchen"
              onPress={() => setShowSearch((visible) => !visible)}>
              <SearchIcon size={IconSize.nav} color={theme.text} />
            </HeaderIconButton>
            <HeaderIconButton
              label={
                activeFilterCount > 0
                  ? `Rezepte filtern, ${activeFilterCount} aktiv`
                  : 'Rezepte filtern'
              }
              onPress={() => setShowFilters(true)}
              className={activeFilterCount > 0 ? 'bg-accent' : undefined}>
              <FilterIcon
                size={IconSize.nav}
                color={activeFilterCount > 0 ? theme.background : theme.text}
              />
            </HeaderIconButton>
          </View>
        ),
      }}>
      {/* Filter-Modal für Kategorien, Mahlzeitentypen, Kalorienbereiche und Tags */}
      <RecipeFilterModal
        visible={showFilters}
        filters={filters}
        tags={availableTags}
        getResultCount={(draft) => filterEntries(draft).length}
        onApply={applyFilters}
        onClose={() => setShowFilters(false)}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-[15px] pt-one pb-[126px]"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Aufklappbare Textsuche für Rezepttitel */}
        {showSearch ? (
          <View className="h-[42px] flex-row items-center gap-[9px] rounded-fam-large px-[13px] mb-[10px] bg-background-element/85">
            <SearchIcon color={theme.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              role="searchbox"
              aria-label="Rezepte durchsuchen"
              placeholder="Rezepte durchsuchen…"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              className="flex-1 h-full text-[14px] font-medium py-0 text-text"
            />
          </View>
        ) : null}

        {/* Tab-Leiste (Entdecken vs. Eigene Rezepte vs. Meine Favoriten) */}
        {view === 'discover' || view === 'favorites' || view === 'household' ? (
          <View className="flex-row gap-two mb-[18px]">
            <Pressable
              onPress={() => setView('discover')}
              role="button"
              aria-label="Entdecken"
              aria-selected={view === 'discover'}
              className={`tab-btn ${view === 'discover' ? 'tab-btn-active' : 'tab-btn-idle'}`}>
              <ThemedText
                type="detail"
                themeColor={view === 'discover' ? 'onAccent' : 'textSecondary'}
                className="tab-btn-label">
                Entdecken
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setView('household')}
              role="button"
              aria-label="Eigene Rezepte"
              aria-selected={view === 'household'}
              className={`tab-btn ${view === 'household' ? 'tab-btn-active' : 'tab-btn-idle'}`}>
              <ThemedText
                type="detail"
                themeColor={view === 'household' ? 'onAccent' : 'textSecondary'}
                className="tab-btn-label">
                Eigene Rezepte
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setView('favorites')}
              role="button"
              aria-label="Meine Favoriten"
              aria-selected={view === 'favorites'}
              className={`tab-btn ${view === 'favorites' ? 'tab-btn-active' : 'tab-btn-idle'}`}>
              <ThemedText
                type="detail"
                themeColor={view === 'favorites' ? 'onAccent' : 'textSecondary'}
                className="tab-btn-label">
                Meine Favoriten
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {/* Ladezustand */}
        {isLoading ? (
          <ActivityIndicator
            accessibilityLabel="Rezepte werden geladen"
            color={theme.accent}
            className="mt-[42px]"
          />
        ) : view === 'favorites' ? (
          /* Favoriten-Ansicht */
          favoriteEntries.length > 0 ? (
            <RecipeList entries={favoriteEntries} />
          ) : (
            <EmptyPanel>Noch keine Favoriten gespeichert.</EmptyPanel>
          )
        ) : view === 'filtered' ? (
          /* Gefilterte Ergebnisse aus dem Filter-Modal */
          filteredEntries.length > 0 ? (
            <RecipeList entries={filteredEntries} />
          ) : (
            <EmptyPanel>Keine Rezepte für diese Filter.</EmptyPanel>
          )
        ) : view === 'household' ? (
          /* Liste aller eigenen Haushaltsrezepte */
          householdEntries.length > 0 ? (
            <RecipeList entries={householdEntries} />
          ) : (
            <EmptyPanel>Noch keine eigenen Rezepte.</EmptyPanel>
          )
        ) : view === 'templates' ? (
          /* Gefilterte Rezeptvorlagen */
          filteredTemplateEntries.length > 0 ? (
            <RecipeList entries={filteredTemplateEntries} />
          ) : (
            <EmptyPanel>Keine Vorlagen für diesen Filter.</EmptyPanel>
          )
        ) : householdEntries.length > 0 || templates.length > 0 ? (
          /* Standard Entdecken-Ansicht mit Karussells und Mahlzeitenbereichen */
          <>
            {/* Karussell: Themenkategorien (z. B. Vegan, Schnell, High-Protein) */}
            <View className="mb-five">
              <SectionHeading title="Kategorien" />
              <CategoryCarousel
                selectedKey={templateCategoryFilter}
                onSelect={selectCategoryTile}
              />
            </View>

            {/* Karussell: Kalorien-Buckets (<400 kcal, 400-600 kcal, etc.) */}
            <View className="mb-five">
              <SectionHeading title="Rezepte nach Kalorien" />
              <CalorieCarousel selectedIndex={templateCalorieFilter} onSelect={selectCalorieTile} />
            </View>

            {mealSections.length > 0 ? (
              <View className="mb-five">
                <SectionHeading
                  title="Nach Mahlzeiten"
                  actionLabel="Alle Vorlagen ansehen"
                  onActionPress={openTemplates}
                />
                {mealSections.map((section) => (
                  <MealSection key={section.key} title={section.title} entries={section.entries} />
                ))}
              </View>
            ) : null}

            {/* Eigene Haushaltsrezepte */}
            <View className="mb-five">
              <SectionHeading
                title="Unsere Rezepte"
                actionLabel="Alle ansehen"
                onActionPress={() => setView('household')}
              />
              {householdEntries.length > 0 ? (
                <RecipeList entries={householdEntries.slice(0, 4)} />
              ) : (
                <EmptyPanel>Noch keine Rezepte im Haushalt.</EmptyPanel>
              )}
            </View>
          </>
        ) : (
          /* Leerzustand wenn keine Rezepte/Vorlagen vorhanden sind */
          <EmptyPanel>Noch keine Rezepte im Haushalt.</EmptyPanel>
        )}
      </ScrollView>
    </HubScreen>
  );
}
