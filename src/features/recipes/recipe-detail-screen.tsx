// import { FontSize } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
// import styles from 'react-native-qrcode-svg/Example/src/styles';
import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Radius } from '@/constants/theme';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { RecipeRatingSheet } from './components/recipe-rating-sheet';
import { RecipeShoppingSheet } from './components/recipe-shopping-sheet';
import { calculateServingNutrition, scaleServing } from './nutrition';
import { useRecipeCoverUrl } from './recipe-cover';
import { useRecipeFavorites } from './recipe-favorites';
import { useRecipeRating } from './recipe-ratings';
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
  vegan: 'Vegan',
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

function DetailFact({
  value,
  label,
  withDivider = false,
}: {
  value: string;
  label: string;
  withDivider?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.detailFact,
        withDivider && { borderLeftColor: theme.border, borderLeftWidth: StyleSheet.hairlineWidth },
      ]}>
      <ThemedText style={styles.detailFactValue}>{value}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.detailFactLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function RecipeStepItem({
  step,
  index,
  isLast,
}: {
  step: RecipeStep;
  index: number;
  isLast: boolean;
}) {
  const theme = useTheme();
  const { data: imageUrl } = useRecipeStepImageUrl(step.image_path);

  return (
    <View
      style={[
        styles.stepItem,
        !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          contentFit="cover"
          accessibilityLabel={`Bild für Schritt ${index + 1}`}
          style={styles.stepImage}
        />
      ) : null}
      <View style={styles.stepCopy}>
        <ThemedText themeColor="accent" style={styles.stepNumber}>
          {index + 1}
        </ThemedText>
        <ThemedText style={styles.stepText}>{step.text}</ThemedText>
      </View>
    </View>
  );
}

function NutritionStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.nutritionStat}>
      <ThemedText type="controlValue" style={styles.nutritionValue}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.nutritionLabel}>
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
          <View key={component.id} style={styles.ingredientGroup}>
            <View style={[styles.groupHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="controlValue" style={styles.groupTitle}>
                {component.name}
              </ThemedText>
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
                  <ThemedText type="body" style={styles.ingredientName} numberOfLines={1}>
                    {product?.name ?? 'Zutat'}
                  </ThemedText>
                  <ThemedText
                    type="body"
                    themeColor="textSecondary"
                    style={styles.ingredientAmount}>
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
  const hubGradient = useHubGradient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [servings, setServings] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'ratings'>('details');
  const [showAllTags, setShowAllTags] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
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
        <GradientBackground {...hubGradient} />
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
  const tags = Array.from(
    new Set([
      ...recipe.dish_types.map((tag) => DISH_TYPE_LABELS[tag]),
      ...recipe.dietary_tags.map((tag) => DIETARY_TAG_LABELS[tag] ?? tag),
      ...recipe.hashtags.map((tag) => `#${tag}`),
    ]),
  );
  const visibleTags = showAllTags ? tags : tags.slice(0, 3);

  return (
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
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
          </View>

          <ThemedText style={styles.title}>{recipe.title}</ThemedText>

          <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
            {(['details', 'ratings'] as const).map((tab) => {
              const selected = activeTab === tab;
              const label = tab === 'details' ? 'Details' : 'Bewertungen';
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  role="tab"
                  aria-label={label}
                  aria-selected={selected}
                  style={[styles.tabButton, selected && { borderBottomColor: theme.accent }]}>
                  <ThemedText
                    themeColor={selected ? 'text' : 'textSecondary'}
                    style={styles.tabLabel}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'details' ? (
            <View>
              <View style={[styles.detailFacts, { borderBottomColor: theme.border }]}>
                <DetailFact
                  value={scaledServing ? `${round(scaledServing.kcal)} kcal` : '–'}
                  label="pro Portion"
                />
                <DetailFact
                  value={recipe.cook_time_minutes ? `${recipe.cook_time_minutes} Min` : '–'}
                  label="Zeit"
                  withDivider
                />
                <DetailFact
                  value={recipe.difficulty ? DIFFICULTY_LABELS[recipe.difficulty] : '–'}
                  label="Schwierigkeit"
                  withDivider
                />
              </View>

              {recipe.instructions ? (
                <ThemedText type="bodyRelaxed" style={styles.description}>
                  {recipe.instructions}
                </ThemedText>
              ) : null}

              {tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {visibleTags.map((tag) => (
                    <ThemedText key={tag} themeColor="textSecondary" style={styles.tagText}>
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </ThemedText>
                  ))}
                  {tags.length > 3 ? (
                    <Pressable
                      onPress={() => setShowAllTags((visible) => !visible)}
                      role="button"
                      aria-label={showAllTags ? 'Weniger Tags anzeigen' : 'Alle Tags anzeigen'}
                      aria-expanded={showAllTags}
                      hitSlop={8}>
                      <ThemedText themeColor="textSecondary" style={styles.moreTagsText}>
                        {showAllTags ? 'Weniger' : `+${tags.length - 3} mehr`}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={[styles.sectionHeading, { borderBottomColor: theme.border }]}>
                <ThemedText style={styles.sectionTitle}>Zutaten</ThemedText>
                <View style={[styles.portionControl, { backgroundColor: theme.backgroundElement }]}>
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
                  { borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="controlValue"
                  themeColor="accent"
                  style={styles.shoppingButtonText}>
                  Fehlende Zutaten zur Einkaufsliste
                </ThemedText>
              </Pressable>

              {scaledServing ? (
                <View style={[styles.nutritionRow, { borderColor: theme.border }]}>
                  <NutritionStat value={String(round(scaledServing.kcal))} label="kcal" />
                  <NutritionStat value={`${round(scaledServing.protein_g)} g`} label="Protein" />
                  <NutritionStat
                    value={`${round(scaledServing.carbs_g)} g`}
                    label="Kohlenhydrate"
                  />
                  <NutritionStat value={`${round(scaledServing.fat_g)} g`} label="Fett" />
                </View>
              ) : null}

              <View style={[styles.sectionHeading, { borderBottomColor: theme.border }]}>
                <ThemedText style={styles.sectionTitle}>Zubereitung</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.sectionCount}>
                  {data.steps.length} {data.steps.length === 1 ? 'Schritt' : 'Schritte'}
                </ThemedText>
              </View>
              {data.steps.length > 0 ? (
                <View>
                  {data.steps.map((step, index) => (
                    <RecipeStepItem
                      key={step.id}
                      step={step}
                      index={index}
                      isLast={index === data.steps.length - 1}
                    />
                  ))}
                </View>
              ) : (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  Noch keine Zubereitungsschritte hinterlegt.
                </ThemedText>
              )}
            </View>
          ) : (
            <View style={styles.ratingsPanel}>
              {rating ? (
                <>
                  <View style={[styles.ratingSummary, { borderBottomColor: theme.border }]}>
                    <ThemedText style={styles.ratingScore}>
                      ★ {rating.score} <ThemedText themeColor="textSecondary">/ 10</ThemedText>
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.ratingStatus}>
                      Deine Bewertung
                    </ThemedText>
                  </View>
                  {rating.note ? (
                    <>
                      <ThemedText style={styles.ratingHeading}>Deine Notiz</ThemedText>
                      <ThemedText type="bodyRelaxed" style={styles.ratingNote}>
                        {rating.note}
                      </ThemedText>
                    </>
                  ) : null}
                </>
              ) : (
                <View style={styles.ratingEmpty}>
                  <ThemedText style={styles.ratingHeading}>Noch keine Bewertung</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.ratingEmptyText}>
                    Halte fest, wie dir dieses Rezept gefallen hat.
                  </ThemedText>
                </View>
              )}
              <Pressable
                onPress={() => setRatingOpen(true)}
                role="button"
                aria-label={rating ? 'Bewertung bearbeiten' : 'Rezept bewerten'}
                style={({ pressed }) => [
                  styles.ratingButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={styles.ratingButtonText}>
                  {rating ? 'Bewertung bearbeiten' : 'Rezept bewerten'}
                </ThemedText>
              </Pressable>
            </View>
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
            <ThemedText type="controlValue" style={styles.primaryButtonText}>
              Kochmodus starten
            </ThemedText>
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
        <RecipeRatingSheet
          recipeId={recipe.id}
          visible={ratingOpen}
          onClose={() => setRatingOpen(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 108 },
  loadingText: { padding: 24, textAlign: 'center', ...FontSize[14] },
  backGlyph: { ...FontSize[27], lineHeight: 29, fontWeight: 400 },
  heartGlyph: { ...FontSize[24], lineHeight: 27, fontWeight: 500 },
  moreGlyph: { ...FontSize[13], lineHeight: 16, fontWeight: 800, letterSpacing: 1 },
  hero: { height: 178, marginHorizontal: -16, overflow: 'hidden' },
  title: {
    paddingTop: 18,
    ...FontSize[28],
    lineHeight: 32,
    fontWeight: 700,
    letterSpacing: -0.7,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabLabel: { ...FontSize[16], lineHeight: 20, fontWeight: 700 },
  detailFacts: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailFact: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4 },
  detailFactValue: { ...FontSize[16], lineHeight: 20, fontWeight: 700, textAlign: 'center' },
  detailFactLabel: { paddingTop: 3, ...FontSize[12], lineHeight: 16, textAlign: 'center' },
  description: { paddingTop: 16, ...FontSize[16], lineHeight: 24, fontWeight: 500 },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 8,
    paddingTop: 12,
  },
  tagText: { ...FontSize[13], lineHeight: 18, fontWeight: 500 },
  moreTagsText: {
    ...FontSize[13],
    lineHeight: 18,
    fontWeight: 500,
    textDecorationLine: 'underline',
  },
  sectionHeading: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { ...FontSize[20], lineHeight: 26, fontWeight: 700 },
  sectionCount: { ...FontSize[13], lineHeight: 18, fontWeight: 500 },
  portionControl: {
    width: 156,
    height: 44,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
  },
  portionButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  portionSign: { ...FontSize[22], lineHeight: 26, fontWeight: 500 },
  portionValue: {
    flex: 1,
    textAlign: 'center',
    ...FontSize[14],
    lineHeight: 18,
    fontWeight: 700,
  },
  groupList: { gap: 18 },
  ingredientGroup: { paddingTop: 14 },
  groupHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupTitle: { flex: 1, ...FontSize[15], lineHeight: 20, fontWeight: 700 },
  groupMeta: { ...FontSize[13], lineHeight: 18, fontWeight: 500 },
  ingredientRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ingredientName: { flex: 1, ...FontSize[16], lineHeight: 22, fontWeight: 500 },
  ingredientAmount: { ...FontSize[16], lineHeight: 22, fontWeight: 500 },
  emptyGroupText: {
    paddingVertical: 12,
    ...FontSize[15],
    lineHeight: 22,
  },
  emptyText: { paddingVertical: 14, ...FontSize[15], lineHeight: 22 },
  shoppingButton: {
    minHeight: 48,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  shoppingButtonText: {
    ...FontSize[15],
    lineHeight: 20,
    fontWeight: 700,
    textAlign: 'center',
  },
  nutritionRow: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nutritionStat: {
    flex: 1,
    minHeight: 58,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  nutritionValue: { ...FontSize[15], lineHeight: 20, fontWeight: 700 },
  nutritionLabel: { paddingTop: 3, ...FontSize[11], lineHeight: 15, fontWeight: 500 },
  stepItem: { gap: 12, paddingVertical: 14 },
  stepImage: { width: '100%', height: 180, borderRadius: Radius.card, borderCurve: 'continuous' },
  stepCopy: { flexDirection: 'row', gap: 10 },
  stepNumber: { width: 30, ...FontSize[16], lineHeight: 24, fontWeight: 700 },
  stepText: { flex: 1, ...FontSize[16], lineHeight: 24, fontWeight: 500 },
  ratingsPanel: { paddingTop: 22 },
  ratingSummary: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ratingScore: { ...FontSize[28], lineHeight: 34, fontWeight: 700 },
  ratingStatus: { ...FontSize[13], lineHeight: 18, fontWeight: 500 },
  ratingHeading: { paddingTop: 20, ...FontSize[20], lineHeight: 26, fontWeight: 700 },
  ratingNote: { paddingTop: 8, ...FontSize[16], lineHeight: 24, fontWeight: 500 },
  ratingEmpty: { alignItems: 'center', paddingVertical: 24 },
  ratingEmptyText: {
    paddingTop: 6,
    ...FontSize[15],
    lineHeight: 22,
    fontWeight: 500,
    textAlign: 'center',
  },
  ratingButton: {
    minHeight: 48,
    marginTop: 20,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ratingButtonText: { color: '#FFFFFF', ...FontSize[16], lineHeight: 20, fontWeight: 700 },
  stickyAction: { position: 'absolute', left: 15, right: 15, bottom: 12 },
  primaryButton: {
    minHeight: 48,
    alignSelf: 'center',
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryButtonText: { color: '#FFFFFF', ...FontSize[15], lineHeight: 20, fontWeight: 700 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38,31,39,0.30)' },
  manageSheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 19,
  },
  sheetHandle: { width: 38, height: 4, borderRadius: Radius.hairline, alignSelf: 'center' },
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
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: { ...FontSize[18], lineHeight: 20, fontWeight: 500 },
  manageRow: { minHeight: 45, justifyContent: 'center', paddingHorizontal: 6 },
  manageRowText: { ...FontSize[10], lineHeight: 13, fontWeight: 500 },
});
