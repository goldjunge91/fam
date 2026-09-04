import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { flattenRecipeItems } from '../../domain/ingredient-mentions';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { StepMentionText } from '../step-mention-text';
import { CookingModeShell } from './cooking-mode-shell';

export function FreeCookingMode({ data }: { data: RecipeDetail }) {
  const { colors } = useTheme();
  const { recipe, steps } = data;
  const mentionIngredients = flattenRecipeItems(data.items, data.productsById);

  return (
    <CookingModeShell title="Kochmodus" backLabel="Kochmodus schließen">
      <ScrollView
        contentContainerClassName="flex-grow px-four pb-four gap-[14px]"
        showsVerticalScrollIndicator={false}>
        <Txt variant="heading" className="pt-[6px]">
          {recipe.title}
        </Txt>

        <IngredientGroups data={data} />

        {recipe.instructions ? (
          <Txt variant="detail" tone="secondary" className="pt-three">
            {recipe.instructions}
          </Txt>
        ) : null}

        {steps.length > 0 ? (
          <View className="gap-three">
            {steps.map((step) => (
              <View key={step.id} className="flex-row gap-two">
                <Txt variant="caption" tone="primary" weight="700">
                  {step.position + 1}.
                </Txt>
                <StepMentionText
                  text={step.text}
                  ingredients={mentionIngredients}
                  variant="captionCompact"
                  className="flex-1"
                  weight="500"
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
          className="min-h-[48px] rounded-card items-center justify-center px-three active:opacity-75 mt-auto"
          style={{ backgroundColor: colors.basil }}>
          <Txt variant="caption" tone="inverse" weight="700" center>
            Geführten Kochmodus freischalten
          </Txt>
        </Pressable>
      </ScrollView>
    </CookingModeShell>
  );
}

function round(value: number): number {
  return Math.round(value);
}

function IngredientGroups({ data }: { data: RecipeDetail }) {
  const { colors } = useTheme();
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
    <View className="rounded-sheet p-[13px] gap-[18px]" style={{ backgroundColor: colors.surface }}>
      {groups.map((component) => {
        const items = data.items.filter((item) => item.component_id === component.id);

        return (
          <View key={component.id}>
            <View className="min-h-[40px] row-between gap-[10px] border-b border-border">
              <Txt variant="heading" className="flex-1">
                {component.name}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {round(component.serving_grams ?? 0)} g zubereitet
              </Txt>
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
                  <Txt variant="body" weight="500" className="flex-1" numberOfLines={1}>
                    {name}
                  </Txt>
                  <Txt variant="body" tone="secondary" weight="500">
                    {round(quantity)} {unit}
                  </Txt>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
