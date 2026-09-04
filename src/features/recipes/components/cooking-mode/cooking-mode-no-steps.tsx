import { Pressable, ScrollView } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import type { RecipeDetail } from '../../hooks/use-recipes';

type CookingModeNoStepsProps = {
  recipe: RecipeDetail['recipe'];
  onFinish: () => void;
};

export function CookingModeNoSteps({ recipe, onFinish }: CookingModeNoStepsProps) {
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerClassName="flex-grow px-four pb-four">
      <Txt variant="heading" className="pt-[6px]">
        {recipe.title}
      </Txt>
      <Txt
        variant="body"
        tone="secondary"
        className="pt-three"
        style={{ fontSize: 12, lineHeight: 18 }}>
        {recipe.instructions ?? 'Für dieses Rezept sind noch keine Schritte hinterlegt.'}
      </Txt>
      <Pressable
        onPress={onFinish}
        role="button"
        className="min-h-[48px] rounded-card items-center justify-center px-three active:opacity-75 mt-auto"
        style={{ backgroundColor: colors.basil }}>
        <Txt variant="caption" tone="inverse" weight="700" center>
          Zubereitung abschließen
        </Txt>
      </Pressable>
    </ScrollView>
  );
}
