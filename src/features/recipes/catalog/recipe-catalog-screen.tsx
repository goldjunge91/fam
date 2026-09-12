import { FlashList } from '@shopify/flash-list';
import { type Href, router } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { HubScreen } from '@/components/layout/hub-screen';
import { SectionHeading } from '@/components/layout/section-heading';
import { Txt } from '@/constants/ui';
import { RecipePreviewCard } from '../components/recipe-preview-card';
import { getCatalogCoverPath } from './recipe-catalog-image';
import { type CatalogRecipe, useCatalogRecipes } from './use-recipe-catalog';

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingHorizontal: 15, paddingTop: 4, paddingBottom: 126 },
  separator: { height: 10 },
});

function CardSeparator() {
  return <View style={styles.separator} />;
}

export function RecipeCatalogScreen() {
  const { data: recipes = [], isLoading } = useCatalogRecipes();

  const renderItem = useCallback(
    ({ item, index }: { item: CatalogRecipe; index: number }) => (
      <RecipePreviewCard
        title={item.title}
        coverImagePath={getCatalogCoverPath(item)}
        coverSource="catalog"
        cookTimeMinutes={item.cook_time_minutes}
        difficultyLabel={item.difficulty}
        servings={item.default_servings}
        paletteIndex={index}
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
        ListHeaderComponent={<SectionHeading title="Rezepte für euch" />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator />
          ) : (
            <Txt variant="body">Der Rezeptkatalog ist noch leer.</Txt>
          )
        }
      />
    </HubScreen>
  );
}
