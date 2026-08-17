import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { ThemedText } from '@/components/themed-text';
import { BackButton, HeaderIconButton } from '@/components/ui/buttons';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { RecipeRatingSheet } from './components/recipe-rating-sheet';
import { RecipeShoppingSheet } from './components/recipe-shopping-sheet';
import { calculateServingNutrition, scaleServing } from './nutrition';
import { useRecipeFavorites } from './recipe-favorites';
import { useRecipeCoverUrl, useRecipeStepImageUrl } from './recipe-image-uploader';
import { useRecipeRating } from './recipe-ratings';
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

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <ThemedText themeColor="accent" className="text-[24px] leading-[27px] font-medium">
      {filled ? '♥' : '♡'}
    </ThemedText>
  );
}

function MoreGlyph() {
  return (
    <ThemedText className="text-[13px] leading-[16px] font-extrabold tracking-widest">
      •••
    </ThemedText>
  );
}

function HeroArtwork({ coverUrl, title }: { coverUrl?: string | null; title: string }) {
  if (coverUrl) {
    return (
      <Image
        source={{ uri: coverUrl }}
        // expo-image benötigt absoluteFill inline
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
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

function RecipeStepItem({
  step,
  index,
  isLast,
}: {
  step: RecipeStep;
  index: number;
  isLast: boolean;
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
        <ThemedText type="body" className="flex-1 font-medium">
          {step.text}
        </ThemedText>
      </View>
    </View>
  );
}

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

export function RecipeDetailScreen() {
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
      <View className="flex-1">
        <GradientBackground {...hubGradient} />
        <SafeAreaView
          className="flex-1 w-full max-w-[800px] self-center"
          edges={['top', 'left', 'right']}>
          <PageHeader title="Rezept" leading={<BackButton label="Zurück" variant="header" />} />
          <ThemedText type="body" themeColor="textSecondary" className="p-six text-center">
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
    <View className="flex-1">
      <GradientBackground {...hubGradient} />
      <SafeAreaView
        className="flex-1 w-full max-w-[800px] self-center"
        edges={['top', 'left', 'right']}>
        <PageHeader
          title="Rezept"
          leading={<BackButton label="Zurück" variant="header" />}
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
          className="flex-1"
          contentContainerClassName="px-four pb-[108px]"
          showsVerticalScrollIndicator={false}>
          <View className="h-[178px] -mx-four overflow-hidden">
            <HeroArtwork coverUrl={coverUrl} title={recipe.title} />
          </View>

          <ThemedText
            type="subtitle"
            className="pt-[18px] text-[28px] leading-[32px] font-bold tracking-tight">
            {recipe.title}
          </ThemedText>

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

              {recipe.instructions ? (
                <ThemedText type="body" className="pt-four text-[16px] leading-[24px] font-medium">
                  {recipe.instructions}
                </ThemedText>
              ) : null}

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

              <IngredientGroups data={data} servings={servings} />

              <Pressable
                role="button"
                aria-label="Fehlende Zutaten zur Einkaufsliste hinzufügen"
                onPress={() => setShoppingOpen(true)}
                className="min-h-[48px] mt-four border border-border rounded-control items-center justify-center px-three active:opacity-75">
                <ThemedText type="headingSmall" themeColor="accent" className="text-center">
                  Fehlende Zutaten zur Einkaufsliste
                </ThemedText>
              </Pressable>

              {scaledServing ? (
                <View className="flex-row mt-four border-t border-b border-border">
                  <NutritionStat value={String(round(scaledServing.kcal))} label="kcal" />
                  <NutritionStat value={`${round(scaledServing.protein_g)} g`} label="Protein" />
                  <NutritionStat
                    value={`${round(scaledServing.carbs_g)} g`}
                    label="Kohlenhydrate"
                  />
                  <NutritionStat value={`${round(scaledServing.fat_g)} g`} label="Fett" />
                </View>
              ) : null}

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
            <View className="pt-[22px]">
              {rating ? (
                <>
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
