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
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton, HeaderIconButton } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { HeartGlyph, HeroArtwork } from '../components/recipe-detail-primitives';
import { RecipeRatingSheet } from '../components/recipe-rating-sheet';
import { RecipeShoppingSheet } from '../components/recipe-shopping-sheet';
import { StepMentionText } from '../components/step-mention-text';
import { useRecipeCoverUrl, useRecipeStepImageUrl } from '../data/household-recipe-images';
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

function round(value: number): number {
  return Math.round(value);
}

function MoreGlyph() {
  return (
    <Txt variant="caption" weight="800" className="tracking-widest">
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
      className="flex-1 min-w-0 items-center px-one"
      style={withDivider ? { borderLeftColor: colors.border, borderLeftWidth: 1 } : undefined}>
      <Txt variant="heading" center>
        {value}
      </Txt>
      <Txt variant="caption" tone="secondary" className="pt-[3px] text-center">
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
  const { data: imageUrl } = useRecipeStepImageUrl(step.image_path);

  return (
    <View
      className="gap-three py-four"
      style={!isLast ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : undefined}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          contentFit="cover"
          accessibilityLabel={`Bild für Schritt ${index + 1}`}
          // expo-image benötigt inline Dimensionen
          style={{ width: '100%', height: 180, borderRadius: 16 }}
        />
      ) : null}
      <View className="flex-row gap-[10px]">
        <Txt variant="heading" tone="primary" className="w-[30px]">
          {index + 1}
        </Txt>
        <View className="flex-1 gap-one">
          <StepMentionText text={step.text} ingredients={ingredients} variant="body" weight="500" />
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
    <View className="flex-1 min-h-[58px] min-w-0 items-center justify-center px-half">
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" tone="secondary" className="pt-[3px]" weight="500">
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
    <Pressable
      onPress={onPress}
      role="button"
      className="min-h-[45px] justify-center px-[6px] active:opacity-75"
      style={!isLast ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : undefined}>
      <Txt variant="caption" tone={danger ? 'danger' : 'primary'} weight="500">
        {label}
      </Txt>
    </Pressable>
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
      <Txt variant="body" tone="secondary" className="py-four">
        Noch keine Zutaten hinterlegt.
      </Txt>
    );
  }

  return (
    <View className="gap-[18px]">
      {groups.map((component) => {
        const items = data.items.filter((item) => item.component_id === component.id);
        const preparedGrams = (component.serving_grams ?? 0) * servings;

        return (
          <View key={component.id} className="pt-[14px]">
            <View
              className="min-h-[40px] row-between gap-[10px]"
              style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
              <Txt variant="heading" className="flex-1">
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
                  className="min-h-[44px] row-between gap-three"
                  style={
                    index < items.length - 1
                      ? { borderBottomColor: colors.border, borderBottomWidth: 1 }
                      : undefined
                  }>
                  <Txt variant="body" weight="500" className="flex-1" numberOfLines={1}>
                    {product?.name ?? 'Zutat'}
                  </Txt>
                  <Txt variant="body" tone="secondary" weight="500">
                    {round(quantity)} {unit}
                  </Txt>
                </View>
              );
            })}
            {items.length === 0 ? (
              <Txt variant="body" tone="secondary" className="py-three">
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
        safeAreaClassName="flex-1 w-full max-w-[800px] self-center"
        header={{ title: 'Rezept', leading: <BackButton label="Zurück" variant="header" /> }}>
        <Txt variant="body" tone="secondary" className="p-six text-center">
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
      safeAreaClassName="flex-1 w-full max-w-[800px] self-center"
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
        className="flex-1"
        contentContainerClassName="px-four pb-[108px]"
        showsVerticalScrollIndicator={false}>
        {/* Rezept-Titelbild / Artwork */}
        <View className="h-[178px] -mx-four overflow-hidden">
          <HeroArtwork coverUrl={coverUrl} title={recipe.title} />
        </View>

        {/* Rezepttitel */}
        <Txt variant="title" weight="700" className="pt-[18px] tracking-tight">
          {recipe.title}
        </Txt>

        {/* Tab-Leiste (Details vs. Bewertungen) */}
        <View
          className="flex-row mt-five"
          style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
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
                className="flex-1 min-h-[48px] items-center justify-center border-b-[3px]"
                style={{ borderBottomColor: selected ? colors.accent : 'transparent' }}>
                <Txt variant="heading" tone={selected ? 'primary' : 'secondary'}>
                  {label}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'details' ? (
          <View>
            {/* Basis-Fakten (Kalorien, Zubereitungszeit, Schwierigkeitsgrad) */}
            <View
              className="flex-row py-four"
              style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
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
              <Txt variant="body" weight="500" className="pt-four">
                {recipe.instructions}
              </Txt>
            ) : null}

            {/* Kategorien- und Hashtags */}
            {tags.length > 0 ? (
              <View className="flex-row flex-wrap items-center gap-x-three gap-y-two pt-three">
                {visibleTags.map((tag) => (
                  <Txt key={tag} variant="caption" tone="secondary" weight="500">
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </Txt>
                ))}
                {tags.length > 3 ? (
                  <Pressable
                    onPress={() => setShowAllTags((visible) => !visible)}
                    role="button"
                    aria-label={showAllTags ? 'Weniger Tags anzeigen' : 'Alle Tags anzeigen'}
                    aria-expanded={showAllTags}
                    hitSlop={8}>
                    <Txt variant="caption" tone="secondary" className="underline" weight="500">
                      {showAllTags ? 'Weniger' : `+${tags.length - 3} mehr`}
                    </Txt>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Zutaten-Kopf mit Portionsrechner-Stepper (+ / -) */}
            <View
              className="min-h-[58px] row-between gap-three mt-[18px]"
              style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
              <Txt variant="heading">Zutaten</Txt>
              <View
                className="w-[156px] h-[44px] rounded-control flex-row items-center"
                style={{ backgroundColor: colors.backgroundElement }}>
                <Pressable
                  onPress={() => setServings((value) => Math.max(1, value - 1))}
                  role="button"
                  aria-label="Weniger Portionen"
                  className="w-[44px] h-[44px] items-center justify-center">
                  <Txt variant="subheading" tone="secondary" weight="500">
                    −
                  </Txt>
                </Pressable>
                <Txt variant="body" weight="700" className="flex-1 text-center">
                  {servings} Portionen
                </Txt>
                <Pressable
                  onPress={() => setServings((value) => value + 1)}
                  role="button"
                  aria-label="Mehr Portionen"
                  className="w-[44px] h-[44px] items-center justify-center">
                  <Txt variant="subheading" tone="secondary" weight="500">
                    +
                  </Txt>
                </Pressable>
              </View>
            </View>

            {/* Zutatenliste nach Komponenten gegliedert */}
            <IngredientGroups data={data} servings={servings} />

            {/* Button zur Übernahme fehlender Zutaten in die Einkaufsliste */}
            <Pressable
              role="button"
              aria-label="Fehlende Zutaten zur Einkaufsliste hinzufügen"
              onPress={() => setShoppingOpen(true)}
              className="min-h-[48px] mt-four rounded-control items-center justify-center px-three active:opacity-75"
              style={{ borderColor: colors.border, borderWidth: 1 }}>
              <Txt variant="heading" tone="primary" center>
                Fehlende Zutaten zur Einkaufsliste
              </Txt>
            </Pressable>

            {/* Nährwerttabelle (kcal, Protein, Kohlenhydrate, Fett) */}
            {scaledServing ? (
              <View
                className="flex-row mt-four"
                style={{
                  borderTopColor: colors.border,
                  borderTopWidth: 1,
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                }}>
                <NutritionStat value={String(round(scaledServing.kcal))} label="kcal" />
                <NutritionStat value={`${round(scaledServing.protein_g)} g`} label="Protein" />
                <NutritionStat value={`${round(scaledServing.carbs_g)} g`} label="Kohlenhydrate" />
                <NutritionStat value={`${round(scaledServing.fat_g)} g`} label="Fett" />
              </View>
            ) : null}

            {/* Zubereitungsschritte mit Bildern und Text */}
            <View
              className="min-h-[58px] row-between gap-three mt-[18px]"
              style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
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
              <Txt variant="body" tone="secondary" className="py-four">
                Noch keine Zubereitungsschritte hinterlegt.
              </Txt>
            )}
          </View>
        ) : (
          /* Bewertungen & Notizen Tab */
          <View className="pt-[22px]">
            {rating ? (
              <>
                {/* Anzeige der eigenen Punktebewertung */}
                <View
                  className="min-h-[58px] row-between gap-four pb-four"
                  style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
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
                    <Txt variant="heading" className="pt-five">
                      Deine Notiz
                    </Txt>
                    <Txt variant="body" weight="500" className="pt-two">
                      {rating.note}
                    </Txt>
                  </>
                ) : null}
              </>
            ) : (
              /* Leerzustand für Bewertungen */
              <View className="items-center py-six">
                <Txt variant="heading">Noch keine Bewertung</Txt>
                <Txt variant="body" tone="secondary" weight="500" className="pt-[6px] text-center">
                  Halte fest, wie dir dieses Rezept gefallen hat.
                </Txt>
              </View>
            )}
            {/* Button zum Erstellen/Bearbeiten der Bewertung */}
            <Pressable
              onPress={() => setRatingOpen(true)}
              role="button"
              aria-label={rating ? 'Bewertung bearbeiten' : 'Rezept bewerten'}
              className="min-h-[48px] mt-five rounded-control items-center justify-center px-four active:opacity-75"
              style={{ backgroundColor: colors.accent }}>
              <Txt variant="heading" tone="onAccent">
                {rating ? 'Bewertung bearbeiten' : 'Rezept bewerten'}
              </Txt>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Fixierter Floating-Button zum Starten des Kochmodus */}
      <View className="absolute left-[15px] right-[15px] bottom-three">
        <Pressable
          onPress={() => router.push({ pathname: '/recipe/cook', params: { id: recipe.id } })}
          role="button"
          aria-label="Kochmodus starten"
          className="min-h-[48px] self-center rounded-control items-center justify-center px-six active:opacity-75"
          style={{ backgroundColor: colors.accent }}>
          <Txt variant="heading" tone="onAccent">
            Kochmodus starten
          </Txt>
        </Pressable>
      </View>

      {/* Aktions-Modal zur Rezeptverwaltung (Bearbeiten, Teilen, Löschen) */}
      <Modal
        visible={manageOpen}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setManageOpen(false)}>
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.scrim }}
          onPress={() => setManageOpen(false)}>
          <Pressable
            className="rounded-t-fam-large px-four pt-[10px] pb-[19px]"
            style={{ backgroundColor: colors.backgroundElement }}
            onPress={() => {}}>
            <View className="w-[38px] h-1 rounded-sm self-center bg-border" />
            <View className="min-h-[58px] pt-[13px] row-between gap-three">
              <Txt variant="heading" weight="700">
                Rezept verwalten
              </Txt>
              <Pressable
                onPress={() => setManageOpen(false)}
                role="button"
                aria-label="Schließen"
                className="w-8 h-8 rounded-control items-center justify-center"
                style={{ backgroundColor: colors.backgroundSoft }}>
                <Txt variant="heading" tone="secondary">
                  ×
                </Txt>
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
