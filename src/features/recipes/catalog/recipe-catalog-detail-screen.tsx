import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton, HeaderIconButton } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { HeartGlyph, HeroArtwork } from '@/features/recipes/components/recipe-detail-primitives';
import { useRecipeFavorites } from '@/features/recipes/domain/recipe-favorites';
import type { DietaryTag, DishType } from '@/features/recipes/hooks/use-recipes';
import {
  DIETARY_TAG_LABELS,
  DIFFICULTY_LABELS,
  DISH_TYPE_LABELS,
} from '@/features/recipes/wizard/recipe-metadata-options';
import type { CatalogDetail, CatalogStep } from './use-recipe-catalog';
import {
  useCatalogImageUrl,
  useCatalogRecipe,
  useCopyCatalogRecipeMutation,
} from './use-recipe-catalog';

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
  const { colors } = useTheme();
  const { data: imageUrl } = useCatalogImageUrl(imagePath);

  return (
    <View
      className="gap-three py-four"
      style={!isLast ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : undefined}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          contentFit="cover"
          accessibilityLabel={`Bild für Schritt ${index + 1}`}
          style={{ width: '100%', height: 180, borderRadius: 16 }}
        />
      ) : null}
      <View className="flex-row gap-[10px]">
        <Txt variant="heading" tone="primary" className="w-[30px]">
          {index + 1}
        </Txt>
        <View className="flex-1 gap-one">
          <Txt variant="body" weight="500">
            {step.text}
          </Txt>
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

function IngredientGroups({ detail, servings }: { detail: CatalogDetail; servings: number }) {
  const { colors } = useTheme();
  const componentNames = new Map(
    detail.components.map((component) => [component.id, component.name]),
  );

  if (detail.components.length === 0) {
    return (
      <Txt variant="body" tone="secondary" className="py-four">
        Noch keine Zutaten hinterlegt.
      </Txt>
    );
  }

  return (
    <View className="gap-[18px]">
      {detail.components.map((component) => {
        const items = detail.items.filter((item) => item.component_id === component.id);
        const preparedGrams = (component.serving_grams ?? 0) * servings;

        return (
          <View key={component.id} className="pt-[14px]">
            <View
              className="min-h-[40px] row-between gap-[10px]"
              style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
              <Txt variant="heading" weight="700" className="flex-1">
                {component.name}
              </Txt>
              {component.serving_grams !== null ? (
                <Txt variant="caption" tone="secondary">
                  {round(preparedGrams)} g zubereitet
                </Txt>
              ) : null}
            </View>
            {items.map((item, index) => {
              const product = item.product_id
                ? detail.productsById.get(item.product_id)
                : undefined;
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
                  className="min-h-[44px] row-between gap-three"
                  style={
                    index < items.length - 1
                      ? { borderBottomColor: colors.border, borderBottomWidth: 1 }
                      : undefined
                  }>
                  <Txt variant="body" weight="700" className="flex-1" numberOfLines={1}>
                    {name}
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

export function RecipeCatalogDetailScreen() {
  const { colors } = useTheme();
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
        <Txt variant="body" tone="secondary" className="p-six text-center">
          Rezept wird geladen…
        </Txt>
      </HubScreen>
    );
  }

  const { recipe } = detail;
  const currentServings = servings ?? recipe.default_servings;
  const scale = currentServings / Math.max(1, recipe.default_servings);
  const kcalPer100g =
    detail.nutrition.grams > 0
      ? round((detail.nutrition.kcal / detail.nutrition.grams) * 100)
      : null;
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

        <Txt variant="title" weight="700" className="pt-[18px] tracking-tight">
          {recipe.title}
        </Txt>

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
            <View
              className="flex-row py-four"
              style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
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
              <Txt variant="body" className="pt-four" weight="500">
                {recipe.instructions}
              </Txt>
            ) : null}

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

            <View
              className="min-h-[58px] row-between gap-three mt-[18px]"
              style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
              <Txt variant="heading" weight="700">
                Zutatenliste
              </Txt>
              <View className="flex-row items-center gap-two">
                <Txt variant="body" weight="700">
                  Portionen
                </Txt>
                <View
                  className="w-[112px] h-[44px] rounded-control flex-row items-center"
                  style={{ backgroundColor: colors.backgroundElement }}>
                  <Pressable
                    onPress={() =>
                      setServings((value) => Math.max(1, (value ?? currentServings) - 1))
                    }
                    role="button"
                    aria-label="Weniger Portionen"
                    className="w-[44px] h-[44px] items-center justify-center">
                    <Txt variant="subheading" tone="secondary" weight="500">
                      −
                    </Txt>
                  </Pressable>
                  <Txt variant="body" weight="700" className="min-w-[24px] flex-1 text-center">
                    {currentServings}
                  </Txt>
                  <Pressable
                    onPress={() => setServings((value) => (value ?? currentServings) + 1)}
                    role="button"
                    aria-label="Mehr Portionen"
                    className="w-[44px] h-[44px] items-center justify-center">
                    <Txt variant="subheading" tone="secondary" weight="500">
                      +
                    </Txt>
                  </Pressable>
                </View>
              </View>
            </View>

            <IngredientGroups detail={detail} servings={scale} />

            <View
              className="min-h-[58px] row-between gap-three mt-[18px]"
              style={{ borderBottomColor: colors.border, borderBottomWidth: 1 }}>
              <Txt variant="heading">Zubereitung</Txt>
              <Txt variant="caption" tone="secondary" weight="500">
                {detail.steps.length} {detail.steps.length === 1 ? 'Schritt' : 'Schritte'}
              </Txt>
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
              <Txt variant="body" tone="secondary" className="py-four">
                Noch keine Zubereitungsschritte hinterlegt.
              </Txt>
            )}
          </View>
        ) : (
          <View className="items-center py-six">
            <Txt variant="heading">Noch keine Bewertungen</Txt>
            <Txt variant="body" tone="secondary" className="pt-[6px] text-center">
              Bewertungen sind für Katalogrezepte noch nicht verfügbar.
            </Txt>
          </View>
        )}
      </ScrollView>

      <View className="absolute left-[15px] right-[15px] bottom-three">
        <View className="flex-row gap-two">
          <Pressable
            onPress={() => router.push({ pathname: '/recipe/cook', params: { slug: recipe.slug } })}
            role="button"
            aria-label="Kochmodus starten"
            className="min-h-[48px] flex-1 rounded-control items-center justify-center px-two active:opacity-75"
            style={{
              backgroundColor: colors.backgroundElement,
              borderColor: colors.accent,
              borderWidth: 1,
            }}>
            <Txt variant="label" tone="primary" weight="700" center>
              Kochmodus starten
            </Txt>
          </Pressable>
          <Pressable
            onPress={() => void copyToHousehold()}
            disabled={buttonDisabled}
            role="button"
            aria-label="Rezept in meine Rezepte übernehmen"
            className="min-h-[48px] flex-1 rounded-control items-center justify-center px-two active:opacity-75"
            style={{ backgroundColor: colors.accent, opacity: buttonDisabled ? 0.45 : 1 }}>
            {copyRecipe.isPending ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Txt variant="label" tone="onAccent" weight="700" center>
                In meine Rezepte übernehmen
              </Txt>
            )}
          </Pressable>
        </View>
      </View>
    </HubScreen>
  );
}
