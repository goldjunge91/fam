import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton, HeaderIconButton } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { HeartGlyph, HeroArtwork } from '@/features/recipes/components/recipe-detail-primitives';
import { useRecipeFavorites } from '@/features/recipes/recipe-favorites';
import { useRecipeCoverUrl } from '@/features/recipes/recipe-image-uploader';
import type { DietaryTag, DishType } from '@/features/recipes/use-recipes';
import {
  DIETARY_TAG_LABELS,
  DIFFICULTY_LABELS,
  DISH_TYPE_LABELS,
} from '@/features/recipes/wizard/recipe-metadata-options';
import { useTheme } from '@/hooks/use-theme';
import { useApplyRecipeTemplateMutation, useRecipeTemplateDetail } from './use-recipe-templates';

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <View className="rtd-meta-pill">
      <ThemedText themeColor="textSecondary" className="rtd-meta-pill-text">
        {children}
      </ThemedText>
    </View>
  );
}

export function RecipeTemplateDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeHouseholdId } = useActiveHousehold();
  const { session } = useSession();
  const [isApplying, setIsApplying] = useState(false);
  const [servings, setServings] = useState<number | null>(null);
  const { data: template, isLoading } = useRecipeTemplateDetail(id);
  const { data: coverUrl } = useRecipeCoverUrl(template?.cover_image_path);
  const applyTemplate = useApplyRecipeTemplateMutation();
  const { isFavorite, toggleFavorite } = useRecipeFavorites();
  const favorite = isFavorite(`template:${id}`);

  async function copyTemplate() {
    if (!template || !activeHouseholdId || !session?.user.id) return;
    setIsApplying(true);
    try {
      const recipe = await applyTemplate.mutateAsync({
        template,
        household_id: activeHouseholdId,
        created_by: session.user.id,
      });
      router.replace({ pathname: '/recipe/detail', params: { id: recipe.id } });
    } catch (error) {
      Alert.alert(
        'Rezept konnte nicht übernommen werden',
        error instanceof Error ? error.message : 'Bitte versuche es erneut.',
      );
    } finally {
      setIsApplying(false);
    }
  }

  if (isLoading || !template) {
    return (
      <HubScreen
        safeAreaClassName="rtd-safe-area"
        header={{ title: 'Rezept', leading: <BackButton label="Zurück" variant="header" /> }}>
        <ActivityIndicator className="rtd-loading" color={theme.accent} />
      </HubScreen>
    );
  }

  const currentServings = servings ?? template.default_servings;
  const scale = currentServings / Math.max(1, template.default_servings);
  const tags = [...template.dish_types, ...template.dietary_tags];
  const buttonDisabled = isApplying || !activeHouseholdId || !session;

  return (
    <HubScreen
      safeAreaClassName="rtd-safe-area"
      header={{
        title: 'Rezept',
        leading: <BackButton label="Zurück" variant="header" />,
        trailing: (
          <HeaderIconButton
            label={favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
            onPress={() => toggleFavorite(`template:${id}`)}>
            <HeartGlyph filled={favorite} />
          </HeaderIconButton>
        ),
      }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="rtd-content"
        showsVerticalScrollIndicator={false}>
        <View className="rtd-hero">
          <HeroArtwork coverUrl={coverUrl} title={template.title} />
          <View className="rtd-hero-badge">
            <ThemedText themeColor="accent" className="rtd-hero-badge-text">
              Entdecken
            </ThemedText>
          </View>
        </View>

        <ThemedText className="rtd-title">{template.title}</ThemedText>

        <View className="rtd-meta-row">
          {template.cook_time_minutes ? (
            <MetaPill>{template.cook_time_minutes} Minuten</MetaPill>
          ) : null}
          {template.difficulty ? (
            <MetaPill>{DIFFICULTY_LABELS[template.difficulty]}</MetaPill>
          ) : null}
          {tags.map((tag) => (
            <MetaPill key={tag}>
              {DISH_TYPE_LABELS[tag as DishType] ?? DIETARY_TAG_LABELS[tag as DietaryTag] ?? tag}
            </MetaPill>
          ))}
        </View>

        {template.instructions ? (
          <ThemedText themeColor="textSecondary" className="rtd-description">
            {template.instructions}
          </ThemedText>
        ) : null}

        <View className="rtd-section-heading">
          <ThemedText className="rtd-section-title">Zutaten</ThemedText>
          <View className="rtd-portion-control">
            <Pressable
              onPress={() => setServings(Math.max(1, currentServings - 1))}
              role="button"
              aria-label="Weniger Portionen"
              className="rtd-portion-button">
              <ThemedText className="rtd-portion-sign">−</ThemedText>
            </Pressable>
            <ThemedText className="rtd-portion-value">{currentServings} Portionen</ThemedText>
            <Pressable
              onPress={() => setServings(currentServings + 1)}
              role="button"
              aria-label="Mehr Portionen"
              className="rtd-portion-button">
              <ThemedText className="rtd-portion-sign">+</ThemedText>
            </Pressable>
          </View>
        </View>

        <View className="rtd-group-list">
          {template.components.map((component) => (
            <View key={component.id} className="rtd-ingredient-group">
              <View className="rtd-group-header">
                <ThemedText className="rtd-group-title">{component.name}</ThemedText>
                {component.serving_grams !== null ? (
                  <ThemedText themeColor="textSecondary" className="rtd-group-meta">
                    {Math.round(component.serving_grams * scale)} g
                  </ThemedText>
                ) : null}
              </View>
              {component.items.map((item, index) => (
                <View
                  key={item.id}
                  className={`rtd-ingredient-row ${
                    index < component.items.length - 1 ? 'rtd-ingredient-row-bordered' : ''
                  }`}>
                  <ThemedText className="rtd-ingredient-name" numberOfLines={1}>
                    {item.product_name ?? 'Zutat'}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" className="rtd-ingredient-amount">
                    {Math.round((item.quantity ?? item.grams) * scale)} {item.unit}
                  </ThemedText>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View className="rtd-section-heading">
          <ThemedText className="rtd-section-title">Zubereitung</ThemedText>
          <ThemedText themeColor="textSecondary" className="rtd-section-count">
            {template.steps.length} {template.steps.length === 1 ? 'Schritt' : 'Schritte'}
          </ThemedText>
        </View>
        {template.steps.length > 0 ? (
          <View className="rtd-steps-card">
            {template.steps.map((step, index) => (
              <View
                key={step.id}
                className={`rtd-step-row ${
                  index < template.steps.length - 1 ? 'rtd-ingredient-row-bordered' : ''
                }`}>
                <ThemedText className="rtd-step-text">
                  {step.position + 1}. {step.text}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className="rtd-sticky-action">
        <Pressable
          onPress={copyTemplate}
          disabled={buttonDisabled}
          role="button"
          className={`rtd-primary-button ${buttonDisabled ? 'rtd-primary-button-disabled' : ''}`}>
          {isApplying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText type="captionCompact" className="rtd-primary-button-text">
              In meine Rezepte übernehmen
            </ThemedText>
          )}
        </Pressable>
      </View>
    </HubScreen>
  );
}
