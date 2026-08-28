import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import type { RecipeStep } from '../../data/use-recipes';
import {
  type MentionableIngredient,
  renderMentionPlainText,
} from '../../domain/ingredient-mentions';
import { StepMentionText } from '../step-mention-text';
import { CookingModeArtwork } from './cooking-mode-artwork';
import { CookingModeTimer } from './cooking-mode-timer';

type CookingModeStepProps = {
  steps: RecipeStep[];
  stepIndex: number;
  currentStep: RecipeStep;
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
  const currentStepPlainText = renderMentionPlainText(currentStep.text, mentionIngredients);

  return (
    <View className="flex-1 px-four pb-four">
      <View className="h-[21px] flex-row gap-[5px] pt-half pb-[15px]">
        {steps.map((step, index) => (
          <View
            key={step.id}
            className={`flex-1 h-1 rounded-sm ${
              index <= stepIndex ? 'bg-accent' : 'bg-background-selected'
            }`}
          />
        ))}
      </View>

      <ThemedText
        type="detail"
        themeColor="textSecondary"
        className="text-[9px] leading-[11px] font-medium tracking-wider">
        SCHRITT {stepIndex + 1} VON {steps.length}
      </ThemedText>
      <ThemedText type="headingSmall" className="pt-[6px]" numberOfLines={2}>
        {currentStepPlainText.length > 42
          ? `Schritt ${stepIndex + 1}`
          : currentStepPlainText.replace(/[.!?]+$/, '')}
      </ThemedText>

      <View className="h-[184px] mt-[13px] rounded-fam-large overflow-hidden">
        <CookingModeArtwork step={currentStep} />
      </View>
      <StepMentionText
        text={currentStep.text}
        ingredients={mentionIngredients}
        type="detail"
        themeColor="textSecondary"
        className="pt-three text-[12px] leading-[18px] font-medium"
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
          className={`w-12 h-12 rounded-card items-center justify-center bg-background-selected active:opacity-75 ${
            stepIndex === 0 ? 'opacity-35' : ''
          }`}>
          <ThemedText type="headingSmall" themeColor="accent" className="font-medium">
            ‹
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onNextStep}
          role="button"
          className="flex-1 min-h-[48px] rounded-card items-center justify-center px-three bg-accent active:opacity-75">
          <ThemedText type="captionCompact" className="text-white font-bold text-center">
            {stepIndex === steps.length - 1 ? 'Zubereitung abschließen' : 'Nächster Schritt'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
