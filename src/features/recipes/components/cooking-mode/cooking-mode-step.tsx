import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import {
  type MentionableIngredient,
  renderMentionPlainText,
} from '../../domain/ingredient-mentions';
import type { RecipeStep } from '../../hooks/use-recipe-steps';
import { StepMentionText } from '../step-mention-text';
import { CookingModeArtwork } from './cooking-mode-artwork';
import { CookingModeTimer } from './cooking-mode-timer';

type CookingModeStepProps = {
  steps: RecipeStep[];
  stepIndex: number;
  currentStep: RecipeStep;
  currentStepImageUrl?: string | null;
  mentionIngredients: MentionableIngredient[];
  durationSeconds: number | null;
  remainingSeconds: number;
  timerRunning: boolean;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
};

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    paddingHorizontal: rs(24),
    paddingBottom: rs(24),
  },
  progress: {
    height: rs(21),
    flexDirection: 'row',
    gap: rs(5),
    paddingTop: rs(2),
    paddingBottom: rs(15),
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: theme.radius.sm,
  },
  stepLabel: {
    letterSpacing: 1.1,
  },
  title: {
    paddingTop: rs(6),
  },
  artwork: {
    height: rs(184),
    marginTop: rs(13),
    borderRadius: theme.radius.famLarge,
    overflow: 'hidden',
  },
  stepText: {
    paddingTop: theme.space.lg,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: rs(13),
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  previous: {
    width: rs(48),
    height: rs(48),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextContainer: {
    flex: 1,
  },
  next: {
    flex: 1,
    minHeight: rs(48),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
}));

export function CookingModeStep({
  steps,
  stepIndex,
  currentStep,
  currentStepImageUrl,
  mentionIngredients,
  durationSeconds,
  remainingSeconds,
  timerRunning,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onPreviousStep,
  onNextStep,
}: CookingModeStepProps) {
  const { colors } = useTheme();
  const currentStepPlainText = renderMentionPlainText(currentStep.text, mentionIngredients);

  return (
    <View style={styles.root}>
      <View style={styles.progress}>
        {steps.map((step, index) => (
          <View
            key={step.id}
            style={[
              styles.progressSegment,
              { backgroundColor: index <= stepIndex ? colors.accent : colors.backgroundSoft },
            ]}
          />
        ))}
      </View>

      <Txt variant="caption" tone="secondary" style={styles.stepLabel}>
        SCHRITT {stepIndex + 1} VON {steps.length}
      </Txt>
      <Txt variant="heading" style={styles.title} numberOfLines={2}>
        {currentStepPlainText.length > 42
          ? `Schritt ${stepIndex + 1}`
          : currentStepPlainText.replace(/[.!?]+$/, '')}
      </Txt>

      <View style={styles.artwork}>
        <CookingModeArtwork step={currentStep} imageUrl={currentStepImageUrl} />
      </View>
      <StepMentionText
        text={currentStep.text}
        ingredients={mentionIngredients}
        variant="caption"
        tone="secondary"
        style={styles.stepText}
        weight="500"
      />

      <CookingModeTimer
        durationSeconds={durationSeconds}
        remainingSeconds={remainingSeconds}
        running={timerRunning}
        onStart={onStartTimer}
        onPause={onPauseTimer}
        onReset={onResetTimer}
      />

      <View style={styles.footer}>
        <Press
          onPress={onPreviousStep}
          disabled={stepIndex === 0}
          role="button"
          aria-label="Vorheriger Schritt"
          style={[
            styles.previous,
            { backgroundColor: colors.backgroundSoft },
            stepIndex === 0 ? { opacity: 0.35 } : undefined,
          ]}>
          <Txt variant="heading" tone="secondary" weight="500">
            ‹
          </Txt>
        </Press>
        <Press
          onPress={onNextStep}
          role="button"
          containerStyle={styles.nextContainer}
          style={[styles.next, { backgroundColor: colors.accent }]}>
          <Txt variant="caption" tone="onAccent" weight="700" center>
            {stepIndex === steps.length - 1 ? 'Zubereitung abschließen' : 'Nächster Schritt'}
          </Txt>
        </Press>
      </View>
    </View>
  );
}
