import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { borderWidth, radius, rs, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { Press, Txt } from '@/constants/ui';
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

const styles = StyleSheet.create((theme) => ({
  detailFact: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: theme.space.xs,
  },
  detailFactLabel: {
    paddingTop: theme.space.md,
    textAlign: 'center',
  },
  step: {
    gap: theme.space.lg,
    paddingVertical: theme.space.xxl,
  },
  stepContent: {
    flexDirection: 'row',
    gap: theme.space.md,
  },
  stepIndex: {
    width: 30,
  },
  stepCopy: {
    flex: 1,
    gap: theme.space.xs,
  },
  ingredients: {
    gap: theme.space.xl,
  },
  ingredientGroup: {
    paddingTop: theme.space.lg,
  },
  ingredientHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  ingredientTitle: {
    flex: 1,
  },
  ingredientRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
  },
  ingredientName: {
    flex: 1,
  },
  emptyText: {
    paddingVertical: theme.space.xxl,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.space.xxl,
    paddingBottom: theme.space.xxxxl * 2,
  },
  hero: {
    height: 178,
    marginHorizontal: -rs(24),
    overflow: 'hidden',
  },
  title: {
    paddingTop: theme.space.xl,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: theme.space.xxl,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  facts: {
    flexDirection: 'row',
    paddingVertical: theme.space.xxl,
    borderBottomWidth: 1,
  },
  instructions: {
    paddingTop: theme.space.xxl,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.space.lg,
    rowGap: theme.space.sm,
    paddingTop: theme.space.lg,
  },
  tagMore: {
    textDecorationLine: 'underline',
  },
  ingredientsHeading: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
    marginTop: theme.space.xl,
    borderBottomWidth: 1,
  },
  servingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  stepper: {
    width: 112,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.sm,
  },
  stepperButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    minWidth: 24,
    textAlign: 'center',
  },
  preparationHeading: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
    marginTop: theme.space.xl,
    borderBottomWidth: 1,
  },
  reviewsEmpty: {
    alignItems: 'center',
    paddingVertical: theme.space.xxxl,
  },
  reviewHint: {
    paddingTop: theme.space.md,
  },
  footer: {
    position: 'absolute',
    left: space.lg - space.xs / 4,
    right: space.lg - space.xs / 4,
    bottom: theme.space.lg,
  },
  footerActions: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  footerPress: {
    flex: 1,
  },
  footerButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  loading: {
    padding: theme.space.xxxl,
    textAlign: 'center',
  },
}));

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
        withDivider ? { borderLeftColor: colors.border, borderLeftWidth: 1 } : undefined,
      ]}>
      <Txt variant="heading" center>
        {value}
      </Txt>
      <Txt variant="caption" tone="secondary" style={styles.detailFactLabel}>
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
      style={[
        styles.step,
        !isLast ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : undefined,
      ]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          contentFit="cover"
          accessibilityLabel={`Bild für Schritt ${index + 1}`}
          style={{ width: '100%', height: 180, borderRadius: radius.md }}
        />
      ) : null}
      <View style={styles.stepContent}>
        <Txt variant="heading" tone="primary" style={styles.stepIndex}>
          {index + 1}
        </Txt>
        <View style={styles.stepCopy}>
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
      <Txt variant="body" tone="secondary" style={styles.emptyText}>
        Noch keine Zutaten hinterlegt.
      </Txt>
    );
  }

  return (
    <View style={styles.ingredients}>
      {detail.components.map((component) => {
        const items = detail.items.filter((item) => item.component_id === component.id);
        const preparedGrams = (component.serving_grams ?? 0) * servings;

        return (
          <View key={component.id} style={styles.ingredientGroup}>
            <View
              style={[
                styles.ingredientHeader,
                { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}>
              <Txt variant="heading" weight="700" style={styles.ingredientTitle}>
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
                  style={[
                    styles.ingredientRow,
                    index < items.length - 1
                      ? { borderBottomColor: colors.border, borderBottomWidth: 1 }
                      : undefined,
                  ]}>
                  <Txt variant="body" weight="700" style={styles.ingredientName} numberOfLines={1}>
                    {name}
                  </Txt>
                  <Txt variant="body" tone="secondary" weight="500">
                    {round(quantity)} {unit}
                  </Txt>
                </View>
              );
            })}
            {items.length === 0 ? (
              <Txt variant="body" tone="secondary" style={styles.emptyText}>
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
        header={{ title: 'Rezept', leading: <BackButton label="Zurück" variant="header" /> }}>
        <Txt variant="body" tone="secondary" style={styles.loading}>
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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <HeroArtwork coverUrl={coverUrl} title={recipe.title} />
        </View>

        <Txt variant="title" weight="700" style={styles.title}>
          {recipe.title}
        </Txt>

        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
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
                containerStyle={styles.footerPress}
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
            <View style={[styles.facts, { borderBottomColor: colors.border }]}>
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
              <Txt variant="body" style={styles.instructions} weight="500">
                {recipe.instructions}
              </Txt>
            ) : null}

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

            <View style={[styles.ingredientsHeading, { borderBottomColor: colors.border }]}>
              <Txt variant="heading" weight="700">
                Zutatenliste
              </Txt>
              <View style={styles.servingLabel}>
                <Txt variant="body" weight="700">
                  Portionen
                </Txt>
                <View style={[styles.stepper, { backgroundColor: colors.backgroundElement }]}>
                  <Press
                    onPress={() =>
                      setServings((value) => Math.max(1, (value ?? currentServings) - 1))
                    }
                    role="button"
                    aria-label="Weniger Portionen"
                    style={styles.stepperButton}>
                    <Txt variant="subheading" tone="secondary" weight="500">
                      −
                    </Txt>
                  </Press>
                  <Txt variant="body" weight="700" style={styles.stepperValue}>
                    {currentServings}
                  </Txt>
                  <Press
                    onPress={() => setServings((value) => (value ?? currentServings) + 1)}
                    role="button"
                    aria-label="Mehr Portionen"
                    style={styles.stepperButton}>
                    <Txt variant="subheading" tone="secondary" weight="500">
                      +
                    </Txt>
                  </Press>
                </View>
              </View>
            </View>

            <IngredientGroups detail={detail} servings={scale} />

            <View style={[styles.preparationHeading, { borderBottomColor: colors.border }]}>
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
              <Txt variant="body" tone="secondary" style={styles.emptyText}>
                Noch keine Zubereitungsschritte hinterlegt.
              </Txt>
            )}
          </View>
        ) : (
          <View style={styles.reviewsEmpty}>
            <Txt variant="heading">Noch keine Bewertungen</Txt>
            <Txt variant="body" tone="secondary" style={styles.reviewHint} center>
              Bewertungen sind für Katalogrezepte noch nicht verfügbar.
            </Txt>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerActions}>
          <Press
            onPress={() => router.push({ pathname: '/recipe/cook', params: { slug: recipe.slug } })}
            role="button"
            aria-label="Kochmodus starten"
            containerStyle={styles.footerPress}
            style={[
              styles.footerButton,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: colors.accent,
                borderWidth: borderWidth.base,
              },
            ]}>
            <Txt variant="label" tone="primary" weight="700" center>
              Kochmodus starten
            </Txt>
          </Press>
          <Press
            onPress={() => void copyToHousehold()}
            disabled={buttonDisabled}
            role="button"
            aria-label="Rezept in meine Rezepte übernehmen"
            containerStyle={styles.footerPress}
            style={[
              styles.footerButton,
              { backgroundColor: colors.accent, opacity: buttonDisabled ? 0.45 : 1 },
            ]}>
            {copyRecipe.isPending ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Txt variant="label" tone="onAccent" weight="700" center>
                In meine Rezepte übernehmen
              </Txt>
            )}
          </Press>
        </View>
      </View>
    </HubScreen>
  );
}
