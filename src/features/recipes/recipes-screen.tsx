import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { FilterChipBar } from '@/components/filter-chip-bar';
import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { SectionHeading } from '@/components/section-heading';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton, MenuButton } from '@/components/ui/buttons';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useNavigationChrome } from '@/features/navigation/navigation-chrome-provider';
import {
  type RecipeTemplateListItem,
  useRecipeTemplates,
} from '@/features/recipe-templates/use-recipe-templates';
import { useTheme } from '@/hooks/use-theme';

import { RecipeHeroCard, RecipePreviewCard } from './components/recipe-preview-card';
import { type RecipeFavoriteKey, useRecipeFavorites } from './recipe-favorites';
import { type DishType, type RecipeListItem, useRecipes } from './use-recipes';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Anspruchsvoll',
};

const CATEGORY_FILTERS: { value: DishType | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittag' },
  { value: 'dinner', label: 'Abend' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
];

type RecipeView = 'discover' | 'favorites' | 'household';

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

function templateEntry(template: RecipeTemplateListItem): RecipeEntry {
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

function HeartIcon({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function RecipeGrid({ entries }: { entries: RecipeEntry[] }) {
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

function EmptyPanel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.emptyPanel, { backgroundColor: `${theme.backgroundElement}C7` }]}>
      <ThemedText style={styles.emptyTitle}>{children}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyCopy}>
        Über den Plus-Button kannst du jederzeit ein neues Rezept anlegen.
      </ThemedText>
    </View>
  );
}

function matchesEntry(entry: RecipeEntry, category: DishType | 'all', query: string) {
  const matchesCategory = category === 'all' || entry.dishTypes.includes(category);
  const matchesQuery = !query || entry.title.toLocaleLowerCase('de').includes(query);
  return matchesCategory && matchesQuery;
}

export function RecipesScreen() {
  const theme = useTheme();
  const { openDrawer } = useNavigationChrome();
  const [view, setView] = useState<RecipeView>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DishType | 'all'>('all');

  const { activeHouseholdId } = useActiveHousehold();
  const { data: recipes = [], isLoading: recipesLoading } = useRecipes(
    activeHouseholdId ?? undefined,
  );
  const { data: templates = [], isLoading: templatesLoading } = useRecipeTemplates();
  const { favorites } = useRecipeFavorites();

  const { householdEntries, templateEntries } = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('de');
    return {
      householdEntries: recipes
        .map(recipeEntry)
        .filter((entry) => matchesEntry(entry, selectedCategory, query)),
      templateEntries: templates
        .map(templateEntry)
        .filter((entry) => matchesEntry(entry, selectedCategory, query)),
    };
  }, [recipes, searchQuery, selectedCategory, templates]);

  const featured = templateEntries[0] ?? householdEntries[0];
  const favoriteEntries = [...householdEntries, ...templateEntries].filter((entry) =>
    favorites.has(favoriteKey(entry)),
  );
  const topEntries = (
    templateEntries.length > 0 ? templateEntries.slice(1) : householdEntries.slice(1)
  ).slice(0, 4);
  const newEntries = [...templateEntries]
    .reverse()
    .filter((entry) => entry.key !== featured?.key)
    .slice(0, 4);
  const isLoading = recipesLoading || templatesLoading;
  const screenTitle =
    view === 'favorites' ? 'Meine Favoriten' : view === 'household' ? 'Unsere Rezepte' : 'Rezepte';

  return (
    <View style={styles.root}>
      <GradientBackground colors={['#FFD2B9', '#F8F4EF', '#EEE7F4']} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title={screenTitle}
          leading={
            view === 'discover' ? (
              <MenuButton onPress={openDrawer} />
            ) : (
              <HeaderIconButton label="Zurück zu Rezepte" onPress={() => setView('discover')}>
                <BackIcon color={theme.text} />
              </HeaderIconButton>
            )
          }
          trailing={
            <>
              {view === 'discover' ? (
                <HeaderIconButton
                  label="Meine Favoriten öffnen"
                  onPress={() => setView('favorites')}>
                  <HeartIcon color={theme.accent} />
                </HeaderIconButton>
              ) : null}
              <HeaderIconButton
                label="Rezepte durchsuchen"
                onPress={() => setShowSearch((visible) => !visible)}>
                <SearchIcon color={theme.text} />
              </HeaderIconButton>
            </>
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

          <View style={styles.filters}>
            <FilterChipBar
              label="Rezeptkategorie"
              options={CATEGORY_FILTERS}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator
              accessibilityLabel="Rezepte werden geladen"
              color={theme.accent}
              style={styles.loading}
            />
          ) : view === 'favorites' ? (
            favoriteEntries.length > 0 ? (
              <RecipeGrid entries={favoriteEntries} />
            ) : (
              <EmptyPanel>Noch keine Favoriten gespeichert.</EmptyPanel>
            )
          ) : view === 'household' ? (
            householdEntries.length > 0 ? (
              <RecipeGrid entries={householdEntries} />
            ) : (
              <EmptyPanel>Keine Rezepte für diesen Filter.</EmptyPanel>
            )
          ) : featured || householdEntries.length > 0 || templateEntries.length > 0 ? (
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
                  <RecipeGrid entries={householdEntries.slice(0, 4)} />
                ) : (
                  <EmptyPanel>Noch keine Rezepte im Haushalt.</EmptyPanel>
                )}
              </View>

              {topEntries.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeading title="Top Rezepte" />
                  <RecipeGrid entries={topEntries} />
                </View>
              ) : null}

              {newEntries.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeading title="Neu von fam" />
                  <RecipeGrid entries={newEntries} />
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
  filters: {
    marginBottom: 16,
  },
  searchBar: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 14,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyPanel: {
    minHeight: 124,
    borderRadius: 20,
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
