import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { calculateComponentPer100g, calculateServingNutrition, scaleServing } from './nutrition';
import { useRecipeCoverUrl } from './recipe-cover';
import { useRecipeStepImageUrl } from './recipe-step-image';
import {
  type DishType,
  type RecipeDetail,
  type RecipeStep,
  useDeleteRecipeMutation,
  useRecipeDetail,
} from './use-recipes';

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

const DIETARY_TAG_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarisch',
  high_fat: 'Fettreich',
  low_fat: 'Fettarm',
  lactose_free: 'Laktosefrei',
  sugar_free: 'Zuckerfrei',
  gluten_free: 'Glutenfrei',
};

function round(n: number): number {
  return Math.round(n);
}

/** Zutaten-Chip-Label "Produktname (Komponentenname)" fuer eine referenzierte recipe_component_items-Zeile. */
function ingredientLabel(itemId: string, data: RecipeDetail): string {
  const item = data.items.find((i) => i.id === itemId);
  if (!item) return itemId;
  const product = item.product_id ? data.productsById.get(item.product_id) : undefined;
  const component = data.components.find((c) => c.id === item.component_id);
  return `${product?.name ?? '?'}${component ? ` (${component.name})` : ''}`;
}

function StepCard({ step, data }: { step: RecipeStep; data: RecipeDetail }) {
  const { data: imageUrl } = useRecipeStepImageUrl(step.image_path);

  return (
    <View style={styles.stepCard}>
      <View style={styles.bulletRow}>
        <Text style={styles.stepIndex}>{String(step.position + 1).padStart(2, '0')}</Text>
        <Text style={styles.ingredientText}>{step.text}</Text>
      </View>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.stepImage} contentFit="cover" />
      ) : null}
      {step.ingredientIds.length > 0 ? (
        <View style={styles.stepChipRow}>
          {step.ingredientIds.map((id) => (
            <Text key={id} style={styles.stepChip}>
              {ingredientLabel(id, data)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [servings, setServings] = useState(1);

  const { data, isLoading } = useRecipeDetail(id);
  const { data: coverUrl } = useRecipeCoverUrl(data?.recipe.cover_image_path);
  const deleteMutation = useDeleteRecipeMutation();

  const handleDelete = () => {
    if (!data) return;
    const { recipe } = data;
    Alert.alert('Rezept löschen', `„${recipe.title}“ wird dauerhaft entfernt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => {
          deleteMutation.mutate(
            { id: recipe.id, household_id: recipe.household_id },
            {
              onSuccess: () => router.back(),
              onError: (error) => {
                Alert.alert(
                  'Fehler',
                  error instanceof Error ? error.message : 'Rezept konnte nicht gelöscht werden.',
                );
              },
            },
          );
        },
      },
    ]);
  };

  const topLevelComponents = useMemo(
    () => (data ? data.components.filter((c) => c.serving_grams !== null) : []),
    [data],
  );

  const baseServing = useMemo(() => {
    if (!data) return null;
    return calculateServingNutrition(data.components, data.items, data.productsById);
  }, [data]);

  const scaledServing =
    baseServing && baseServing.grams > 0 ? scaleServing(baseServing, servings) : null;

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 18l-6-6 6-6"
                stroke="#FF5262"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        </View>
        <Text style={styles.loadingText}>Lädt…</Text>
      </SafeAreaView>
    );
  }

  const { recipe } = data;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke="#FF5262"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipe.title}
        </Text>

        <View style={styles.headerRightActions}>
          <Pressable
            style={styles.editButton}
            onPress={() => router.push({ pathname: '/recipe/create', params: { id: recipe.id } })}
            accessibilityRole="button"
            accessibilityLabel="Edit recipe">
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Delete recipe">
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 7h16M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m2 0v13a2 2 0 01-2 2H9a2 2 0 01-2-2V7h10z"
                stroke="#FF5262"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.imageBackground}>
            {coverUrl ? (
              <Image
                source={{ uri: coverUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={styles.playCircle}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 5v14l11-7z" fill="#FFFFFF" />
                </Svg>
              </View>
            )}
          </View>

          <View style={styles.heroBanner}>
            <Text style={styles.recipeTitleText} numberOfLines={1}>
              {recipe.title}
            </Text>
            {scaledServing ? (
              <View style={styles.statItem}>
                <Text style={styles.statText}>{round(scaledServing.kcal)} kcal</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Badges: Schwierigkeit, Kochzeit, Rezepttyp, Ernaehrung */}
        <View style={styles.badgeRow}>
          {recipe.difficulty ? (
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{DIFFICULTY_LABELS[recipe.difficulty]}</Text>
            </View>
          ) : null}
          {recipe.cook_time_minutes ? (
            <View style={styles.timeBadge}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={9} stroke="#332222" strokeWidth={2} />
                <Path d="M12 7v5l3 3" stroke="#332222" strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={styles.timeText}>{recipe.cook_time_minutes}min</Text>
            </View>
          ) : null}
          {[...recipe.dish_types, ...recipe.dietary_tags].map((tag) => (
            <View key={tag} style={styles.badgePillAlt}>
              <Text style={styles.badgePillAltText}>
                {DISH_TYPE_LABELS[tag as DishType] ?? DIETARY_TAG_LABELS[tag] ?? tag}
              </Text>
            </View>
          ))}
        </View>

        {recipe.hashtags.length > 0 ? (
          <View style={styles.hashtagRow}>
            {recipe.hashtags.map((tag) => (
              <Text key={tag} style={styles.hashtagText}>
                #{tag}
              </Text>
            ))}
          </View>
        ) : null}

        {recipe.instructions ? (
          <View style={styles.section}>
            <Text style={styles.descriptionText}>{recipe.instructions}</Text>
          </View>
        ) : null}

        {scaledServing ? (
          <View style={styles.section}>
            <View style={styles.detailsHeaderRow}>
              <Text style={styles.sectionTitle}>Nährwerte</Text>
              <View style={styles.servingsStepper}>
                <Pressable
                  onPress={() => setServings((s) => Math.max(1, s - 1))}
                  accessibilityRole="button"
                  accessibilityLabel="Weniger Portionen">
                  <Text style={styles.stepperSign}>−</Text>
                </Pressable>
                <Text style={styles.servingsValue}>{servings} Portion(en)</Text>
                <Pressable
                  onPress={() => setServings((s) => s + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Mehr Portionen">
                  <Text style={styles.stepperSign}>+</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.descriptionText}>
              {round(scaledServing.protein_g)} g Protein · {round(scaledServing.carbs_g)} g
              Kohlenhydrate · {round(scaledServing.fat_g)} g Fett
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zubereitung</Text>
          {data.steps.length === 0 ? (
            <Text style={styles.emptyText}>Noch keine Zubereitungsschritte.</Text>
          ) : (
            <View style={styles.ingredientsList}>
              {data.steps.map((step) => (
                <StepCard key={step.id} step={step} data={data} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zutaten</Text>
          {topLevelComponents.length === 0 ? (
            <Text style={styles.emptyText}>Noch keine Zutaten.</Text>
          ) : (
            <View style={styles.ingredientsList}>
              {topLevelComponents.map((component) => {
                const per100 = calculateComponentPer100g(
                  component.id,
                  data.items,
                  data.productsById,
                );
                const grams = (component.serving_grams ?? 0) * servings;
                return (
                  <View key={component.id} style={styles.bulletRow}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.ingredientText}>
                      {component.name} — {round(grams)} g · {round(per100.kcal)} kcal/100g
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#665555',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  headerIconButton: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FF5262',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editButton: {
    backgroundColor: '#FFE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  editText: {
    color: '#FF5262',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFE2E2',
    padding: 8,
    borderRadius: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroCard: {
    width: '100%',
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 20,
    position: 'relative',
  },
  imageBackground: {
    flex: 1,
    backgroundColor: '#9B51E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF5262',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  heroBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: '#FF5262',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  recipeTitleText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: '#FFE2E2',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgePillText: {
    color: '#FF5262',
    fontSize: 13,
    fontWeight: '600',
  },
  badgePillAlt: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgePillAltText: {
    color: '#9B51E0',
    fontSize: 13,
    fontWeight: '600',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 15,
    color: '#332222',
    fontWeight: '500',
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  hashtagText: {
    color: '#FF5262',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF5262',
  },
  servingsStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperSign: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF5262',
    paddingHorizontal: 6,
  },
  servingsValue: {
    fontSize: 13,
    color: '#332222',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 15,
    color: '#4A3E3E',
    marginTop: 8,
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 14,
    color: '#665555',
    marginTop: 4,
  },
  ingredientsList: {
    marginTop: 12,
    gap: 10,
  },
  stepCard: {
    gap: 8,
  },
  stepImage: {
    width: '100%',
    height: 160,
    borderRadius: 16,
  },
  stepChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginLeft: 34,
  },
  stepChip: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF5262',
    backgroundColor: '#FFE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletPoint: {
    color: '#FF5262',
    fontSize: 18,
    lineHeight: 22,
  },
  stepIndex: {
    color: '#FF5262',
    fontWeight: '700',
    fontSize: 14,
    width: 24,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: '#332222',
    lineHeight: 22,
  },
});
