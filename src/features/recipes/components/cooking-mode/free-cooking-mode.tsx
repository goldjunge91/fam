import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { presentPaywallIfNeeded } from '@/features/premium/paywall';
import type { RecipeDetail } from '../../data/use-recipes';
import { flattenRecipeItems } from '../../domain/ingredient-mentions';
import { StepMentionText } from '../step-mention-text';
import { CookingModeShell } from './cooking-mode-shell';

export function FreeCookingMode({ data }: { data: RecipeDetail }) {
  const { recipe, items, steps, productsById } = data;
  const ingredients = items.filter((item) => item.product_id !== null);
  const mentionIngredients = flattenRecipeItems(data.items, data.productsById);
  const [unlocking, setUnlocking] = useState(false);

  async function unlockPremium() {
    setUnlocking(true);
    try {
      await presentPaywallIfNeeded();
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <CookingModeShell title="Kochmodus" backLabel="Kochmodus schließen">
      <ScrollView
        contentContainerClassName="flex-grow px-four pb-four gap-[14px]"
        showsVerticalScrollIndicator={false}>
        <ThemedText type="headingSmall" className="pt-[6px]">
          {recipe.title}
        </ThemedText>

        {ingredients.length > 0 ? (
          <View className="rounded-sheet p-[13px] gap-two bg-background-element/85">
            {ingredients.map((item) => {
              const product = item.product_id ? productsById.get(item.product_id) : undefined;
              return (
                <View key={item.id} className="row-between">
                  <ThemedText type="body">{product?.name ?? 'Zutat'}</ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">
                    {item.quantity ?? item.grams} {item.quantity ? item.unit : 'g'}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        ) : null}

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
          onPress={unlockPremium}
          role="button"
          className="min-h-[48px] rounded-card items-center justify-center px-three bg-accent active:opacity-75 mt-auto">
          <ThemedText type="captionCompact" className="text-white font-bold text-center">
            {unlocking ? 'Öffnet…' : 'Geführten Kochmodus freischalten'}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </CookingModeShell>
  );
}
