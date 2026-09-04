import { Pressable, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
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
    <View className="flex-1 px-four pb-four">
      <View className="h-[21px] flex-row gap-[5px] pt-half pb-[15px]">
        {steps.map((step, index) => (
          <View
            key={step.id}
            className="flex-1 h-1 rounded-sm"
            style={{ backgroundColor: index <= stepIndex ? colors.basil : colors.surfaceSoft }}
          />
        ))}
      </View>

      <Txt
        variant="caption"
        tone="secondary"
        className="tracking-wider"
        style={{ fontSize: 9, lineHeight: 11 }}>
        SCHRITT {stepIndex + 1} VON {steps.length}
      </Txt>
      <Txt variant="heading" className="pt-[6px]" numberOfLines={2}>
        {currentStepPlainText.length > 42
          ? `Schritt ${stepIndex + 1}`
          : currentStepPlainText.replace(/[.!?]+$/, '')}
      </Txt>

      <View className="h-[184px] mt-[13px] rounded-fam-large overflow-hidden">
        <CookingModeArtwork step={currentStep} imageUrl={currentStepImageUrl} />
      </View>
      <StepMentionText
        text={currentStep.text}
        ingredients={mentionIngredients}
        variant="body"
        tone="secondary"
        className="pt-three"
        weight="500"
        style={{ fontSize: 12, lineHeight: 18 }}
      />

      <CookingModeTimer
        durationSeconds={durationSeconds}
        remainingSeconds={remainingSeconds}
        running={timerRunning}
        onStart={onStartTimer}
        onPause={onPauseTimer}
        onReset={onResetTimer}
      />

      <View className="mt-auto pt-[13px] flex-row gap-two">
        <Pressable
          onPress={onPreviousStep}
          disabled={stepIndex === 0}
          role="button"
          aria-label="Vorheriger Schritt"
          className={`w-12 h-12 rounded-card items-center justify-center active:opacity-75 ${
            stepIndex === 0 ? 'opacity-35' : ''
          }`}
          style={{ backgroundColor: colors.surfaceSoft }}>
          <Txt variant="heading" tone="secondary" weight="500">
            ‹
          </Txt>
        </Pressable>
        <Pressable
          onPress={onNextStep}
          role="button"
          className="flex-1 min-h-[48px] rounded-card items-center justify-center px-three active:opacity-75"
          style={{ backgroundColor: colors.basil }}>
          <Txt variant="caption" tone="inverse" weight="700" center>
            {stepIndex === steps.length - 1 ? 'Zubereitung abschließen' : 'Nächster Schritt'}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
