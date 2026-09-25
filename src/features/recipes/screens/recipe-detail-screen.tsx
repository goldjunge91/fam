/**
 * Rezept-Detailansicht mit zwei Tabs:
 *   1. „Details“ — Hero-Bild, Basis-Fakten, portionierbare Zutatenliste,
 *      Nährwerte und Zubereitungsschritte.
 *   2. „Bewertungen“ — eigene Punktebewertung plus Notiz.
 *
 * Route: /recipe/[id]; Daten kommen über useRecipeDetail aus der
 * lokalen SQLite-Spiegelung (Offline-first).
 *
 * Datei-Gliederung:
 *   1. Kleine UI-Bausteine (DetailFact, NutritionStat, ManageRow, …)
 *   2. IngredientGroups — Zutaten nach Komponenten, auf Portionen skaliert
 *   3. RecipeDetailScreen — Haupt-Screen mit Tabs, Verwaltungs-Modal,
 *      Shopping-Sheet und Rating-Sheet
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { radius, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { Press, Txt } from '@/constants/ui';
import { HeartGlyph, HeroArtwork } from '../components/recipe-detail-primitives';
import { RecipeRatingSheet } from '../components/recipe-rating-sheet';
import { RecipeShoppingSheet } from '../components/recipe-shopping-sheet';
import { StepRichContent } from '../components/step-rich-content';
import { useRecipeCoverUrl } from '../data/household-recipe-images';
import { flattenRecipeItems, type MentionableIngredient } from '../domain/ingredient-mentions';
import { calculateServingNutrition, scaleServing } from '../domain/nutrition';
import { useRecipeFavorites } from '../domain/recipe-favorites';
import { useRecipeRating } from '../domain/recipe-ratings';
import type { RecipeStep } from '../hooks/use-recipe-steps';
import { type RecipeDetail, useDeleteRecipeMutation, useRecipeDetail } from '../hooks/use-recipes';
import {
  DIETARY_TAG_LABELS,
  DIFFICULTY_LABELS,
  DISH_TYPE_LABELS,
} from '../wizard/recipe-metadata-options';

const styles = StyleSheet.create((theme) => ({
  loading: {
    padding: theme.space.xxxl,
    textAlign: 'center',
  },
  detailFact: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: theme.space.xs,
  },
  factLabel: {
    paddingTop: theme.space.md,
    textAlign: 'center',
  },
  step: {
    gap: theme.space.lg,
    paddingVertical: theme.space.lg,
  },
  stepRow: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  stepNumber: {
    width: rs(30),
  },
  stepCopy: {
    flex: 1,
    gap: theme.space.xs,
  },
  nutritionStat: {
    flex: 1,
    minHeight: rs(58),
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xs,
  },
  manageRow: {
    minHeight: rs(45),
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
  },
  ingredients: {
    gap: theme.space.xl,
  },
  ingredientGroup: {
    paddingTop: theme.space.lg,
  },
  ingredientHeader: {
    minHeight: rs(40),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  ingredientItem: {
    minHeight: rs(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
  },
  ingredientName: {
    flex: 1,
  },
  emptyIngredients: {
    paddingVertical: theme.space.lg,
  },
  emptyIngredientGroup: {
    paddingVertical: theme.space.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: rs(108),
  },
  hero: {
    height: rs(178),
    marginHorizontal: -theme.space.lg,
    overflow: 'hidden',
  },
  title: {
    paddingTop: theme.space.xl,
    letterSpacing: -0.25,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: theme.space.xxl,
  },
  tabContainer: {
    flex: 1,
  },
  tab: {
    width: '100%',
    minHeight: rs(48),
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  facts: {
    flexDirection: 'row',
    paddingVertical: theme.space.lg,
  },
  instructions: {
    paddingTop: theme.space.lg,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.space.lg,
    rowGap: theme.space.sm,
    paddingTop: theme.space.md,
  },
  tagMore: {
    textDecorationLine: 'underline',
  },
  ingredientHeaderRow: {
    minHeight: rs(58),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    marginTop: theme.space.xl,
  },
  stepper: {
    width: rs(156),
    height: rs(44),
    borderRadius: theme.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButtonContainer: {
    width: rs(44),
    height: rs(44),
  },
  stepperButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servings: {
    flex: 1,
    textAlign: 'center',
  },
  missingButton: {
    minHeight: rs(48),
    marginTop: theme.space.lg,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.sm,
  },
  nutrition: {
    flexDirection: 'row',
    marginTop: theme.space.lg,
  },
  preparationHeader: {
    minHeight: rs(58),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    marginTop: theme.space.xl,
  },
  emptySteps: {
    paddingVertical: theme.space.lg,
  },
  ratings: {
    paddingTop: theme.space.xl,
  },
  ratingRow: {
    minHeight: rs(58),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.xl,
    paddingBottom: theme.space.lg,
  },
  noteTitle: {
    paddingTop: theme.space.xxl,
  },
  noteBody: {
    paddingTop: theme.space.xs,
  },
  ratingEmpty: {
    alignItems: 'center',
    paddingVertical: theme.space.xxxl,
  },
  ratingHint: {
    paddingTop: theme.space.md,
    textAlign: 'center',
  },
  ratingButton: {
    minHeight: rs(48),
    marginTop: theme.space.xxl,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  floatingContainer: {
    position: 'absolute',
    left: rs(15),
    right: rs(15),
    bottom: theme.space.sm,
  },
  floatingButton: {
    minHeight: rs(48),
    alignSelf: 'center',
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.xxl,
  },
  manageBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  manageSheet: {
    borderTopLeftRadius: theme.radius.famLarge,
    borderTopRightRadius: theme.radius.famLarge,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xl,
  },
  manageHandle: {
    width: rs(38),
    height: rs(4),
    alignSelf: 'center',
    borderRadius: radius.micro,
  },
  manageHeader: {
    minHeight: rs(58),
    paddingTop: theme.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  manageClose: {
    width: rs(32),
    height: rs(32),
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

function round(value: number): number {
  return Math.round(value);
}

function MoreGlyph() {
  return (
    <Txt variant="caption" weight="800" style={{ letterSpacing: 1.5 }}>
      •••
    </Txt>
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
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.detailFact,
        withDivider && { borderLeftColor: colors.border, borderLeftWidth: 1 },
      ]}>
      <Txt variant="heading" center>
        {value}
      </Txt>
      <Txt variant="caption" tone="secondary" style={styles.factLabel}>
        {label}
      </Txt>
    </View>
  );
}

/** Einzelner Zubereitungsschritt: optionales Bild, Nummer, Text mit @-Mentions, Timer. */
function RecipeStepItem({
  step,
  index,
  isLast,
  ingredients,
}: {
  step: RecipeStep;
  index: number;
  isLast: boolean;
  ingredients: MentionableIngredient[];
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.step, !isLast && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={styles.stepRow}>
        <Txt variant="heading" tone="primary" style={styles.stepNumber}>
          {index + 1}
        </Txt>
        <View style={styles.stepCopy}>
          <StepRichContent
            text={step.text}
            ingredients={ingredients}
            images={
              step.images && step.images.length > 0
                ? step.images.map((image, imageIndex) => ({
                    key: image.id,
                    path: image.storage_path,
                    accessibilityLabel:
                      imageIndex === 0
                        ? `Bild für Schritt ${index + 1}`
                        : `Bild ${imageIndex + 1} für Schritt ${index + 1}`,
                  }))
                : step.image_path
                  ? [
                      {
                        key: step.image_path,
                        path: step.image_path,
                        accessibilityLabel: `Bild für Schritt ${index + 1}`,
                      },
                    ]
                  : []
            }
            variant="body"
            weight="500"
          />
          {step.timer_minutes !== null ? (
            <Txt variant="caption" tone="secondary">
              ⏱ {step.timer_minutes} Min. Timer
            </Txt>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Zelle der Nährwerttabelle (Wert + Label untereinander). */
function NutritionStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.nutritionStat}>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" tone="secondary" style={styles.factLabel} weight="500">
        {label}
      </Txt>
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
  const { colors } = useTheme();

  return (
    <Press
      onPress={onPress}
      role="button"
      style={[
        styles.manageRow,
        !isLast && { borderBottomColor: colors.border, borderBottomWidth: 1 },
      ]}>
      <Txt variant="caption" tone={danger ? 'danger' : 'primary'} weight="500">
        {label}
      </Txt>
    </Press>
  );
}

/**
 * Zutatenliste gegliedert nach Komponenten (z.B. „Teig“, „Belag“).
 * Mengen werden mit dem Portionsfaktor multipliziert; Produkte liefern
 * den Anzeigenamen, sonst Fallback „Zutat“.
 */
function IngredientGroups({ data, servings }: { data: RecipeDetail; servings: number }) {
  const { colors } = useTheme();
  const groups = data.components.filter((component) => component.serving_grams !== null);

  if (groups.length === 0) {
    return (
      <Txt variant="body" tone="secondary" style={styles.emptyIngredients}>
        Noch keine Zutaten hinterlegt.
      </Txt>
    );
  }

  return (
    <View style={styles.ingredients}>
      {groups.map((component) => {
        const items = data.items.filter((item) => item.component_id === component.id);
        const preparedGrams = (component.serving_grams ?? 0) * servings;

        return (
          <View key={component.id} style={styles.ingredientGroup}>
            <View
              style={[
                styles.ingredientHeader,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}>
              <Txt variant="heading" style={styles.ingredientName}>
                {component.name}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {round(preparedGrams)} g zubereitet
              </Txt>
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
                    styles.ingredientItem,
                    index < items.length - 1 && {
                      borderBottomColor: colors.border,
                      borderBottomWidth: 1,
                    },
                  ]}>
                  <Txt variant="body" weight="500" style={styles.ingredientName} numberOfLines={1}>
                    {product?.name ?? 'Zutat'}
                  </Txt>
                  <Txt variant="body" tone="secondary" weight="500">
                    {round(quantity)} {unit}
                  </Txt>
                </View>
              );
            })}
            {items.length === 0 ? (
              <Txt variant="body" tone="secondary" style={styles.emptyIngredientGroup}>
                Noch keine Zutaten in dieser Gruppe.
              </Txt>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Haupt-Screen: lädt Rezept + Komponenten + Items + Steps über
 * useRecipeDetail. Der Portions-Stepper skaliert lokal (kein Server-Call),
 * Nährwerte und Zutatenmengen werden aus baseServing × servings berechnet.
 */
export function RecipeDetailScreen() {
  const { colors } = useTheme();
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
  const mentionIngredients = useMemo(
    () => (data ? flattenRecipeItems(data.items, data.productsById) : []),
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
      <HubScreen
        header={{ title: 'Rezept', leading: <BackButton label="Zurück" variant="header" /> }}>
        <Txt variant="body" tone="secondary" style={styles.loading}>
          Rezept wird geladen…
        </Txt>
      </HubScreen>
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
    <HubScreen
      header={{
        title: 'Rezept',
        leading: <BackButton label="Zurück" variant="header" />,
        trailing: (
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
        ),
      }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Rezept-Titelbild / Artwork */}
        <View style={styles.hero}>
          <HeroArtwork coverUrl={coverUrl} title={recipe.title} />
        </View>

        {/* Rezepttitel */}
        <Txt variant="title" weight="700" style={styles.title}>
          {recipe.title}
        </Txt>

        {/* Tab-Leiste (Details vs. Bewertungen) */}
        <View style={[styles.tabs, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          {(['details', 'ratings'] as const).map((tab) => {
            const selected = activeTab === tab;
            const label = tab === 'details' ? 'Details' : 'Bewertungen';
            return (
              <Press
                key={tab}
                onPress={() => setActiveTab(tab)}
                role="tab"
                aria-label={label}
                aria-selected={selected}
                containerStyle={styles.tabContainer}
                style={[
                  styles.tab,
                  { borderBottomColor: selected ? colors.accent : 'transparent' },
                ]}>
                <Txt variant="heading" tone={selected ? 'primary' : 'secondary'}>
                  {label}
                </Txt>
              </Press>
            );
          })}
        </View>

        {activeTab === 'details' ? (
          <View>
            {/* Basis-Fakten (Kalorien, Zubereitungszeit, Schwierigkeitsgrad) */}
            <View
              style={[styles.facts, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
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

            {/* Beschreibung / Allgemeine Kochanleitung */}
            {recipe.instructions ? (
              <Txt variant="body" weight="500" style={styles.instructions}>
                {recipe.instructions}
              </Txt>
            ) : null}

            {/* Kategorien- und Hashtags */}
            {tags.length > 0 ? (
              <View style={styles.tags}>
                {visibleTags.map((tag) => (
                  <Txt key={tag} variant="caption" tone="secondary" weight="500">
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </Txt>
                ))}
                {tags.length > 3 ? (
                  <Press
                    onPress={() => setShowAllTags((visible) => !visible)}
                    role="button"
                    aria-label={showAllTags ? 'Weniger Tags anzeigen' : 'Alle Tags anzeigen'}
                    aria-expanded={showAllTags}
                    hitSlop={8}>
                    <Txt variant="caption" tone="secondary" style={styles.tagMore} weight="500">
                      {showAllTags ? 'Weniger' : `+${tags.length - 3} mehr`}
                    </Txt>
                  </Press>
                ) : null}
              </View>
            ) : null}

            {/* Zutaten-Kopf mit Portionsrechner-Stepper (+ / -) */}
            <View
              style={[
                styles.ingredientHeaderRow,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}>
              <Txt variant="heading">Zutaten</Txt>
              <View style={[styles.stepper, { backgroundColor: colors.backgroundElement }]}>
                <Press
                  onPress={() => setServings((value) => Math.max(1, value - 1))}
                  role="button"
                  aria-label="Weniger Portionen"
                  containerStyle={styles.stepperButtonContainer}
                  style={styles.stepperButton}>
                  <Txt variant="subheading" tone="secondary" weight="500">
                    −
                  </Txt>
                </Press>
                <Txt variant="body" weight="700" style={styles.servings}>
                  {servings} Portionen
                </Txt>
                <Press
                  onPress={() => setServings((value) => value + 1)}
                  role="button"
                  aria-label="Mehr Portionen"
                  containerStyle={styles.stepperButtonContainer}
                  style={styles.stepperButton}>
                  <Txt variant="subheading" tone="secondary" weight="500">
                    +
                  </Txt>
                </Press>
              </View>
            </View>

            {/* Zutatenliste nach Komponenten gegliedert */}
            <IngredientGroups data={data} servings={servings} />

            {/* Button zur Übernahme fehlender Zutaten in die Einkaufsliste */}
            <Press
              role="button"
              aria-label="Fehlende Zutaten zur Einkaufsliste hinzufügen"
              onPress={() => setShoppingOpen(true)}
              style={[styles.missingButton, { borderColor: colors.border, borderWidth: 1 }]}>
              <Txt variant="heading" tone="primary" center>
                Fehlende Zutaten zur Einkaufsliste
              </Txt>
            </Press>

            {/* Nährwerttabelle (kcal, Protein, Kohlenhydrate, Fett) */}
            {scaledServing ? (
              <View
                style={[
                  styles.nutrition,
                  {
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    borderBottomColor: colors.border,
                    borderBottomWidth: 1,
                  },
                ]}>
                <NutritionStat value={String(round(scaledServing.kcal))} label="kcal" />
                <NutritionStat value={`${round(scaledServing.protein_g)} g`} label="Protein" />
                <NutritionStat value={`${round(scaledServing.carbs_g)} g`} label="Kohlenhydrate" />
                <NutritionStat value={`${round(scaledServing.fat_g)} g`} label="Fett" />
              </View>
            ) : null}

            {/* Zubereitungsschritte mit Bildern und Text */}
            <View
              style={[
                styles.preparationHeader,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}>
              <Txt variant="heading">Zubereitung</Txt>
              <Txt variant="caption" tone="secondary" weight="500">
                {data.steps.length} {data.steps.length === 1 ? 'Schritt' : 'Schritte'}
              </Txt>
            </View>
            {data.steps.length > 0 ? (
              <View>
                {data.steps.map((step, index) => (
                  <RecipeStepItem
                    key={step.id}
                    step={step}
                    index={index}
                    isLast={index === data.steps.length - 1}
                    ingredients={mentionIngredients}
                  />
                ))}
              </View>
            ) : (
              <Txt variant="body" tone="secondary" style={styles.emptySteps}>
                Noch keine Zubereitungsschritte hinterlegt.
              </Txt>
            )}
          </View>
        ) : (
          /* Bewertungen & Notizen Tab */
          <View style={styles.ratings}>
            {rating ? (
              <>
                {/* Anzeige der eigenen Punktebewertung */}
                <View
                  style={[
                    styles.ratingRow,
                    { borderBottomColor: colors.border, borderBottomWidth: 1 },
                  ]}>
                  <Txt variant="title" weight="700">
                    ★ {rating.score}{' '}
                    <Txt variant="heading" tone="secondary">
                      / 10
                    </Txt>
                  </Txt>
                  <Txt variant="caption" tone="secondary" weight="500">
                    Deine Bewertung
                  </Txt>
                </View>
                {/* Eigene persönliche Notiz zum Rezept */}
                {rating.note ? (
                  <>
                    <Txt variant="heading" style={styles.noteTitle}>
                      Deine Notiz
                    </Txt>
                    <Txt variant="body" weight="500" style={styles.noteBody}>
                      {rating.note}
                    </Txt>
                  </>
                ) : null}
              </>
            ) : (
              /* Leerzustand für Bewertungen */
              <View style={styles.ratingEmpty}>
                <Txt variant="heading">Noch keine Bewertung</Txt>
                <Txt variant="body" tone="secondary" weight="500" style={styles.ratingHint}>
                  Halte fest, wie dir dieses Rezept gefallen hat.
                </Txt>
              </View>
            )}
            {/* Button zum Erstellen/Bearbeiten der Bewertung */}
            <Press
              onPress={() => setRatingOpen(true)}
              role="button"
              aria-label={rating ? 'Bewertung bearbeiten' : 'Rezept bewerten'}
              style={[styles.ratingButton, { backgroundColor: colors.accent }]}>
              <Txt variant="heading" tone="onAccent">
                {rating ? 'Bewertung bearbeiten' : 'Rezept bewerten'}
              </Txt>
            </Press>
          </View>
        )}
      </ScrollView>

      {/* Fixierter Floating-Button zum Starten des Kochmodus */}
      <View style={styles.floatingContainer}>
        <Press
          onPress={() => router.push({ pathname: '/recipe/cook', params: { id: recipe.id } })}
          role="button"
          aria-label="Kochmodus starten"
          style={[styles.floatingButton, { backgroundColor: colors.accent }]}>
          <Txt variant="heading" tone="onAccent">
            Kochmodus starten
          </Txt>
        </Press>
      </View>

      {/* Aktions-Modal zur Rezeptverwaltung (Bearbeiten, Teilen, Löschen) */}
      <Modal
        visible={manageOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setManageOpen(false)}>
        <Pressable
          style={[styles.manageBackdrop, { backgroundColor: colors.scrim }]}
          onPress={() => setManageOpen(false)}>
          <Pressable
            style={[styles.manageSheet, { backgroundColor: colors.backgroundElement }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={[styles.manageHandle, { backgroundColor: colors.border }]} />
            <View style={styles.manageHeader}>
              <Txt variant="heading" weight="700">
                Rezept verwalten
              </Txt>
              <Press
                onPress={() => setManageOpen(false)}
                role="button"
                aria-label="Schließen"
                style={[styles.manageClose, { backgroundColor: colors.backgroundSoft }]}>
                <Txt variant="heading" tone="secondary">
                  ×
                </Txt>
              </Press>
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

      {/* Einkaufs-Sheet für fehlende Zutaten */}
      <RecipeShoppingSheet
        visible={shoppingOpen}
        detail={data}
        servings={servings}
        onClose={() => setShoppingOpen(false)}
      />

      {/* Bewertungs-Sheet */}
      <RecipeRatingSheet
        recipeId={recipe.id}
        visible={ratingOpen}
        onClose={() => setRatingOpen(false)}
      />
    </HubScreen>
  );
}
