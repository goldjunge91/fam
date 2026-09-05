import { type Href, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { HubScreen } from '@/components/layout/hub-screen';
import { SectionHeading } from '@/components/layout/section-heading';
import { Txt } from '@/constants/ui';
import { RecipePreviewCard } from '../components/recipe-preview-card';
import { getCatalogCoverPath } from './recipe-catalog-image';
import { useCatalogRecipes } from './use-recipe-catalog';

export function RecipeCatalogScreen() {
  const { data: recipes = [], isLoading } = useCatalogRecipes();
  return (
    <HubScreen
      safeAreaClassName="flex-1 w-full max-w-[800px] self-center"
      header={{
        title: 'Entdecken',
        align: 'center',
        leading: (
          <Pressable onPress={() => router.back()}>
            <Txt variant="body">Zurück</Txt>
          </Pressable>
        ),
      }}>
      <ScrollView className="flex-1" contentContainerClassName="px-[15px] pt-one pb-[126px]">
        <SectionHeading title="Rezepte für euch" />
        {isLoading ? (
          <ActivityIndicator />
        ) : recipes.length ? (
          <View className="gap-[10px]">
            {recipes.map((recipe, index) => (
              <RecipePreviewCard
                key={recipe.id}
                title={recipe.title}
                coverImagePath={getCatalogCoverPath(recipe)}
                coverSource="catalog"
                cookTimeMinutes={recipe.cook_time_minutes}
                difficultyLabel={recipe.difficulty}
                servings={recipe.default_servings}
                paletteIndex={index}
                onPress={() => router.push(`/recipe/catalog/${recipe.slug}` as Href)}
              />
            ))}
          </View>
        ) : (
          <Txt variant="body">Der Rezeptkatalog ist noch leer.</Txt>
        )}
      </ScrollView>
    </HubScreen>
  );
}
