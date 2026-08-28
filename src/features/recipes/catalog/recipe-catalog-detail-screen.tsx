import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { useRecipeFavorites } from '../recipe-favorites';
import { useCatalogRecipe, useCopyCatalogRecipeMutation } from './use-recipe-catalog';

export function RecipeCatalogDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading } = useCatalogRecipe(slug);
  const { isFavorite, toggleFavorite } = useRecipeFavorites();
  const copy = useCopyCatalogRecipeMutation();
  if (isLoading) return <ActivityIndicator />;
  if (!data) return <ThemedText>Rezept nicht gefunden.</ThemedText>;
  const favoriteKey = `catalog:${data.recipe.id}` as const;
  return (
    <HubScreen
      safeAreaClassName="flex-1 w-full max-w-[800px] self-center"
      header={{
        title: data.recipe.title,
        align: 'center',
        titleSize: 'large',
        leading: (
          <Pressable onPress={() => router.back()}>
            <ThemedText>Zurück</ThemedText>
          </Pressable>
        ),
      }}>
      <ScrollView className="flex-1" contentContainerClassName="px-[15px] pt-one pb-[126px]">
        <ThemedText type="title">{data.recipe.title}</ThemedText>
        {data.recipe.instructions ? (
          <ThemedText className="mt-two">{data.recipe.instructions}</ThemedText>
        ) : null}
        <View className="flex-row gap-two mt-three">
          <Button
            label={isFavorite(favoriteKey) ? 'Favorit entfernen' : 'Als Favorit speichern'}
            onPress={() => void toggleFavorite(favoriteKey)}
          />
          <Button
            label="In Haushalt kopieren"
            onPress={() =>
              void copy
                .mutateAsync(data)
                .then((recipe) =>
                  router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } }),
                )
                .catch((error: unknown) =>
                  Alert.alert(
                    'Kopieren fehlgeschlagen',
                    error instanceof Error ? error.message : 'Bitte später erneut versuchen.',
                  ),
                )
            }
            disabled={copy.isPending}
          />
        </View>
        {data.components.map((component) => (
          <View key={component.id} className="mt-five">
            <ThemedText type="subtitle">{component.name}</ThemedText>
            {data.items
              .filter((item) => item.component_id === component.id)
              .map((item) => (
                <ThemedText key={item.id} className="mt-one">
                  {item.quantity ?? item.grams} {item.unit} {item.ingredient_name ?? 'Zutat'}
                </ThemedText>
              ))}
          </View>
        ))}
        <View className="mt-five">
          {data.steps.map((step) => (
            <View key={step.id} className="mb-three">
              <ThemedText type="subtitle">{step.position + 1}. Schritt</ThemedText>
              <ThemedText>{step.text}</ThemedText>
            </View>
          ))}
        </View>
      </ScrollView>
    </HubScreen>
  );
}
