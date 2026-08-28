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
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton, HeaderIconButton } from '@/components/ui/buttons';
import { HeartGlyph, HeroArtwork } from './components/recipe-detail-primitives';
import { RecipeRatingSheet } from './components/recipe-rating-sheet';
import { RecipeShoppingSheet } from './components/recipe-shopping-sheet';
import { StepMentionText } from './components/step-mention-text';
import { flattenRecipeItems, type MentionableIngredient } from './ingredient-mentions';
import { calculateServingNutrition, scaleServing } from './nutrition';
import { useRecipeFavorites } from './recipe-favorites';
import { useRecipeCoverUrl, useRecipeStepImageUrl } from './recipe-image-uploader';
import { useRecipeRating } from './recipe-ratings';
import {
  type RecipeDetail,
  type RecipeStep,
  useDeleteRecipeMutation,
  useRecipeDetail,
} from './use-recipes';
import {
  DIETARY_TAG_LABELS,
  DIFFICULTY_LABELS,
  DISH_TYPE_LABELS,
} from './wizard/recipe-metadata-options';

function round(value: number): number {
  return Math.round(value);
}

function MoreGlyph() {
  return (
    <ThemedText className="text-[13px] leading-[16px] font-extrabold tracking-widest">
      •••
    </ThemedText>
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
  return (
    <View
      className={`flex-1 min-w-0 items-center px-one ${withDivider ? 'border-l border-border' : ''}`}>
      <ThemedText type="headingSmall" className="text-center">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" className="pt-[3px] text-center">
        {label}
      </ThemedText>
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
  const { data: imageUrl } = useRecipeStepImageUrl(step.image_path);

  return (
    <View className={`gap-three py-four ${!isLast ? 'border-b border-border' : ''}`}>
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
        <ThemedText type="headingSmall" themeColor="accent" className="w-[30px]">
          {index + 1}
        </ThemedText>
        <View className="flex-1 gap-one">
          <StepMentionText
            text={step.text}
            ingredients={ingredients}
            type="body"
            className="font-medium"
          />
          {step.timer_minutes !== null ? (
            <ThemedText type="caption" themeColor="textSecondary">
              ⏱ {step.timer_minutes} Min. Timer
            </ThemedText>
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
      <ThemedText type="headingSmall">{value}</ThemedText>
      <ThemedText
        type="detail"
        themeColor="textSecondary"
        className="pt-[3px] text-[11px] leading-[15px] font-medium">
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
  return (
    <Pressable
      onPress={onPress}
      role="button"
      className={`min-h-[45px] justify-center px-[6px] active:opacity-75 ${!isLast ? 'border-b border-border' : ''}`}>
      <ThemedText
        type="detail"
        themeColor={danger ? 'danger' : 'text'}
        className="text-[10px] leading-[13px] font-medium">
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Zutatenliste gegliedert nach Komponenten (z.B. „Teig“, „Belag“).
 * Mengen werden mit dem Portionsfaktor multipliziert; Produkte liefern
 * den Anzeigenamen, sonst Fallback „Zutat“.
 */
function IngredientGroups({ data, servings }: { data: RecipeDetail; servings: number }) {
  const groups = data.components.filter((component) => component.serving_grams !== null);

  if (groups.length === 0) {
    return (
      <ThemedText type="body" themeColor="textSecondary" className="py-four">
        Noch keine Zutaten hinterlegt.
      </ThemedText>
    );
  }

  return (
    <View className="gap-[18px]">
      {groups.map((component) => {
        const items = data.items.filter((item) => item.component_id === component.id);
        const preparedGrams = (component.serving_grams ?? 0) * servings;

        return (
          <View key={component.id} className="pt-[14px]">
            <View className="min-h-[40px] row-between gap-[10px] border-b border-border">
              <ThemedText type="headingSmall" className="flex-1">
                {component.name}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
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
                  className={`min-h-[44px] row-between gap-three ${
                    index < items.length - 1 ? 'border-b border-border' : ''
                  }`}>
                  <ThemedText type="body" className="flex-1 font-medium" numberOfLines={1}>
                    {product?.name ?? 'Zutat'}
                  </ThemedText>
                  <ThemedText type="body" themeColor="textSecondary" className="font-medium">
                    {round(quantity)} {unit}
                  </ThemedText>
                </View>
              );
            })}
            {items.length === 0 ? (
              <ThemedText type="body" themeColor="textSecondary" className="py-three">
                Noch keine Zutaten in dieser Gruppe.
              </ThemedText>
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
        <ThemedText type="body" themeColor="textSecondary" className="p-six text-center">
          Rezept wird geladen…
        </ThemedText>
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
        <ThemedText
          type="subtitle"
          className="pt-[18px] text-[28px] leading-[32px] font-bold tracking-tight">
          {recipe.title}
        </ThemedText>

        {/* Tab-Leiste (Details vs. Bewertungen) */}
        <View className="flex-row mt-five border-b border-border">
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
                className={`flex-1 min-h-[48px] items-center justify-center border-b-[3px] ${
                  selected ? 'border-accent' : 'border-transparent'
                }`}>
                <ThemedText type="headingSmall" themeColor={selected ? 'text' : 'textSecondary'}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'details' ? (
          <View>
            {/* Basis-Fakten (Kalorien, Zubereitungszeit, Schwierigkeitsgrad) */}
            <View className="flex-row py-four border-b border-border">
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
              <ThemedText type="body" className="pt-four text-[16px] leading-[24px] font-medium">
                {recipe.instructions}
              </ThemedText>
            ) : null}

            {/* Kategorien- und Hashtags */}
            {tags.length > 0 ? (
              <View className="flex-row flex-wrap items-center gap-x-three gap-y-two pt-three">
                {visibleTags.map((tag) => (
                  <ThemedText
                    key={tag}
                    type="caption"
                    themeColor="textSecondary"
                    className="font-medium">
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
                    <ThemedText
                      type="caption"
                      themeColor="textSecondary"
                      className="font-medium underline">
                      {showAllTags ? 'Weniger' : `+${tags.length - 3} mehr`}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Zutaten-Kopf mit Portionsrechner-Stepper (+ / -) */}
            <View className="min-h-[58px] row-between gap-three mt-[18px] border-b border-border">
              <ThemedText type="headingSmall">Zutaten</ThemedText>
              <View className="w-[156px] h-[44px] rounded-control flex-row items-center bg-background-element">
                <Pressable
                  onPress={() => setServings((value) => Math.max(1, value - 1))}
                  role="button"
                  aria-label="Weniger Portionen"
                  className="w-[44px] h-[44px] items-center justify-center">
                  <ThemedText type="headingSmall" themeColor="accent" className="font-medium">
                    −
                  </ThemedText>
                </Pressable>
                <ThemedText type="body" className="flex-1 text-center font-bold">
                  {servings} Portionen
                </ThemedText>
                <Pressable
                  onPress={() => setServings((value) => value + 1)}
                  role="button"
                  aria-label="Mehr Portionen"
                  className="w-[44px] h-[44px] items-center justify-center">
                  <ThemedText type="headingSmall" themeColor="accent" className="font-medium">
                    +
                  </ThemedText>
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
              className="min-h-[48px] mt-four border border-border rounded-control items-center justify-center px-three active:opacity-75">
              <ThemedText type="headingSmall" themeColor="accent" className="text-center">
                Fehlende Zutaten zur Einkaufsliste
              </ThemedText>
            </Pressable>

            {/* Nährwerttabelle (kcal, Protein, Kohlenhydrate, Fett) */}
            {scaledServing ? (
              <View className="flex-row mt-four border-t border-b border-border">
                <NutritionStat value={String(round(scaledServing.kcal))} label="kcal" />
                <NutritionStat value={`${round(scaledServing.protein_g)} g`} label="Protein" />
                <NutritionStat value={`${round(scaledServing.carbs_g)} g`} label="Kohlenhydrate" />
                <NutritionStat value={`${round(scaledServing.fat_g)} g`} label="Fett" />
              </View>
            ) : null}

            {/* Zubereitungsschritte mit Bildern und Text */}
            <View className="min-h-[58px] row-between gap-three mt-[18px] border-b border-border">
              <ThemedText type="headingSmall">Zubereitung</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" className="font-medium">
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
                    ingredients={mentionIngredients}
                  />
                ))}
              </View>
            ) : (
              <ThemedText type="body" themeColor="textSecondary" className="py-four">
                Noch keine Zubereitungsschritte hinterlegt.
              </ThemedText>
            )}
          </View>
        ) : (
          /* Bewertungen & Notizen Tab */
          <View className="pt-[22px]">
            {rating ? (
              <>
                {/* Anzeige der eigenen Punktebewertung */}
                <View className="min-h-[58px] row-between gap-four pb-four border-b border-border">
                  <ThemedText type="subtitle" className="text-[28px] leading-[34px] font-bold">
                    ★ {rating.score}{' '}
                    <ThemedText type="headingSmall" themeColor="textSecondary">
                      / 10
                    </ThemedText>
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary" className="font-medium">
                    Deine Bewertung
                  </ThemedText>
                </View>
                {/* Eigene persönliche Notiz zum Rezept */}
                {rating.note ? (
                  <>
                    <ThemedText type="headingSmall" className="pt-five">
                      Deine Notiz
                    </ThemedText>
                    <ThemedText
                      type="body"
                      className="pt-two text-[16px] leading-[24px] font-medium">
                      {rating.note}
                    </ThemedText>
                  </>
                ) : null}
              </>
            ) : (
              /* Leerzustand für Bewertungen */
              <View className="items-center py-six">
                <ThemedText type="headingSmall">Noch keine Bewertung</ThemedText>
                <ThemedText
                  type="body"
                  themeColor="textSecondary"
                  className="pt-[6px] text-[15px] leading-[22px] font-medium text-center">
                  Halte fest, wie dir dieses Rezept gefallen hat.
                </ThemedText>
              </View>
            )}
            {/* Button zum Erstellen/Bearbeiten der Bewertung */}
            <Pressable
              onPress={() => setRatingOpen(true)}
              role="button"
              aria-label={rating ? 'Bewertung bearbeiten' : 'Rezept bewerten'}
              className="min-h-[48px] mt-five rounded-control items-center justify-center px-four bg-accent active:opacity-75">
              <ThemedText type="headingSmall" className="text-white">
                {rating ? 'Bewertung bearbeiten' : 'Rezept bewerten'}
              </ThemedText>
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
          className="min-h-[48px] self-center rounded-control items-center justify-center px-six bg-accent active:opacity-75">
          <ThemedText type="headingSmall" className="text-white">
            Kochmodus starten
          </ThemedText>
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
          className="flex-1 justify-end bg-[#261F27]/30"
          onPress={() => setManageOpen(false)}>
          <Pressable
            className="rounded-t-fam-large px-four pt-[10px] pb-[19px] bg-background-element"
            onPress={() => {}}>
            <View className="w-[38px] h-1 rounded-sm self-center bg-border" />
            <View className="min-h-[58px] pt-[13px] row-between gap-three">
              <ThemedText type="headingSmall" className="font-bold">
                Rezept verwalten
              </ThemedText>
              <Pressable
                onPress={() => setManageOpen(false)}
                role="button"
                aria-label="Schließen"
                className="w-8 h-8 rounded-control items-center justify-center bg-background-selected">
                <ThemedText type="headingSmall" themeColor="accent">
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
