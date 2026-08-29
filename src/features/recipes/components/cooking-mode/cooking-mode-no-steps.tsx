import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import type { RecipeDetail } from '../../hooks/use-recipes';

type CookingModeNoStepsProps = {
  recipe: RecipeDetail['recipe'];
  onFinish: () => void;
};

export function CookingModeNoSteps({ recipe, onFinish }: CookingModeNoStepsProps) {
  return (
    <ScrollView contentContainerClassName="flex-grow px-four pb-four">
      <ThemedText type="headingSmall" className="pt-[6px]">
        {recipe.title}
      </ThemedText>
      <ThemedText
        type="detail"
        themeColor="textSecondary"
        className="pt-three text-[12px] leading-[18px] font-medium">
        {recipe.instructions ?? 'Für dieses Rezept sind noch keine Schritte hinterlegt.'}
      </ThemedText>
      <Pressable
        onPress={onFinish}
        role="button"
        className="min-h-[48px] rounded-card items-center justify-center px-three bg-accent active:opacity-75 mt-auto">
        <ThemedText type="captionCompact" className="text-white font-bold text-center">
          Zubereitung abschließen
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}
