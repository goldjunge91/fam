import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { SectionHeading } from '@/components/section-heading';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton, MenuButton } from '@/components/ui/buttons';
import { Radius } from '@/constants/theme';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import {
  CALORIE_BUCKETS,
  isInCalorieBucket,
  type RecipeTemplateWithNutrition,
  useRecipeTemplatesWithNutrition,
} from '@/features/recipe-templates/use-recipe-templates';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { CalorieCarousel } from './components/calorie-carousel';
import { CATEGORY_TILES, CategoryCarousel } from './components/category-carousel';
import { RecipeHeroCard, RecipePreviewCard } from './components/recipe-preview-card';
import { type RecipeFavoriteKey, useRecipeFavorites } from './recipe-favorites';
import { type DishType, type RecipeListItem, useRecipes } from './use-recipes';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Anspruchsvoll',
};

/** Reihenfolge der "Nach Mahlzeiten"-Carousels — Snack und Dessert teilen sich eine Reihe. */
const MEAL_SECTIONS: { key: string; title: string; dishTypes: DishType[] }[] = [
  { key: 'breakfast', title: 'Frühstück', dishTypes: ['breakfast'] },
  { key: 'lunch', title: 'Mittagessen', dishTypes: ['lunch'] },
  { key: 'dinner', title: 'Abendessen', dishTypes: ['dinner'] },
  { key: 'snackDessert', title: 'Snacks & Dessert', dishTypes: ['snack', 'dessert'] },
];

type RecipeView = 'discover' | 'favorites' | 'household' | 'templates';

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
  };
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

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={2} />
      <Path d="m15.5 15.5 5 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function BackIcon({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="m15 18-6-6 6-6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RecipeList({ entries }: { entries: RecipeEntry[] }) {
  return (
    <View style={styles.grid}>
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
    <View style={styles.section}>
      <SectionHeading title={title} />
      <ScrollView
        horizontal
        role="list"
        aria-label={`${title} Rezepte`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mealCarouselContent}>
        {entries.map((entry, index) => (
          <View key={entry.key} style={styles.mealCarouselCard}>
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
  const theme = useTheme();
  return (
    <View style={[styles.emptyPanel, { backgroundColor: `${theme.backgroundElement}C7` }]}>
      <ThemedText style={styles.emptyTitle}>{children}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.emptyCopy}>
        Über den Plus-Button kannst du jederzeit ein neues Rezept anlegen.
      </ThemedText>
    </View>
  );
}

export function RecipesScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
  const { openDrawer } = useNavigationChrome();
  const [view, setView] = useState<RecipeView>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
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

  const featured = templateEntries[0] ?? householdEntries[0];
  const favoriteEntries = [...householdEntries, ...templateEntries].filter((entry) =>
    favorites.has(favoriteKey(entry)),
  );
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
    setView('discover');
  }

  const activeCategoryTile = templateCategoryFilter
    ? CATEGORY_TILES.find((t) => t.key === templateCategoryFilter)
    : null;
  const activeCalorieBucket =
    templateCalorieFilter !== null ? CALORIE_BUCKETS[templateCalorieFilter] : null;
  const screenTitle =
    view === 'favorites'
      ? 'Meine Favoriten'
      : view === 'household'
        ? 'Unsere Rezepte'
        : view === 'templates'
          ? (activeCategoryTile?.label ?? activeCalorieBucket?.label ?? 'Vorlagen')
          : 'Rezepte';

  return (
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title={screenTitle}
          leading={
            view === 'discover' || view === 'favorites' ? (
              <MenuButton onPress={openDrawer} />
            ) : (
              <HeaderIconButton label="Zurück zu Rezepte" onPress={goBackToDiscover}>
                <BackIcon color={theme.text} />
              </HeaderIconButton>
            )
          }
          trailing={
            <HeaderIconButton
              label="Rezepte durchsuchen"
              onPress={() => setShowSearch((visible) => !visible)}>
              <SearchIcon color={theme.text} />
            </HeaderIconButton>
          }
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {showSearch ? (
            <View style={[styles.searchBar, { backgroundColor: `${theme.backgroundElement}D9` }]}>
              <SearchIcon color={theme.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                role="searchbox"
                aria-label="Rezepte durchsuchen"
                placeholder="Rezepte durchsuchen…"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>
          ) : null}

          {view === 'discover' || view === 'favorites' ? (
            <View style={styles.modeToggle}>
              <Pressable
                onPress={() => setView('discover')}
                role="button"
                aria-label="Entdecken"
                aria-selected={view === 'discover'}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor:
                      view === 'discover' ? theme.text : `${theme.backgroundElement}D9`,
                    borderColor: view === 'discover' ? theme.text : theme.border,
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.modeButtonLabel,
                    { color: view === 'discover' ? theme.background : theme.textSecondary },
                  ]}>
                  Entdecken
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setView('favorites')}
                role="button"
                aria-label="Meine Favoriten"
                aria-selected={view === 'favorites'}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor:
                      view === 'favorites' ? theme.text : `${theme.backgroundElement}D9`,
                    borderColor: view === 'favorites' ? theme.text : theme.border,
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.modeButtonLabel,
                    { color: view === 'favorites' ? theme.background : theme.textSecondary },
                  ]}>
                  Meine Favoriten
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {isLoading ? (
            <ActivityIndicator
              accessibilityLabel="Rezepte werden geladen"
              color={theme.accent}
              style={styles.loading}
            />
          ) : view === 'favorites' ? (
            favoriteEntries.length > 0 ? (
              <RecipeList entries={favoriteEntries} />
            ) : (
              <EmptyPanel>Noch keine Favoriten gespeichert.</EmptyPanel>
            )
          ) : view === 'household' ? (
            householdEntries.length > 0 ? (
              <RecipeList entries={householdEntries} />
            ) : (
              <EmptyPanel>Keine Rezepte für diesen Filter.</EmptyPanel>
            )
          ) : view === 'templates' ? (
            filteredTemplateEntries.length > 0 ? (
              <RecipeList entries={filteredTemplateEntries} />
            ) : (
              <EmptyPanel>Keine Vorlagen für diesen Filter.</EmptyPanel>
            )
          ) : featured || householdEntries.length > 0 || templates.length > 0 ? (
            <>
              {featured ? (
                <View style={styles.section}>
                  <SectionHeading title="Trending" eyebrow="Community" />
                  <RecipeHeroCard
                    title={featured.title}
                    coverImagePath={featured.coverImagePath}
                    cookTimeMinutes={featured.cookTimeMinutes}
                    difficultyLabel={featured.difficultyLabel}
                    servings={featured.servings}
                    onPress={() => openEntry(featured)}
                  />
                </View>
              ) : null}

              <View style={styles.section}>
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

              <View style={styles.section}>
                <SectionHeading title="Kategorien" />
                <CategoryCarousel
                  selectedKey={templateCategoryFilter}
                  onSelect={selectCategoryTile}
                />
              </View>

              <View style={styles.section}>
                <SectionHeading title="Rezepte nach Kalorien" />
                <CalorieCarousel
                  selectedIndex={templateCalorieFilter}
                  onSelect={selectCalorieTile}
                />
              </View>

              {mealSections.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeading
                    title="Nach Mahlzeiten"
                    actionLabel="Alle Vorlagen ansehen"
                    onActionPress={openTemplates}
                  />
                  {mealSections.map((section) => (
                    <MealSection
                      key={section.key}
                      title={section.title}
                      entries={section.entries}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <EmptyPanel>Noch keine Rezepte im Haushalt.</EmptyPanel>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 15,
    paddingTop: 4,
    paddingBottom: 126,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  modeButton: {
    flex: 1,
    height: 40,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonLabel: {
    ...FontSize[13],
    fontWeight: 700,
  },
  searchBar: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: Radius.controlLarge,
    borderCurve: 'continuous',
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    ...FontSize[14],
    fontWeight: 500,
    paddingVertical: 0,
  },
  loading: {
    marginTop: 42,
  },
  section: {
    marginBottom: 20,
  },
  grid: {
    gap: 10,
  },
  mealCarouselContent: {
    gap: 10,
  },
  mealCarouselCard: {
    width: 260,
  },
  emptyPanel: {
    minHeight: 124,
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 22,
  },
  emptyTitle: {
    ...FontSize[14],
    lineHeight: 18,
    fontWeight: 700,
    textAlign: 'center',
  },
  emptyCopy: {
    ...FontSize[11],
    lineHeight: 15,
    fontWeight: 500,
    textAlign: 'center',
    marginTop: 5,
  },
});
