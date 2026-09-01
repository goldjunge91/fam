import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { flattenRecipeItems } from '../../domain/ingredient-mentions';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { StepMentionText } from '../step-mention-text';
import { CookingModeShell } from './cooking-mode-shell';

export function FreeCookingMode({ data }: { data: RecipeDetail }) {
  const { recipe, steps } = data;
  const mentionIngredients = flattenRecipeItems(data.items, data.productsById);

  return (
    <CookingModeShell title="Kochmodus" backLabel="Kochmodus schließen">
      <ScrollView
        contentContainerClassName="flex-grow px-four pb-four gap-[14px]"
        showsVerticalScrollIndicator={false}>
        <ThemedText type="headingSmall" className="pt-[6px]">
          {recipe.title}
        </ThemedText>

        <IngredientGroups data={data} />

        {recipe.instructions ? (
          <ThemedText
            type="detail"
            themeColor="textSecondary"
            className="pt-three text-[12px] leading-[18px] font-medium">
            {recipe.instructions}
          </ThemedText>
        ) : null}

        {steps.length > 0 ? (
          <View className="gap-three">
            {steps.map((step) => (
              <View key={step.id} className="flex-row gap-two">
                <ThemedText type="captionCompact" themeColor="accent" className="font-bold">
                  {step.position + 1}.
                </ThemedText>
                <StepMentionText
                  text={step.text}
                  ingredients={mentionIngredients}
                  type="detail"
                  className="flex-1 text-[11px] leading-[18px] font-medium"
                />
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() =>
            router.push({ pathname: '/settings/plus-and-ai', params: { tier: 'plus' } })
          }
          role="button"
          className="min-h-[48px] rounded-card items-center justify-center px-three bg-accent active:opacity-75 mt-auto">
          <ThemedText type="captionCompact" className="text-white font-bold text-center">
            Geführten Kochmodus freischalten
          </ThemedText>
        </Pressable>
      </ScrollView>
    </CookingModeShell>
  );
}

function round(value: number): number {
  return Math.round(value);
}

function IngredientGroups({ data }: { data: RecipeDetail }) {
  const groupsWithServingWeight = data.components.filter(
    (component) => component.serving_grams !== null,
  );
  // Katalogrezepte haben teilweise keine zubereiteten Gruppen-Gewichte.
  // In diesem Fall sind trotzdem alle vorhandenen Komponenten echte Gruppen.
  const groups = groupsWithServingWeight.length > 0 ? groupsWithServingWeight : data.components;
  const componentNames = new Map(
    data.components.map((component) => [component.id, component.name]),
  );

  if (groups.length === 0) {
    return null;
  }

  return (
    <View className="rounded-sheet p-[13px] gap-[18px] bg-background-element/85">
      {groups.map((component) => {
        const items = data.items.filter((item) => item.component_id === component.id);

        return (
          <View key={component.id}>
            <View className="min-h-[40px] row-between gap-[10px] border-b border-border">
              <ThemedText type="headingSmall" className="flex-1">
                {component.name}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {round(component.serving_grams ?? 0)} g zubereitet
              </ThemedText>
            </View>
            {items.map((item, index) => {
              const product = item.product_id ? data.productsById.get(item.product_id) : undefined;
              const name =
                product?.name ??
                item.ingredient_name ??
                (item.sub_component_id ? componentNames.get(item.sub_component_id) : undefined) ??
                'Zutat';
              const quantity = item.quantity !== null ? item.quantity : item.grams;
              const unit = item.quantity !== null ? item.unit : 'g';

              return (
                <View
                  key={item.id}
                  className={`min-h-[44px] row-between gap-three ${
                    index < items.length - 1 ? 'border-b border-border' : ''
                  }`}>
                  <ThemedText type="body" className="flex-1 font-medium" numberOfLines={1}>
                    {name}
                  </ThemedText>
                  <ThemedText type="body" themeColor="textSecondary" className="font-medium">
                    {round(quantity)} {unit}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
