import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FilterIcon, SearchIcon } from '@/components/icons/fam-icon';
import { HubScreen } from '@/components/layout/hub-screen';
import { SectionHeading } from '@/components/layout/section-heading';
import { rs, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton, HeaderIconButton, MenuButton } from '@/components/ui/buttons';
import { Press, Txt } from '@/constants/ui';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import {
  type CatalogRecipe,
  useCatalogRecipes,
} from '@/features/recipes/catalog/use-recipe-catalog';
import {
  CALORIE_BUCKETS,
  isInCalorieBucket,
} from '@/features/recipes/domain/recipe-calorie-buckets';
import { CalorieCarousel } from '../components/calorie-carousel';
import { CATEGORY_TILES, CategoryCarousel } from '../components/category-carousel';
import {
  EMPTY_RECIPE_FILTERS,
  RecipeFilterModal,
  type RecipeFilters,
  recipeFilterCount,
} from '../components/recipe-filter-modal';
import { RecipePreviewCard } from '../components/recipe-preview-card';
import { type RecipeFavoriteKey, useRecipeFavorites } from '../domain/recipe-favorites';
import { type DishType, type RecipeListItem, useRecipes } from '../hooks/use-recipes';
import { DIFFICULTY_LABELS } from '../wizard/recipe-metadata-options';

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
  kind: 'recipe' | 'catalog';
  slug?: string;
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

function templateEntry(template: CatalogRecipe): RecipeEntry {
  return {
    key: `template-${template.id}`,
    id: template.id,
    kind: 'catalog',
    slug: template.slug,
    title: template.title,
    coverImagePath: template.cover_image_path,
    cookTimeMinutes: template.cook_time_minutes,
    difficultyLabel: template.difficulty ? DIFFICULTY_LABELS[template.difficulty] : null,
    servings: template.default_servings,
    dishTypes: template.dish_types as DishType[],
    dietaryTags: template.dietary_tags,
    hashtags: [],
    kcalPerServing: null,
    proteinGPerServing: null,
    carbsGPerServing: null,
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

/** Katalogrezepte bleiben im Karussell sichtbar, solange ihnen noch Nährwerte fehlen. */
function matchesTemplateCalorieBucket(
  entry: RecipeEntry,
  bucket: (typeof CALORIE_BUCKETS)[number],
) {
  return (
    entry.kcalPerServing === null ||
    (entry.kcalPerServing !== null && isInCalorieBucket(entry.kcalPerServing, bucket))
  );
}

function openEntry(entry: RecipeEntry) {
  if (entry.kind === 'catalog' && entry.slug) {
    router.push({ pathname: '/recipe/catalog/[slug]', params: { slug: entry.slug } });
    return;
  }
  router.push({ pathname: '/recipe/[id]', params: { id: entry.id } });
}

function favoriteKey(entry: RecipeEntry): RecipeFavoriteKey {
  return `${entry.kind}:${entry.id}`;
}

const styles = StyleSheet.create((theme) => ({
  listContent: {
    paddingHorizontal: rs(15),
    paddingTop: rs(4),
    paddingBottom: rs(126),
  },
  listGap: {
    height: rs(10),
  },
  section: {
    marginBottom: rs(32),
  },
  mealScrollContent: {
    paddingHorizontal: rs(6),
  },
  mealCardFrame: {
    flexShrink: 0,
  },
  mealCardSpacing: {
    marginRight: rs(10),
  },
  emptyPanel: {
    minHeight: rs(124),
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(56),
    paddingVertical: rs(22),
  },
  searchRow: {
    height: rs(42),
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(9),
    borderRadius: theme.radius.famLarge,
    paddingHorizontal: rs(13),
    marginBottom: rs(10),
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  tabRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
    marginBottom: rs(18),
  },
  tabContainer: {
    flex: 1,
  },
  tab: {
    width: '100%',
    height: rs(46),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: rs(6),
  },
  discoverScroll: {
    flex: 1,
  },
  discoverContent: {
    paddingHorizontal: rs(15),
    paddingTop: theme.space.xs,
    paddingBottom: rs(126),
  },
  loading: {
    marginTop: space.xxxl,
  },
  mealLoading: {
    paddingHorizontal: rs(18),
    alignSelf: 'center',
  },
}));

function ListGap() {
  return <View style={styles.listGap} />;
}

/** Horizontal scrollende Foto-Karten fuer eine Mahlzeitenkategorie. */
function MealSection({
  title,
  dishTypes,
  searchQuery,
}: {
  title: string;
  dishTypes: readonly string[];
  searchQuery: string;
}) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const {
    data: templates = [],
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useCatalogRecipes({ dishTypes, searchQuery });
  const entries = useMemo(() => templates.map(templateEntry), [templates]);
  const requestedMore = useRef(false);
  const previousEntries = useRef(entries);
  const contentWidth = Math.min(windowWidth, 800) - 30;
  const cardWidth = Math.max(260, contentWidth - 12);

  useEffect(() => {
    if (previousEntries.current === entries) return;
    previousEntries.current = entries;
    requestedMore.current = false;
  }, [entries]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!hasNextPage || isFetchingNextPage) return;
    if (isFetchNextPageError) requestedMore.current = false;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceToEnd = contentSize.width - (contentOffset.x + layoutMeasurement.width);
    const threshold = Math.max(120, cardWidth * 0.35);
    if (distanceToEnd <= threshold) {
      if (requestedMore.current) return;
      requestedMore.current = true;
      void fetchNextPage();
      return;
    }
    requestedMore.current = false;
  }

  if (isLoading) {
    return (
      <View style={styles.section}>
        <SectionHeading title={title} />
        <ActivityIndicator
          accessibilityLabel={`${title} Rezepte werden geladen`}
          color={colors.basil}
          style={styles.mealLoading}
        />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.section}>
        <SectionHeading title={title} />
        <Txt variant="body" tone="secondary">
          Rezepte konnten nicht geladen werden.
        </Txt>
      </View>
    );
  }

  if (entries.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeading title={title} />
      <ScrollView
        horizontal
        role="list"
        aria-label={`${title} Rezepte`}
        testID={`meal-section-${title}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mealScrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={100}>
        {entries.map((entry, index) => (
          <View
            key={entry.key}
            style={[
              styles.mealCardFrame,
              { width: cardWidth },
              index < entries.length - 1 ? styles.mealCardSpacing : undefined,
            ]}>
            <RecipePreviewCard
              title={entry.title}
              coverImagePath={entry.coverImagePath}
              coverSource={entry.kind === 'catalog' ? 'catalog' : 'household'}
              cookTimeMinutes={entry.cookTimeMinutes}
              difficultyLabel={entry.difficultyLabel}
              servings={entry.servings}
              paletteIndex={index + entry.title.length}
              onPress={() => openEntry(entry)}
            />
          </View>
        ))}
        {isFetchingNextPage ? (
          <ActivityIndicator
            accessibilityLabel={`${title}: weitere Rezepte werden geladen`}
            color={colors.basil}
            style={styles.mealLoading}
          />
        ) : isFetchNextPageError ? (
          <Txt variant="body" tone="secondary" style={styles.mealLoading}>
            Weitere Rezepte konnten nicht geladen werden.
          </Txt>
        ) : null}
      </ScrollView>
    </View>
  );
}

function EmptyPanel({ children }: { children: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.emptyPanel, { backgroundColor: colors.surface }]}>
      <Txt variant="body" weight="700" center>
        {children}
      </Txt>
    </View>
  );
}

export function RecipesScreen() {
  const { colors } = useTheme();
  const { openDrawer } = useNavigationChrome();
  const [view, setView] = useState<RecipeView>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RecipeFilters>(EMPTY_RECIPE_FILTERS);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string | null>(null);
  const [templateCalorieFilter, setTemplateCalorieFilter] = useState<number | null>(null);

  const { activeHouseholdId } = useActiveHousehold();
  const {
    data: recipes = [],
    isLoading: recipesLoading,
    isError: recipesError,
  } = useRecipes(activeHouseholdId ?? undefined);
  const {
    data: templates = [],
    isLoading: templatesLoading,
    isError: templatesError,
    fetchNextPage: fetchNextCatalogPage,
    hasNextPage: hasNextCatalogPage,
    isFetchingNextPage: isFetchingNextCatalogPage,
    isFetchNextPageError: isFetchNextCatalogPageError,
  } = useCatalogRecipes();
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
      .filter(
        (t) =>
          !tile ||
          tile.matches({
            ...t,
            kcalPerServing: null,
            proteinGPerServing: null,
            carbsGPerServing: null,
          }),
      )
      .map(templateEntry)
      .filter((entry) => !bucket || matchesTemplateCalorieBucket(entry, bucket));
  }, [searchedTemplates, templateEntries, templateCategoryFilter, templateCalorieFilter]);

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
  const isError = recipesError || templatesError;

  const listKeyExtractor = useCallback((entry: RecipeEntry) => entry.key, []);
  const renderListEntry = useCallback(
    ({ item, index }: { item: RecipeEntry; index: number }) => (
      <RecipePreviewCard
        title={item.title}
        coverImagePath={item.coverImagePath}
        coverSource={item.kind === 'catalog' ? 'catalog' : 'household'}
        cookTimeMinutes={item.cookTimeMinutes}
        difficultyLabel={item.difficultyLabel}
        servings={item.servings}
        paletteIndex={index + item.title.length}
        onPress={() => openEntry(item)}
      />
    ),
    [],
  );

  // Listen-Ansichten laufen virtualisiert; nur "Entdecken" bleibt ein ScrollView.
  const listView =
    isLoading || isError
      ? null
      : view === 'favorites'
        ? { entries: favoriteEntries, empty: 'Noch keine Favoriten gespeichert.' }
        : view === 'filtered'
          ? { entries: filteredEntries, empty: 'Keine Rezepte für diese Filter.' }
          : view === 'household'
            ? { entries: householdEntries, empty: 'Noch keine eigenen Rezepte.' }
            : view === 'templates'
              ? { entries: filteredTemplateEntries, empty: 'Keine Vorlagen für diesen Filter.' }
              : null;

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

  function loadMoreCatalogRecipes() {
    if (!hasNextCatalogPage || isFetchingNextCatalogPage) return;
    void fetchNextCatalogPage();
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

  const headerContent = (
    <>
      {/* Aufklappbare Textsuche für Rezepttitel */}
      {showSearch ? (
        <View style={[styles.searchRow, { backgroundColor: colors.surface }]}>
          <SearchIcon color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            role="searchbox"
            aria-label="Rezepte durchsuchen"
            placeholder="Rezepte durchsuchen…"
            placeholderTextColor={colors.textMuted}
            autoFocus
            style={[
              styles.searchInput,
              { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '500' },
            ]}
          />
        </View>
      ) : null}

      {/* Tab-Leiste (Entdecken vs. Eigene Rezepte vs. Meine Favoriten) */}
      {view === 'discover' || view === 'favorites' || view === 'household' ? (
        <View style={styles.tabRow}>
          <Press
            onPress={() => setView('discover')}
            role="button"
            aria-label="Entdecken"
            aria-selected={view === 'discover'}
            containerStyle={styles.tabContainer}
            style={[
              styles.tab,
              {
                backgroundColor: view === 'discover' ? colors.basil : colors.backgroundSoft,
                borderColor: view === 'discover' ? colors.basil : colors.border,
              },
            ]}>
            <Txt variant="body" tone={view === 'discover' ? 'onAccent' : 'secondary'} weight="700">
              Entdecken
            </Txt>
          </Press>
          <Press
            onPress={() => setView('household')}
            role="button"
            aria-label="Eigene Rezepte"
            aria-selected={view === 'household'}
            containerStyle={styles.tabContainer}
            style={[
              styles.tab,
              {
                backgroundColor: view === 'household' ? colors.basil : colors.backgroundSoft,
                borderColor: view === 'household' ? colors.basil : colors.border,
              },
            ]}>
            <Txt variant="body" tone={view === 'household' ? 'onAccent' : 'secondary'} weight="700">
              Eigene Rezepte
            </Txt>
          </Press>
          <Press
            onPress={() => setView('favorites')}
            role="button"
            aria-label="Meine Favoriten"
            aria-selected={view === 'favorites'}
            containerStyle={styles.tabContainer}
            style={[
              styles.tab,
              {
                backgroundColor: view === 'favorites' ? colors.basil : colors.backgroundSoft,
                borderColor: view === 'favorites' ? colors.basil : colors.border,
              },
            ]}>
            <Txt variant="body" tone={view === 'favorites' ? 'onAccent' : 'secondary'} weight="700">
              Meine Favoriten
            </Txt>
          </Press>
        </View>
      ) : null}
    </>
  );

  return (
    <HubScreen
      header={{
        title: screenTitle,
        align: 'center',
        leading:
          view === 'discover' || view === 'favorites' || view === 'household' ? (
            <MenuButton onPress={openDrawer} />
          ) : (
            <BackButton label="Zurück zu Rezepte" variant="header" onPress={goBackToDiscover} />
          ),
        trailing: (
          <View style={styles.headerActions}>
            <HeaderIconButton
              label="Rezepte durchsuchen"
              onPress={() => setShowSearch((visible) => !visible)}>
              <SearchIcon size={space.xl} color={colors.text} />
            </HeaderIconButton>
            <HeaderIconButton
              label={
                activeFilterCount > 0
                  ? `Rezepte filtern, ${activeFilterCount} aktiv`
                  : 'Rezepte filtern'
              }
              onPress={() => setShowFilters(true)}
              style={activeFilterCount > 0 ? { backgroundColor: colors.basil } : undefined}>
              <FilterIcon size={space.xl} color={activeFilterCount > 0 ? colors.bg : colors.text} />
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

      {listView ? (
        <FlashList
          data={listView.entries}
          keyExtractor={listKeyExtractor}
          renderItem={renderListEntry}
          ItemSeparatorComponent={ListGap}
          ListHeaderComponent={headerContent}
          ListEmptyComponent={<EmptyPanel>{listView.empty}</EmptyPanel>}
          ListFooterComponent={
            view !== 'household' && isFetchingNextCatalogPage ? (
              <ActivityIndicator
                accessibilityLabel="Weitere Katalogrezepte werden geladen"
                color={colors.basil}
                style={styles.mealLoading}
              />
            ) : view !== 'household' && isFetchNextCatalogPageError ? (
              <Txt variant="body" tone="secondary" style={styles.mealLoading}>
                Weitere Rezepte konnten nicht geladen werden.
              </Txt>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={view === 'household' ? undefined : loadMoreCatalogRecipes}
          onEndReachedThreshold={0.4}
        />
      ) : (
        <ScrollView
          style={styles.discoverScroll}
          contentContainerStyle={styles.discoverContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {headerContent}
          {isLoading ? (
            <ActivityIndicator
              accessibilityLabel="Rezepte werden geladen"
              color={colors.basil}
              style={{ marginTop: space.xxxl }}
            />
          ) : isError ? (
            <EmptyPanel>Rezepte konnten nicht geladen werden. Bitte Anmeldung prüfen.</EmptyPanel>
          ) : householdEntries.length > 0 || templates.length > 0 ? (
            /* Standard Entdecken-Ansicht mit Karussells und Mahlzeitenbereichen */
            <>
              {/* Karussell: Themenkategorien (z. B. Vegan, Schnell, High-Protein) */}
              <View style={styles.section}>
                <SectionHeading title="Kategorien" />
                <CategoryCarousel
                  selectedKey={templateCategoryFilter}
                  onSelect={selectCategoryTile}
                />
              </View>

              {/* Karussell: Kalorien-Buckets (<400 kcal, 400-600 kcal, etc.) */}
              <View style={styles.section}>
                <SectionHeading title="Rezepte nach Kalorien" />
                <CalorieCarousel
                  selectedIndex={templateCalorieFilter}
                  onSelect={selectCalorieTile}
                />
              </View>

              <View style={styles.section}>
                <SectionHeading title="Nach Mahlzeiten" titleVariant="heading" />
                {MEAL_SECTIONS.map((section) => (
                  <MealSection
                    key={section.key}
                    title={section.title}
                    dishTypes={section.dishTypes}
                    searchQuery={query}
                  />
                ))}
              </View>
            </>
          ) : (
            /* Leerzustand wenn keine Rezepte/Vorlagen vorhanden sind */
            <EmptyPanel>Noch keine Rezepte im Haushalt.</EmptyPanel>
          )}
        </ScrollView>
      )}
    </HubScreen>
  );
}
