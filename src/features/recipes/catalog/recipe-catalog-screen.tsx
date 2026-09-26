import { FlashList } from '@shopify/flash-list';
import { type Href, router } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { HubScreen } from '@/components/layout/hub-screen';
import { space } from '@/components/theme/index';
import { SectionHeading, Txt } from '@/constants/ui';
import { RecipePreviewCard } from '../components/recipe-preview-card';
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

export function RecipeCatalogScreen() {
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
        difficultyLabel={item.difficulty}
        servings={item.default_servings}
        onPress={() => router.push(`/recipe/catalog/${item.slug}` as Href)}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: CatalogRecipe) => item.id, []);

  return (
    <HubScreen
      header={{
        title: 'Entdecken',
        align: 'center',
        leading: (
          <Pressable onPress={() => router.back()}>
            <Txt variant="body">Zurück</Txt>
          </Pressable>
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
        ListHeaderComponent={<SectionHeading title="Rezepte für euch" titleVariant="body" />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator />
          ) : isError ? (
            <Txt variant="body">Der Rezeptkatalog konnte nicht geladen werden.</Txt>
          ) : (
            <Txt variant="body">Der Rezeptkatalog ist noch leer.</Txt>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} />
          ) : isFetchNextPageError ? (
            <Txt variant="body" tone="secondary" style={styles.footer}>
              Weitere Rezepte konnten nicht geladen werden.
            </Txt>
          ) : null
        }
        onEndReached={loadMoreRecipes}
        onEndReachedThreshold={0.4}
      />
    </HubScreen>
  );
}
