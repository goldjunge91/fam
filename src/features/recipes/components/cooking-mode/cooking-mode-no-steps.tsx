import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Txt variant="heading" style={styles.title}>
        {recipe.title}
      </Txt>
      <Txt variant="caption" tone="secondary" style={styles.instructions}>
        {recipe.instructions ?? t('recipes.cooking.noSteps')}
      </Txt>
      <Press
        onPress={onFinish}
        accessibilityRole="button"
        style={[styles.finish, { backgroundColor: colors.accent }]}>
        <Txt variant="caption" tone="onAccent" weight="700" center>
          {t('recipes.cooking.finish')}
        </Txt>
      </Press>
    </ScrollView>
  );
}
