import { FlashList } from '@shopify/flash-list';
import { type Href, router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { HubScreen } from '@/components/layout/hub-screen';
import { space } from '@/components/theme/index';
import { Press, SectionHeading, Txt } from '@/constants/ui';
import { RecipePreviewCard } from '../components/recipe-preview-card';
import { type Difficulty, getDifficultyLabel } from '../wizard/recipe-metadata-options';
import { getCatalogCoverPath } from './recipe-catalog-image';
import { type CatalogRecipe, useCatalogRecipes } from './use-recipe-catalog';

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxxxl },
  separator: { height: space.md },
  footer: { paddingVertical: space.xl },
});

function CardSeparator() {
  return <View style={styles.separator} />;
}

function catalogDifficultyLabel(t: TFunction, value: string | null | undefined): string | null {
  switch (value) {
    case 'easy':
    case 'medium':
    case 'hard':
      return getDifficultyLabel(t, value as Difficulty);
    default:
      return value ?? null;
  }
}

export function RecipeCatalogScreen() {
  const { t } = useTranslation();
  const {
    data: recipes = [],
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useCatalogRecipes();

  function loadMoreRecipes() {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }

  const renderItem = useCallback(
    ({ item }: { item: CatalogRecipe }) => (
      <RecipePreviewCard
        title={item.title}
        coverImagePath={getCatalogCoverPath(item)}
        coverSource="catalog"
        cookTimeMinutes={item.cook_time_minutes}
        difficultyLabel={catalogDifficultyLabel(t, item.difficulty)}
        servings={item.default_servings}
        onPress={() => router.push(`/recipe/catalog/${item.slug}` as Href)}
      />
    ),
    [t],
  );

  const keyExtractor = useCallback((item: CatalogRecipe) => item.id, []);

  return (
    <HubScreen
      header={{
        title: t('recipes.catalog.title'),
        align: 'center',
        leading: (
          <Press onPress={() => router.back()}>
            <Txt variant="body">{t('recipes.catalog.back')}</Txt>
          </Press>
        ),
      }}>
      {/* Virtualisiert: nur sichtbare Karten laden ihr Coverbild, sonst kippt
          der Katalog das Speicherbudget des Geräts. */}
      <FlashList
        data={recipes}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={CardSeparator}
        style={styles.list}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <SectionHeading title={t('recipes.catalog.heading')} titleVariant="body" />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator />
          ) : isError ? (
            <Txt variant="body">{t('recipes.catalog.error')}</Txt>
          ) : (
            <Txt variant="body">{t('recipes.catalog.empty')}</Txt>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} />
          ) : isFetchNextPageError ? (
            <Txt variant="body" tone="secondary" style={styles.footer}>
              {t('recipes.catalog.moreError')}
            </Txt>
          ) : null
        }
        onEndReached={loadMoreRecipes}
        onEndReachedThreshold={0.4}
      />
    </HubScreen>
  );
}
