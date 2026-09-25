import { ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import type { RecipeDetail } from '../../hooks/use-recipes';

type CookingModeNoStepsProps = {
  recipe: RecipeDetail['recipe'];
  onFinish: () => void;
};

const styles = StyleSheet.create((theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.space.xxl,
    paddingBottom: theme.space.xxl,
  },
  title: {
    paddingTop: theme.space.md,
  },
  instructions: {
    paddingTop: theme.space.lg,
  },
  finish: {
    minHeight: theme.controlSizes.touchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    marginTop: 'auto',
  },
}));

export function CookingModeNoSteps({ recipe, onFinish }: CookingModeNoStepsProps) {
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Txt variant="heading" style={styles.title}>
        {recipe.title}
      </Txt>
      <Txt variant="caption" tone="secondary" style={styles.instructions}>
        {recipe.instructions ?? 'Für dieses Rezept sind noch keine Schritte hinterlegt.'}
      </Txt>
      <Press
        onPress={onFinish}
        role="button"
        style={[styles.finish, { backgroundColor: colors.accent }]}>
        <Txt variant="caption" tone="onAccent" weight="700" center>
          Zubereitung abschließen
        </Txt>
      </Press>
    </ScrollView>
  );
}
