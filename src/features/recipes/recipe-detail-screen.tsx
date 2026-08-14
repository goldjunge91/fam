import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { useTheme } from '@/hooks/use-theme';

import { RecipeShoppingSheet } from './components/recipe-shopping-sheet';
import { calculateServingNutrition, scaleServing } from './nutrition';
import { useRecipeCoverUrl } from './recipe-cover';
import { useRecipeFavorites } from './recipe-favorites';
import { useRecipeRating } from './recipe-ratings';
import {
  type DishType,
  type RecipeDetail,
  useDeleteRecipeMutation,
  useRecipeDetail,
} from './use-recipes';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Einfach',
  medium: 'Mittel',
  hard: 'Anspruchsvoll',
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

function round(value: number): number {
  return Math.round(value);
}

function BackGlyph() {
  return <ThemedText style={styles.backGlyph}>‹</ThemedText>;
}

function HeartGlyph({ filled }: { filled: boolean }) {
  const theme = useTheme();
  return (
    <ThemedText style={[styles.heartGlyph, { color: theme.accent }]}>
      {filled ? '♥' : '♡'}
    </ThemedText>
  );
}

function MoreGlyph() {
  return <ThemedText style={styles.moreGlyph}>•••</ThemedText>;
}

function HeroArtwork({ coverUrl, title }: { coverUrl?: string | null; title: string }) {
  if (coverUrl) {
    return (
      <Image
        source={{ uri: coverUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityLabel={`Bild von ${title}`}
      />
    );
  }

  return (
    <Svg width="100%" height="100%" accessibilityLabel={`Illustration für ${title}`}>
      <Defs>
        <LinearGradient id="recipe-detail-cover" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#D3A06F" />
          <Stop offset="58%" stopColor="#8A696C" />
          <Stop offset="100%" stopColor="#574458" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#recipe-detail-cover)" />
      <Circle cx="78%" cy="16%" r="30%" fill="rgba(255,226,187,0.30)" />
      <Circle cx="51%" cy="102%" r="31%" fill="rgba(101,150,111,0.30)" />
    </Svg>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.metaPill, { backgroundColor: `${theme.backgroundElement}D6` }]}>
      <ThemedText themeColor="textSecondary" style={styles.metaPillText}>
        {children}
      </ThemedText>
    </View>
  );
}

function NutritionStat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.nutritionStat, { backgroundColor: `${theme.backgroundElement}D6` }]}>
      <ThemedText style={styles.nutritionValue}>{value}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.nutritionLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function ManageRow({
  label,
  onPress,
  danger = false,
  isLast = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  isLast?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      role="button"
      style={({ pressed }) => [
        styles.manageRow,
        !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && styles.pressed,
      ]}>
      <ThemedText themeColor={danger ? 'danger' : 'text'} style={styles.manageRowText}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function IngredientGroups({ data, servings }: { data: RecipeDetail; servings: number }) {
  const theme = useTheme();
  const groups = data.components.filter((component) => component.serving_grams !== null);

  if (groups.length === 0) {
    return (
      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
        Noch keine Zutaten hinterlegt.
      </ThemedText>
    );
  }

  return (
    <View style={styles.groupList}>
      {groups.map((component) => {
        const items = data.items.filter((item) => item.component_id === component.id);
        const preparedGrams = (component.serving_grams ?? 0) * servings;

        return (
          <View
            key={component.id}
            style={[styles.ingredientGroup, { backgroundColor: `${theme.backgroundElement}D6` }]}>
            <View style={[styles.groupHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.groupTitle}>{component.name}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.groupMeta}>
                {round(preparedGrams)} g zubereitet
              </ThemedText>
            </View>
            {items.map((item, index) => {
              const product = item.product_id ? data.productsById.get(item.product_id) : undefined;
              const quantity =
                item.quantity !== null ? item.quantity * servings : item.grams * servings;
              const unit = item.quantity !== null ? item.unit : 'g';
              return (
                <View
                  key={item.id}
                  style={[
                    styles.ingredientRow,
                    index < items.length - 1 && {
                      borderBottomColor: theme.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <ThemedText style={styles.ingredientName} numberOfLines={1}>
                    {product?.name ?? 'Zutat'}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.ingredientAmount}>
                    {round(quantity)} {unit}
                  </ThemedText>
                </View>
              );
            })}
            {items.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.emptyGroupText}>
                Noch keine Zutaten in dieser Gruppe.
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function RecipeDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [servings, setServings] = useState(1);
  const [manageOpen, setManageOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const { data, isLoading } = useRecipeDetail(id);
  const { data: coverUrl } = useRecipeCoverUrl(data?.recipe.cover_image_path);
  const deleteMutation = useDeleteRecipeMutation();
  const { isFavorite, toggleFavorite } = useRecipeFavorites();
  const favorite = isFavorite(`recipe:${id}`);
  const rating = useRecipeRating(id);

  const baseServing = useMemo(
    () => (data ? calculateServingNutrition(data.components, data.items, data.productsById) : null),
    [data],
  );
  const scaledServing =
    baseServing && baseServing.grams > 0 ? scaleServing(baseServing, servings) : null;

  function deleteRecipe() {
    if (!data) return;
    Alert.alert('Rezept löschen', `„${data.recipe.title}“ wird dauerhaft entfernt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () =>
          deleteMutation.mutate(
            { id: data.recipe.id, household_id: data.recipe.household_id },
            { onSuccess: () => router.back() },
          ),
      },
    ]);
  }

  if (isLoading || !data) {
    return (
      <View style={styles.root}>
        <GradientBackground colors={['#FFD2B9', '#F8F4EF', '#EEE7F4']} />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <PageHeader
            title="Rezept"
            leading={
              <HeaderIconButton label="Zurück" onPress={() => router.back()}>
                <BackGlyph />
              </HeaderIconButton>
            }
          />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Rezept wird geladen…
          </ThemedText>
        </SafeAreaView>
      </View>
    );
  }

  const { recipe } = data;
  const tags = [...recipe.dish_types, ...recipe.dietary_tags];

  return (
    <View style={styles.root}>
      <GradientBackground colors={['#FFD2B9', '#F8F4EF', '#EEE7F4']} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Rezept"
          leading={
            <HeaderIconButton label="Zurück" onPress={() => router.back()}>
              <BackGlyph />
            </HeaderIconButton>
          }
          trailing={
            <>
              <HeaderIconButton
                label={favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                onPress={() => toggleFavorite(`recipe:${id}`)}>
                <HeartGlyph filled={favorite} />
              </HeaderIconButton>
              <HeaderIconButton label="Rezept verwalten" onPress={() => setManageOpen(true)}>
                <MoreGlyph />
              </HeaderIconButton>
            </>
          }
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <HeroArtwork coverUrl={coverUrl} title={recipe.title} />
            <View style={[styles.heroBadge, { backgroundColor: `${theme.backgroundElement}E8` }]}>
              <ThemedText themeColor="accent" style={styles.heroBadgeText}>
                Unser Rezept
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.title}>{recipe.title}</ThemedText>
          <View style={styles.metaRow}>
            {recipe.cook_time_minutes ? (
              <MetaPill>{recipe.cook_time_minutes} Minuten</MetaPill>
            ) : null}
            {recipe.difficulty ? <MetaPill>{DIFFICULTY_LABELS[recipe.difficulty]}</MetaPill> : null}
            {rating ? <MetaPill>★ {rating.score}/10</MetaPill> : null}
            {scaledServing ? <MetaPill>{round(scaledServing.kcal)} kcal / Portion</MetaPill> : null}
          </View>

          {tags.length > 0 || recipe.hashtags.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagRow}>
              {tags.map((tag) => (
                <MetaPill key={tag}>
                  {DISH_TYPE_LABELS[tag as DishType] ?? DIETARY_TAG_LABELS[tag] ?? tag}
                </MetaPill>
              ))}
              {recipe.hashtags.map((tag) => (
                <MetaPill key={tag}>#{tag}</MetaPill>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>Zutaten</ThemedText>
            <View
              style={[styles.portionControl, { backgroundColor: `${theme.backgroundElement}D6` }]}>
              <Pressable
                onPress={() => setServings((value) => Math.max(1, value - 1))}
                role="button"
                aria-label="Weniger Portionen"
                style={styles.portionButton}>
                <ThemedText themeColor="accent" style={styles.portionSign}>
                  −
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.portionValue}>{servings} Portionen</ThemedText>
              <Pressable
                onPress={() => setServings((value) => value + 1)}
                role="button"
                aria-label="Mehr Portionen"
                style={styles.portionButton}>
                <ThemedText themeColor="accent" style={styles.portionSign}>
                  +
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <IngredientGroups data={data} servings={servings} />

          <Pressable
            role="button"
            aria-label="Fehlende Zutaten zur Einkaufsliste hinzufügen"
            onPress={() => setShoppingOpen(true)}
            style={({ pressed }) => [
              styles.shoppingButton,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText themeColor="accent" style={styles.shoppingButtonText}>
              Fehlende Zutaten zur Einkaufsliste
            </ThemedText>
          </Pressable>

          {scaledServing ? (
            <View style={styles.nutritionRow}>
              <NutritionStat value={String(round(scaledServing.kcal))} label="kcal" />
              <NutritionStat value={`${round(scaledServing.protein_g)} g`} label="Protein" />
              <NutritionStat value={`${round(scaledServing.carbs_g)} g`} label="Kohlenhydrate" />
              <NutritionStat value={`${round(scaledServing.fat_g)} g`} label="Fett" />
            </View>
          ) : null}

          {recipe.instructions ? (
            <ThemedText themeColor="textSecondary" style={styles.description}>
              {recipe.instructions}
            </ThemedText>
          ) : null}

          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>Zubereitung</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.sectionCount}>
              {data.steps.length} {data.steps.length === 1 ? 'Schritt' : 'Schritte'}
            </ThemedText>
          </View>
          {data.steps.length > 0 ? (
            <View style={[styles.stepsCard, { backgroundColor: `${theme.backgroundElement}D6` }]}>
              {data.steps.map((step, index) => (
                <View
                  key={step.id}
                  style={[
                    styles.stepRow,
                    index < data.steps.length - 1 && {
                      borderBottomColor: theme.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}>
                  <ThemedText style={styles.stepText} numberOfLines={2}>
                    {index + 1}. {step.text}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Noch keine Zubereitungsschritte hinterlegt.
            </ThemedText>
          )}
        </ScrollView>

        <View style={styles.stickyAction}>
          <Pressable
            onPress={() => router.push({ pathname: '/recipe/cook', params: { id: recipe.id } })}
            role="button"
            aria-label="Kochmodus starten"
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.primaryButtonText}>Kochmodus starten</ThemedText>
          </Pressable>
        </View>

        <Modal
          visible={manageOpen}
          transparent
          statusBarTranslucent
          animationType="slide"
          onRequestClose={() => setManageOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setManageOpen(false)}>
            <Pressable
              style={[styles.manageSheet, { backgroundColor: theme.backgroundElement }]}
              onPress={() => {}}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
              <View style={styles.manageHeader}>
                <ThemedText style={styles.manageTitle}>Rezept verwalten</ThemedText>
                <Pressable
                  onPress={() => setManageOpen(false)}
                  role="button"
                  aria-label="Schließen"
                  style={[styles.sheetClose, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText themeColor="accent" style={styles.sheetCloseText}>
                    ×
                  </ThemedText>
                </Pressable>
              </View>
              <ManageRow
                label="Bearbeiten"
                onPress={() => {
                  setManageOpen(false);
                  router.push({ pathname: '/recipe/create', params: { id: recipe.id } });
                }}
              />
              <ManageRow
                label="Mit Community teilen"
                onPress={async () => {
                  setManageOpen(false);
                  const ingredientLines = data.items.map((item) => {
                    const product = item.product_id
                      ? data.productsById.get(item.product_id)
                      : undefined;
                    return `• ${product?.name ?? 'Zutat'}: ${Math.round(item.quantity ?? item.grams)} ${item.quantity !== null ? item.unit : 'g'}`;
                  });
                  await Share.share({
                    title: recipe.title,
                    message: [
                      recipe.title,
                      recipe.instructions,
                      ingredientLines.length > 0 ? `Zutaten:\n${ingredientLines.join('\n')}` : null,
                    ]
                      .filter(Boolean)
                      .join('\n\n'),
                  });
                }}
              />
              <ManageRow
                label="Original-Aktualisierung prüfen"
                onPress={() => {
                  setManageOpen(false);
                  Alert.alert(
                    'Aktualisierung',
                    'Dieses eigene Rezept besitzt keine verknüpfte Vorlage.',
                  );
                }}
              />
              <ManageRow
                label="Löschen"
                danger
                isLast
                onPress={() => {
                  setManageOpen(false);
                  deleteRecipe();
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
        <RecipeShoppingSheet
          visible={shoppingOpen}
          detail={data}
          servings={servings}
          onClose={() => setShoppingOpen(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 15, paddingBottom: 96 },
  loadingText: { padding: 24, textAlign: 'center', ...FontSize[12] },
  backGlyph: { ...FontSize[27], lineHeight: 29, fontWeight: 400 },
  heartGlyph: { ...FontSize[24], lineHeight: 27, fontWeight: 500 },
  moreGlyph: { ...FontSize[13], lineHeight: 16, fontWeight: 800, letterSpacing: 1 },
  hero: { height: 205, marginHorizontal: -15, overflow: 'hidden' },
  heroBadge: {
    position: 'absolute',
    top: 14,
    left: 15,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  heroBadgeText: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  title: {
    paddingTop: 15,
    ...FontSize[22],
    lineHeight: 26,
    fontWeight: 700,
    letterSpacing: -0.7,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 5 },
  metaPill: {
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metaPillText: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  tagRow: { gap: 6, paddingTop: 7, paddingRight: 15 },
  sectionHeading: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 9,
  },
  sectionTitle: { ...FontSize[13], lineHeight: 16, fontWeight: 700 },
  sectionCount: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  portionControl: {
    width: 138,
    height: 35,
    borderRadius: 13,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
  },
  portionButton: { width: 34, height: 35, alignItems: 'center', justifyContent: 'center' },
  portionSign: { ...FontSize[15], lineHeight: 18, fontWeight: 500 },
  portionValue: {
    flex: 1,
    textAlign: 'center',
    ...FontSize[9],
    lineHeight: 11,
    fontWeight: 500,
  },
  groupList: { gap: 9 },
  ingredientGroup: { borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden' },
  groupHeader: {
    minHeight: 33,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupTitle: { flex: 1, ...FontSize[10], lineHeight: 12, fontWeight: 700 },
  groupMeta: { ...FontSize[8], lineHeight: 10, fontWeight: 500 },
  ingredientRow: {
    minHeight: 27,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ingredientName: { flex: 1, ...FontSize[9], lineHeight: 11, fontWeight: 500 },
  ingredientAmount: { ...FontSize[9], lineHeight: 11, fontWeight: 500 },
  emptyGroupText: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...FontSize[9],
    lineHeight: 11,
  },
  emptyText: { ...FontSize[10], lineHeight: 14 },
  shoppingButton: {
    minHeight: 44,
    marginTop: 11,
    borderRadius: 15,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  shoppingButtonText: {
    ...FontSize[10],
    lineHeight: 13,
    fontWeight: 700,
    textAlign: 'center',
  },
  nutritionRow: { flexDirection: 'row', gap: 5, paddingTop: 10 },
  nutritionStat: {
    flex: 1,
    height: 40,
    minWidth: 0,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionValue: { ...FontSize[10], lineHeight: 12, fontWeight: 700 },
  nutritionLabel: { marginTop: 2, ...FontSize[7], lineHeight: 9, fontWeight: 500 },
  description: { paddingTop: 14, ...FontSize[10], lineHeight: 15, fontWeight: 500 },
  stepsCard: { borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden' },
  stepRow: { minHeight: 28, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  stepText: { ...FontSize[9], lineHeight: 12, fontWeight: 500 },
  stickyAction: { position: 'absolute', left: 15, right: 15, bottom: 12 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#FFFFFF', ...FontSize[11], lineHeight: 14, fontWeight: 700 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38,31,39,0.30)' },
  manageSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 19,
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 3, alignSelf: 'center' },
  manageHeader: {
    minHeight: 58,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  manageTitle: { ...FontSize[18], lineHeight: 22, fontWeight: 700, letterSpacing: -0.4 },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: { ...FontSize[18], lineHeight: 20, fontWeight: 500 },
  manageRow: { minHeight: 45, justifyContent: 'center', paddingHorizontal: 6 },
  manageRowText: { ...FontSize[10], lineHeight: 13, fontWeight: 500 },
});
