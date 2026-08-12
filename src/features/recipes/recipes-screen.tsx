import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
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

import { useActiveHousehold } from '@/features/household/active-household-provider';

import { calculateServingNutrition } from './nutrition';
import { useRecipeCoverUrl } from './recipe-cover';
import { type DishType, type RecipeListItem, useRecipeDetail, useRecipes } from './use-recipes';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Schwer',
};

const DISH_TYPE_LABELS: Record<DishType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snack',
  dessert: 'Dessert',
  appetizer: 'Vorspeise',
  brunch: 'Brunch',
};

const CATEGORY_FILTERS: { value: DishType | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittag' },
  { value: 'dinner', label: 'Abend' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
];

function round(n: number): number {
  return Math.round(n);
}

function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const { data: coverUrl } = useRecipeCoverUrl(recipe.cover_image_path);
  const { data: detail } = useRecipeDetail(recipe.id);

  const kcal = useMemo(() => {
    if (!detail) return null;
    const serving = calculateServingNutrition(detail.components, detail.items, detail.productsById);
    return serving.grams > 0 ? round(serving.kcal) : null;
  }, [detail]);

  return (
    <TouchableOpacity
      style={styles.recipeCard}
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: '/recipe/detail', params: { id: recipe.id } })}>
      <View style={styles.cardMedia}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.playIconCircle}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M8 5v14l11-7z" fill="#FFFFFF" />
            </Svg>
          </View>
        )}

        <View style={styles.cardMediaBanner}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          {kcal !== null ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{kcal} kcal</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.authorTimeRow}>
          {recipe.difficulty ? (
            <View style={styles.pillSmall}>
              <Text style={styles.pillSmallText}>{DIFFICULTY_LABELS[recipe.difficulty]}</Text>
            </View>
          ) : null}
          {recipe.cook_time_minutes ? (
            <Text style={styles.timeText}>⏱ {recipe.cook_time_minutes}min</Text>
          ) : null}
        </View>

        {recipe.dish_types.length > 0 || recipe.dietary_tags.length > 0 ? (
          <View style={styles.tagRow}>
            {[...recipe.dish_types, ...recipe.dietary_tags].map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagPillText}>{DISH_TYPE_LABELS[tag as DishType] ?? tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {recipe.hashtags.length > 0 ? (
          <View style={styles.tagRow}>
            {recipe.hashtags.map((tag) => (
              <Text key={tag} style={styles.hashtagText}>
                #{tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function RecipesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DishType | 'all'>('all');

  const { activeHouseholdId } = useActiveHousehold();
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rezepte</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/recipe/create')}
          accessibilityRole="button"
          accessibilityLabel="Create recipe">
          <Text style={styles.createText}>+ Anlegen</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.searchBarContainer}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={8} stroke="#FF5262" strokeWidth={2} />
            <Path d="M21 21l-4.35-4.35" stroke="#FF5262" strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rezepte durchsuchen…"
            placeholderTextColor="#C4B0B2"
          />
        </View>

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

        {!isLoading && filteredRecipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {recipes.length === 0
                ? 'Noch keine Rezepte im Haushalt.'
                : 'Keine Rezepte für diesen Filter.'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {filteredRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FF5262',
  },
  createButton: {
    backgroundColor: '#FF5262',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#665555',
    fontSize: 15,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 20,
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardMedia: {
    height: 180,
    backgroundColor: '#9B51E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  playIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF5262',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMediaBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 82, 98, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardBody: {
    padding: 16,
    gap: 8,
  },
  authorTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pillSmall: {
    backgroundColor: '#FFE2E2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillSmallText: {
    color: '#FF5262',
    fontSize: 12,
    fontWeight: '600',
  },
  timeText: {
    color: '#665555',
    fontSize: 13,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tagPillText: {
    color: '#9B51E0',
    fontSize: 12,
    fontWeight: '600',
  },
  hashtagText: {
    color: '#FF5262',
    fontSize: 12,
    fontWeight: '500',
  },
});
