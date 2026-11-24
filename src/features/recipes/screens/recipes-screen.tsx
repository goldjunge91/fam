import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { rs, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { MenuButton } from '@/components/ui/menu-button';
import { inputTextStyles, Press, SectionHeading, SegmentedControl, Txt } from '@/constants/ui';
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
import { type Difficulty, getDifficultyLabel } from '../wizard/recipe-metadata-options';

/** Reihenfolge der "Nach Mahlzeiten"-Carousels — Snack und Dessert teilen sich eine Reihe. */
const MEAL_SECTIONS: {
  key: string;
  titleKey:
    | 'recipes.mealSections.breakfast'
    | 'recipes.mealSections.lunch'
    | 'recipes.mealSections.dinner'
    | 'recipes.mealSections.snackDessert';
  dishTypes: DishType[];
}[] = [
  { key: 'breakfast', titleKey: 'recipes.mealSections.breakfast', dishTypes: ['breakfast'] },
  { key: 'lunch', titleKey: 'recipes.mealSections.lunch', dishTypes: ['lunch'] },
  { key: 'dinner', titleKey: 'recipes.mealSections.dinner', dishTypes: ['dinner'] },
  {
    key: 'snackDessert',
    titleKey: 'recipes.mealSections.snackDessert',
    dishTypes: ['snack', 'dessert'],
  },
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

function recipeDifficultyLabel(t: TFunction, value: Difficulty | string | null): string | null {
  switch (value) {
    case 'easy':
    case 'medium':
    case 'hard':
      return getDifficultyLabel(t, value);
    default:
      return value ?? null;
  }
}

function recipeEntry(recipe: RecipeListItem, t: TFunction): RecipeEntry {
  return {
    key: `recipe-${recipe.id}`,
    id: recipe.id,
    kind: 'recipe',
    title: recipe.title,
    coverImagePath: recipe.cover_image_path,
    cookTimeMinutes: recipe.cook_time_minutes,
    difficultyLabel: recipeDifficultyLabel(t, recipe.difficulty),
    servings: recipe.default_servings,
    dishTypes: recipe.dish_types,
    dietaryTags: recipe.dietary_tags,
    hashtags: recipe.hashtags,
    kcalPerServing: recipe.kcalPerServing ?? null,
    proteinGPerServing: recipe.proteinGPerServing ?? null,
    carbsGPerServing: recipe.carbsGPerServing ?? null,
  };
}

function templateEntry(template: CatalogRecipe, t: TFunction): RecipeEntry {
  return {
    key: `template-${template.id}`,
    id: template.id,
    kind: 'catalog',
    slug: template.slug,
    title: template.title,
    coverImagePath: template.cover_image_path,
    cookTimeMinutes: template.cook_time_minutes,
    difficultyLabel: recipeDifficultyLabel(t, template.difficulty),
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
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: rs(126),
  },
  listGap: {
    height: theme.space.md,
  },
  section: {
    marginBottom: theme.space.xxl,
  },
  mealScrollContent: {
    paddingHorizontal: theme.space.md,
  },
  mealCardFrame: {
    flexShrink: 0,
  },
  mealCardSpacing: {
    marginRight: theme.space.md,
  },
  emptyPanel: {
    minHeight: rs(124),
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxxl,
    paddingVertical: theme.space.xl,
  },
  searchRow: {
    height: rs(42),
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    borderRadius: theme.radius.famLarge,
    paddingHorizontal: theme.space.md,
    marginBottom: theme.space.md,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  tabRow: {
    marginBottom: theme.space.xl,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  aiActions: {
    flexDirection: 'row',
    gap: theme.space.md,
    marginBottom: theme.space.lg,
  },
  aiAction: {
    minHeight: rs(48),
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.backgroundElement,
  },
  discoverScroll: {
    flex: 1,
  },
  discoverContent: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.xs,
    paddingBottom: rs(126),
  },
  loading: {
    marginTop: space.xxxl,
  },
  mealLoading: {
    paddingHorizontal: theme.space.xl,
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
  const { t } = useTranslation();
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
  const entries = useMemo(
    () => templates.map((template) => templateEntry(template, t)),
    [t, templates],
  );
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
        <SectionHeading title={title} titleVariant="body" />
        <ActivityIndicator
          accessibilityLabel={t('recipes.list.mealLoading', { title })}
          color={colors.accent}
          style={styles.mealLoading}
        />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.section}>
        <SectionHeading title={title} titleVariant="body" />
        <Txt variant="body" tone="secondary">
          {t('recipes.list.mealError')}
        </Txt>
      </View>
    );
  }

  if (entries.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeading title={title} titleVariant="body" />
      <ScrollView
        horizontal
        accessibilityRole="list"
        accessibilityLabel={t('recipes.list.mealList', { title })}
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
              onPress={() => openEntry(entry)}
            />
          </View>
        ))}
        {isFetchingNextPage ? (
          <ActivityIndicator
            accessibilityLabel={t('recipes.list.moreMealLoading', { title })}
            color={colors.accent}
            style={styles.mealLoading}
          />
        ) : isFetchNextPageError ? (
          <Txt variant="body" tone="secondary" style={styles.mealLoading}>
            {t('recipes.list.moreError')}
          </Txt>
        ) : null}
      </ScrollView>
    </View>
  );
}

function EmptyPanel({ children }: { children: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.emptyPanel, { backgroundColor: colors.backgroundElement }]}>
      <Txt variant="body" weight="700" center>
        {children}
      </Txt>
    </View>
  );
}

export function RecipesScreen() {
  const { t } = useTranslation();
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
        .map((recipe) => recipeEntry(recipe, t))
        .filter((entry) => !query || entry.title.toLocaleLowerCase('de').includes(query)),
    [recipes, query, t],
  );

  const searchedTemplates = useMemo(
    () => templates.filter((t) => !query || t.title.toLocaleLowerCase('de').includes(query)),
    [templates, query],
  );
  const templateEntries = useMemo(
    () => searchedTemplates.map((template) => templateEntry(template, t)),
    [searchedTemplates, t],
  );

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
      .map((template) => templateEntry(template, t))
      .filter((entry) => !bucket || matchesTemplateCalorieBucket(entry, bucket));
  }, [searchedTemplates, templateEntries, templateCategoryFilter, templateCalorieFilter, t]);

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
    ({ item }: { item: RecipeEntry }) => (
      <RecipePreviewCard
        title={item.title}
        coverImagePath={item.coverImagePath}
        coverSource={item.kind === 'catalog' ? 'catalog' : 'household'}
        cookTimeMinutes={item.cookTimeMinutes}
        difficultyLabel={item.difficultyLabel}
        servings={item.servings}
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
        ? { entries: favoriteEntries, empty: t('recipes.list.emptyFavorites') }
        : view === 'filtered'
          ? { entries: filteredEntries, empty: t('recipes.list.emptyFiltered') }
          : view === 'household'
            ? { entries: householdEntries, empty: t('recipes.list.emptyHouseholdView') }
            : view === 'templates'
              ? { entries: filteredTemplateEntries, empty: t('recipes.list.emptyTemplates') }
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
      ? t('recipes.list.favoritesTitle')
      : view === 'filtered'
        ? t('recipes.list.filteredTitle')
        : view === 'household'
          ? t('recipes.list.householdTitle')
          : view === 'templates'
            ? activeCategoryTile
              ? t(activeCategoryTile.labelKey)
              : (activeCalorieBucket?.label ?? t('recipes.list.templatesTitle'))
            : t('recipes.list.title');

  const headerContent = (
    <>
      {view === 'discover' || view === 'household' ? (
        <View style={styles.aiActions}>
          <Press
            accessibilityRole="button"
            onPress={() => router.push('/assistant')}
            style={styles.aiAction}>
            <Txt variant="body" weight="700">
              {t('recipes.list.assistant')}
            </Txt>
          </Press>
          <Press
            accessibilityRole="button"
            onPress={() => router.push('/recipe/import')}
            style={styles.aiAction}>
            <Txt variant="body" weight="700">
              {t('recipes.list.import')}
            </Txt>
          </Press>
        </View>
      ) : null}
      {/* Aufklappbare Textsuche für Rezepttitel */}
      {showSearch ? (
        <View style={[styles.searchRow, { backgroundColor: colors.backgroundElement }]}>
          <SearchIcon color={colors.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityRole="search"
            accessibilityLabel={t('recipes.list.searchLabel')}
            placeholder={t('recipes.list.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoFocus
            style={[styles.searchInput, inputTextStyles.recipeSearch, { color: colors.text }]}
          />
        </View>
      ) : null}

      {/* Tab-Leiste (Entdecken vs. Eigene Rezepte vs. Meine Favoriten) */}
      {view === 'discover' || view === 'favorites' || view === 'household' ? (
        <View style={styles.tabRow}>
          <SegmentedControl
            label={t('recipes.list.viewLabel')}
            selectionRole="tab"
            options={[
              { value: 'discover', label: t('recipes.list.discover') },
              { value: 'household', label: t('recipes.list.household') },
              { value: 'favorites', label: t('recipes.list.favorites') },
            ]}
            selected={view}
            onSelect={setView}
          />
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
            <BackButton
              label={t('recipes.list.backTo', { label: t('recipes.list.title') })}
              variant="header"
              onPress={goBackToDiscover}
            />
          ),
        trailing: (
          <View style={styles.headerActions}>
            <HeaderIconButton
              label={t('recipes.list.searchLabel')}
              onPress={() => setShowSearch((visible) => !visible)}>
              <SearchIcon size={space.xl} color={colors.text} />
            </HeaderIconButton>
            <HeaderIconButton
              label={
                activeFilterCount > 0
                  ? t('recipes.list.filterActive', { count: activeFilterCount })
                  : t('recipes.list.filterLabel')
              }
              onPress={() => setShowFilters(true)}
              style={activeFilterCount > 0 ? { backgroundColor: colors.accent } : undefined}>
              <FilterIcon
                size={space.xl}
                color={activeFilterCount > 0 ? colors.background : colors.text}
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
                accessibilityLabel={t('recipes.list.moreCatalogLoading')}
                color={colors.accent}
                style={styles.mealLoading}
              />
            ) : view !== 'household' && isFetchNextCatalogPageError ? (
              <Txt variant="body" tone="secondary" style={styles.mealLoading}>
                {t('recipes.list.moreError')}
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
              accessibilityLabel={t('recipes.list.loading')}
              color={colors.accent}
              style={{ marginTop: space.xxxl }}
            />
          ) : isError ? (
            <EmptyPanel>{t('recipes.list.error')}</EmptyPanel>
          ) : householdEntries.length > 0 || templates.length > 0 ? (
            /* Standard Entdecken-Ansicht mit Karussells und Mahlzeitenbereichen */
            <>
              {/* Karussell: Themenkategorien (z. B. Vegan, Schnell, High-Protein) */}
              <View style={styles.section}>
                <SectionHeading title={t('recipes.list.categoriesHeading')} titleVariant="body" />
                <CategoryCarousel
                  selectedKey={templateCategoryFilter}
                  onSelect={selectCategoryTile}
                />
              </View>

              {/* Karussell: Kalorien-Buckets (<400 kcal, 400-600 kcal, etc.) */}
              <View style={styles.section}>
                <SectionHeading title={t('recipes.list.caloriesHeading')} titleVariant="body" />
                <CalorieCarousel
                  selectedIndex={templateCalorieFilter}
                  onSelect={selectCalorieTile}
                />
              </View>

              <View style={styles.section}>
                <SectionHeading title={t('recipes.list.mealsHeading')} titleVariant="heading" />
                {MEAL_SECTIONS.map((section) => (
                  <MealSection
                    key={section.key}
                    title={t(section.titleKey)}
                    dishTypes={section.dishTypes}
                    searchQuery={query}
                  />
                ))}
              </View>
            </>
          ) : (
            /* Leerzustand wenn keine Rezepte/Vorlagen vorhanden sind */
            <EmptyPanel>{t('recipes.list.emptyHousehold')}</EmptyPanel>
          )}
        </ScrollView>
      )}
    </HubScreen>
  );
}
