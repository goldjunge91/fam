import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton, HeaderIconButton } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { HeartGlyph, HeroArtwork } from '@/features/recipes/components/recipe-detail-primitives';
import { useRecipeFavorites } from '@/features/recipes/domain/recipe-favorites';
import type { DietaryTag, DishType } from '@/features/recipes/data/use-recipes';
import {
  DIETARY_TAG_LABELS,
  DIFFICULTY_LABELS,
  DISH_TYPE_LABELS,
} from '@/features/recipes/wizard/recipe-metadata-options';
import { useCatalogImageUrl, useCatalogRecipe, useCopyCatalogRecipeMutation } from './use-recipe-catalog';
import type { CatalogDetail, CatalogStep } from './use-recipe-catalog';

function round(value: number): number {
  return Math.round(value);
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

function CatalogStepItem({
  step,
  index,
  isLast,
  imagePath,
}: {
  step: CatalogStep;
  index: number;
  isLast: boolean;
  imagePath: string | null;
}) {
  const { data: imageUrl } = useCatalogImageUrl(imagePath);

  return (
    <View className={`gap-three py-four ${!isLast ? 'border-b border-border' : ''}`}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          contentFit="cover"
          accessibilityLabel={`Bild für Schritt ${index + 1}`}
          style={{ width: '100%', height: 180, borderRadius: 16 }}
        />
      ) : null}
      <View className="flex-row gap-[10px]">
        <ThemedText type="headingSmall" themeColor="accent" className="w-[30px]">
          {index + 1}
        </ThemedText>
        <View className="flex-1 gap-one">
          <ThemedText type="body" className="font-medium">
            {step.text}
          </ThemedText>
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

function IngredientGroups({ detail, servings }: { detail: CatalogDetail; servings: number }) {
  const componentNames = new Map(detail.components.map((component) => [component.id, component.name]));

  if (detail.components.length === 0) {
    return (
      <ThemedText type="body" themeColor="textSecondary" className="py-four">
        Noch keine Zutaten hinterlegt.
      </ThemedText>
    );
  }

  return (
    <View className="gap-[18px]">
      {detail.components.map((component) => {
        const items = detail.items.filter((item) => item.component_id === component.id);
        const preparedGrams = (component.serving_grams ?? 0) * servings;

        return (
          <View key={component.id} className="pt-[14px]">
            <View className="min-h-[40px] row-between gap-[10px] border-b border-border">
              <ThemedText type="headingSmall" className="flex-1 font-bold">
                {component.name}
              </ThemedText>
              {component.serving_grams !== null ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {round(preparedGrams)} g zubereitet
                </ThemedText>
              ) : null}
            </View>
            {items.map((item, index) => {
              const product = item.product_id ? detail.productsById.get(item.product_id) : undefined;
              const name =
                product?.name ??
                item.ingredient_name ??
                (item.sub_component_id ? componentNames.get(item.sub_component_id) : undefined) ??
                'Zutat';
              const quantity = (item.quantity !== null ? item.quantity : item.grams) * servings;
              const unit = item.quantity !== null ? item.unit : 'g';

              return (
                <View
                  key={item.id}
                  className={`min-h-[44px] row-between gap-three ${
                    index < items.length - 1 ? 'border-b border-border' : ''
                  }`}>
                  <ThemedText
                    type="body"
                    className="flex-1 text-[17px] leading-[23px] font-bold"
                    numberOfLines={1}>
                    {name}
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

export function RecipeCatalogDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [servings, setServings] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'ratings'>('details');
  const [showAllTags, setShowAllTags] = useState(false);
  const { activeHouseholdId } = useActiveHousehold();
  const { session } = useSession();
  const { data: detail, isLoading } = useCatalogRecipe(slug);
  const copyRecipe = useCopyCatalogRecipeMutation();
  const { isFavorite, toggleFavorite } = useRecipeFavorites();
  const coverPath = detail?.recipe.cover_image_path ?? detail?.images[0]?.storage_path;
  const { data: coverUrl } = useCatalogImageUrl(coverPath);

  async function copyToHousehold() {
    if (!detail || !activeHouseholdId || !session?.user.id) return;
    try {
      const recipe = await copyRecipe.mutateAsync(detail);
      router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
    } catch (error: unknown) {
      Alert.alert(
        'Rezept konnte nicht übernommen werden',
        error instanceof Error ? error.message : 'Bitte versuche es erneut.',
      );
    }
  }

  if (isLoading || !detail) {
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

  const { recipe } = detail;
  const currentServings = servings ?? recipe.default_servings;
  const scale = currentServings / Math.max(1, recipe.default_servings);
  const kcalPer100g =
    detail.nutrition.grams > 0 ? round((detail.nutrition.kcal / detail.nutrition.grams) * 100) : null;
  const tags = Array.from(
    new Set([
      ...recipe.dish_types.map((tag) => DISH_TYPE_LABELS[tag as DishType] ?? tag),
      ...recipe.dietary_tags.map((tag) => DIETARY_TAG_LABELS[tag as DietaryTag] ?? tag),
      ...recipe.hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)),
    ]),
  );
  const visibleTags = showAllTags ? tags : tags.slice(0, 3);
  const favoriteKey = `catalog:${recipe.id}` as const;
  const favorite = isFavorite(favoriteKey);
  const buttonDisabled = copyRecipe.isPending || !activeHouseholdId || !session;

  return (
    <HubScreen
      safeAreaClassName="flex-1 w-full max-w-[800px] self-center"
      header={{
        title: 'Rezept',
        leading: <BackButton label="Zurück" variant="header" />,
        trailing: (
          <HeaderIconButton
            label={favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
            onPress={() => void toggleFavorite(favoriteKey)}>
            <HeartGlyph filled={favorite} />
          </HeaderIconButton>
        ),
      }}>
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
                value={kcalPer100g !== null ? `${kcalPer100g} kcal` : '–'}
                label="pro 100 g"
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
                  <ThemedText key={tag} type="caption" themeColor="textSecondary" className="font-medium">
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
                    <ThemedText type="caption" themeColor="textSecondary" className="font-medium underline">
                      {showAllTags ? 'Weniger' : `+${tags.length - 3} mehr`}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View className="min-h-[58px] row-between gap-three mt-[18px] border-b border-border">
              <ThemedText type="headingSmall" className="font-bold">
                Zutatenliste
              </ThemedText>
              <View className="flex-row items-center gap-two">
                <ThemedText type="body" className="font-bold">
                  Portionen
                </ThemedText>
                <View className="w-[112px] h-[44px] rounded-control flex-row items-center bg-background-element">
                <Pressable
                  onPress={() => setServings((value) => Math.max(1, (value ?? currentServings) - 1))}
                  role="button"
                  aria-label="Weniger Portionen"
                  className="w-[44px] h-[44px] items-center justify-center">
                  <ThemedText type="headingSmall" themeColor="accent" className="font-medium">
                    −
                  </ThemedText>
                </Pressable>
                <ThemedText type="body" className="min-w-[24px] flex-1 text-center font-bold">
                  {currentServings}
                </ThemedText>
                <Pressable
                  onPress={() => setServings((value) => (value ?? currentServings) + 1)}
                  role="button"
                  aria-label="Mehr Portionen"
                  className="w-[44px] h-[44px] items-center justify-center">
                  <ThemedText type="headingSmall" themeColor="accent" className="font-medium">
                    +
                  </ThemedText>
                </Pressable>
                </View>
              </View>
            </View>

            <IngredientGroups detail={detail} servings={scale} />

            <View className="min-h-[58px] row-between gap-three mt-[18px] border-b border-border">
              <ThemedText type="headingSmall">Zubereitung</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" className="font-medium">
                {detail.steps.length} {detail.steps.length === 1 ? 'Schritt' : 'Schritte'}
              </ThemedText>
            </View>
            {detail.steps.length > 0 ? (
              <View>
                {detail.steps.map((step, index) => (
                  <CatalogStepItem
                    key={step.id}
                    step={step}
                    index={index}
                    isLast={index === detail.steps.length - 1}
                    imagePath={
                      detail.stepImages.find((image) => image.step_id === step.id)?.storage_path ??
                      null
                    }
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
          <View className="items-center py-six">
            <ThemedText type="headingSmall">Noch keine Bewertungen</ThemedText>
            <ThemedText type="body" themeColor="textSecondary" className="pt-[6px] text-center">
              Bewertungen sind für Katalogrezepte noch nicht verfügbar.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <View className="absolute left-[15px] right-[15px] bottom-three">
        <Pressable
          onPress={() => void copyToHousehold()}
          disabled={buttonDisabled}
          role="button"
          aria-label="Rezept in meine Rezepte übernehmen"
          className={`min-h-[48px] self-center rounded-control items-center justify-center px-six bg-accent active:opacity-75 ${
            buttonDisabled ? 'opacity-45' : ''
          }`}>
          {copyRecipe.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText type="headingSmall" className="text-white">
              In meine Rezepte übernehmen
            </ThemedText>
          )}
        </Pressable>
      </View>
    </HubScreen>
  );
}
