import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';

import { useRecipeCoverUrl } from './recipe-cover';
import { type DishType, type RecipeListItem, useRecipes } from './use-recipes';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Schwer',
};

const CATEGORY_FILTERS: { value: DishType | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittag' },
  { value: 'dinner', label: 'Abend' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
];

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={8} stroke="#FF5262" strokeWidth={2} />
      <Path d="M21 21l-4.35-4.35" stroke="#FF5262" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"
        stroke="#FF5262"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="#FF5262"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HeartIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-6.7-4.35-9.3-8.1C1.1 10.5 1.5 7 4.4 5.5c2.2-1.15 4.6-.4 5.9 1.4l1.7 2.3 1.7-2.3c1.3-1.8 3.7-2.55 5.9-1.4 2.9 1.5 3.3 5 1.7 7.4C18.7 16.65 12 21 12 21z"
        stroke="#FF5262"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockIcon({ color = '#665555' }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Rein visuelles Herz-Icon ohne Persistenz — es gibt noch keine
 * Favoriten-Tabelle. Nur der Kreis, kein Toggle-Zustand, damit nichts
 * vorgaukelt wird, was nicht gespeichert wird.
 */
function FavoriteBadge() {
  return (
    <View style={styles.favoriteBadge}>
      <HeartIcon />
    </View>
  );
}

function openRecipe(id: string) {
  router.push({ pathname: '/recipe/detail', params: { id } });
}

function TrendingCard({ recipe }: { recipe: RecipeListItem }) {
  const { data: coverUrl } = useRecipeCoverUrl(recipe.cover_image_path);

  return (
    <TouchableOpacity
      style={styles.trendingCard}
      activeOpacity={0.9}
      onPress={() => openRecipe(recipe.id)}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}>
      <View style={styles.trendingMedia}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <FavoriteBadge />
      </View>
      <View style={styles.trendingBody}>
        <View style={styles.trendingBodyText}>
          <Text style={styles.trendingTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          {recipe.instructions ? (
            <Text style={styles.trendingSubtitle} numberOfLines={1}>
              {recipe.instructions}
            </Text>
          ) : null}
        </View>
        <View style={styles.trendingMeta}>
          {recipe.cook_time_minutes ? (
            <View style={styles.metaRow}>
              <ClockIcon />
              <Text style={styles.trendingMetaText}>{recipe.cook_time_minutes}min</Text>
            </View>
          ) : null}
          {recipe.difficulty ? (
            <Text style={styles.trendingMetaSub}>{DIFFICULTY_LABELS[recipe.difficulty]}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MiniRecipeCard({ recipe, onWhite }: { recipe: RecipeListItem; onWhite?: boolean }) {
  const { data: coverUrl } = useRecipeCoverUrl(recipe.cover_image_path);

  return (
    <TouchableOpacity
      style={styles.miniCard}
      activeOpacity={0.9}
      onPress={() => openRecipe(recipe.id)}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}>
      <View style={styles.miniMedia}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <FavoriteBadge />
      </View>
      <View style={[styles.miniBody, onWhite ? undefined : styles.miniBodyOnTint]}>
        <Text style={styles.miniTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
        <View style={styles.miniMetaRow}>
          {recipe.difficulty ? (
            <Text style={styles.miniMetaText}>{DIFFICULTY_LABELS[recipe.difficulty]}</Text>
          ) : null}
          {recipe.cook_time_minutes ? (
            <View style={styles.metaRow}>
              <ClockIcon />
              <Text style={styles.miniMetaText}>{recipe.cook_time_minutes}min</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ThumbCard({ recipe }: { recipe: RecipeListItem }) {
  const { data: coverUrl } = useRecipeCoverUrl(recipe.cover_image_path);

  return (
    <TouchableOpacity
      style={styles.thumbCard}
      activeOpacity={0.9}
      onPress={() => openRecipe(recipe.id)}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
    </TouchableOpacity>
  );
}

export function RecipesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<DishType | 'all'>('all');

  const { activeHouseholdId } = useActiveHousehold();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: recipes = [], isLoading } = useRecipes(activeHouseholdId ?? undefined);

  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return recipes.filter((recipe) => {
      const matchesCategory =
        selectedCategory === 'all' || recipe.dish_types.includes(selectedCategory);
      const matchesQuery = !query || recipe.title.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [recipes, searchQuery, selectedCategory]);

  const { trending, yourRecipes, topRecipes, recentlyAdded } = useMemo(() => {
    const trendingRecipe = filteredRecipes[0];
    const rest = filteredRecipes.slice(1);

    const mine = userId ? rest.filter((r) => r.created_by === userId) : [];
    const yours = (mine.length > 0 ? mine : rest).slice(0, 4);
    const yourIds = new Set(yours.map((r) => r.id));

    const remaining = rest.filter((r) => !yourIds.has(r.id));
    const top = remaining.slice(0, 4);

    const recent = [...rest]
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, 6);

    return { trending: trendingRecipe, yourRecipes: yours, topRecipes: top, recentlyAdded: recent };
  }, [filteredRecipes, userId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Rezepte</Text>
          <Text style={styles.headerSubtitle}>Was kochst du heute?</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/meal-planner')}
            accessibilityRole="button"
            accessibilityLabel="Wochenplan öffnen">
            <CalendarIcon />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/recipe/create')}
            accessibilityRole="button"
            accessibilityLabel="Rezept anlegen">
            <PencilIcon />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowSearch((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Rezepte durchsuchen">
            <SearchIcon />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {showSearch ? (
          <View style={styles.searchBarContainer}>
            <SearchIcon />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rezepte durchsuchen…"
              placeholderTextColor="#C4B0B2"
              autoFocus
            />
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}>
          {CATEGORY_FILTERS.map((cat) => {
            const isActive = cat.value === selectedCategory;
            return (
              <Pressable
                key={cat.value}
                style={[
                  styles.categoryPill,
                  isActive ? styles.categoryPillActive : styles.categoryPillInactive,
                ]}
                onPress={() => setSelectedCategory(cat.value)}>
                <Text
                  style={[
                    styles.categoryText,
                    isActive ? styles.categoryTextActive : styles.categoryTextInactive,
                  ]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color="#FF5262" />
        ) : filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {recipes.length === 0
                ? 'Noch keine Rezepte im Haushalt.'
                : 'Keine Rezepte für diesen Filter.'}
            </Text>
          </View>
        ) : (
          <>
            {trending ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Trending Recipe</Text>
                <TrendingCard recipe={trending} />
              </View>
            ) : null}

            {yourRecipes.length > 0 ? (
              <View style={styles.yourRecipesContainer}>
                <Text style={styles.yourRecipesLabel}>Deine Rezepte</Text>
                <View style={styles.miniGrid}>
                  {yourRecipes.map((recipe) => (
                    <MiniRecipeCard key={recipe.id} recipe={recipe} onWhite />
                  ))}
                </View>
              </View>
            ) : null}

            {topRecipes.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Top Rezepte</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbRow}>
                  {topRecipes.map((recipe) => (
                    <ThumbCard key={recipe.id} recipe={recipe} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {recentlyAdded.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Kürzlich hinzugefügt</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbRow}>
                  {recentlyAdded.map((recipe) => (
                    <ThumbCard key={recipe.id} recipe={recipe} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_RADIUS = 24;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF5262',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#332222',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE2E2',
    borderRadius: 22,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#332222',
  },
  categoriesScroll: {
    marginBottom: 20,
  },
  categoriesContent: {
    gap: 10,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryPillActive: {
    backgroundColor: '#FF5262',
  },
  categoryPillInactive: {
    backgroundColor: '#FFE2E2',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  categoryTextInactive: {
    color: '#FF5262',
  },
  loading: {
    marginTop: 40,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#665555',
    fontSize: 15,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF5262',
    marginBottom: 12,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Trending
  trendingCard: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  trendingMedia: {
    height: 200,
    backgroundColor: '#F3E8FF',
  },
  trendingBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  trendingBodyText: {
    flex: 1,
    gap: 2,
  },
  trendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#332222',
  },
  trendingSubtitle: {
    fontSize: 12,
    color: '#665555',
  },
  trendingMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  trendingMetaText: {
    fontSize: 13,
    color: '#665555',
  },
  trendingMetaSub: {
    fontSize: 12,
    color: '#FF5262',
    fontWeight: '600',
  },

  // "Deine Rezepte" — Pink container
  yourRecipesContainer: {
    backgroundColor: '#FF5262',
    borderRadius: 28,
    padding: 20,
    marginBottom: 24,
  },
  yourRecipesLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  miniCard: {
    width: '47%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  miniMedia: {
    height: 110,
    backgroundColor: '#F3E8FF',
  },
  miniBody: {
    padding: 10,
    gap: 4,
  },
  miniBodyOnTint: {
    backgroundColor: '#FFFFFF',
  },
  miniTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#332222',
  },
  miniMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniMetaText: {
    fontSize: 11,
    color: '#665555',
  },

  // Thumb-only rows (Top Rezepte / Kürzlich hinzugefügt)
  thumbRow: {
    gap: 12,
  },
  thumbCard: {
    width: 140,
    height: 110,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F3E8FF',
  },
});
