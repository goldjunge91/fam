import { useCallback, useState } from 'react';

import { useCatalogImageUrl } from '../../catalog/use-recipe-catalog';
import {
  type MentionableIngredient,
  renderMentionPlainText,
  resolveStepIngredients,
} from '../../domain/ingredient-mentions';
import { stripStepImageMarkers } from '../../domain/step-image-markers';
import { useCookingModeVoice } from '../../hooks/use-cooking-mode-voice';
import { useCookingTimer } from '../../hooks/use-cooking-timer';
import type { RecipeStep } from '../../hooks/use-recipe-steps';
import type { RecipeDetail } from '../../hooks/use-recipes';
import { CookingModeNoSteps } from './cooking-mode-no-steps';
import { CookingModeStep } from './cooking-mode-step';
import { getCookingTimerDurationSeconds } from './cooking-mode-timer';

type CatalogStepImage = {
  step_id: string;
  storage_path: string;
};

type CookingModePlusFlowProps = {
  recipe: RecipeDetail['recipe'];
  steps: RecipeStep[];
  ingredients: MentionableIngredient[];
  catalogStepImages?: readonly CatalogStepImage[];
  initialStepIndex?: number;
  onFinish: (stepIndex?: number) => void;
};

export function CookingModePlusFlow({
  recipe,
  steps,
  ingredients,
  catalogStepImages = [],
  initialStepIndex = 0,
  onFinish,
}: CookingModePlusFlowProps) {
  if (steps.length === 0) {
    return <CookingModeNoSteps recipe={recipe} onFinish={onFinish} />;
  }

  return (
    <CookingModePlusStepFlow
      steps={steps}
      ingredients={ingredients}
      catalogStepImages={catalogStepImages}
      initialStepIndex={initialStepIndex}
      onFinish={onFinish}
    />
  );
}

function CookingModePlusStepFlow({
  steps,
  ingredients,
  catalogStepImages = [],
  initialStepIndex = 0,
  onFinish,
}: Omit<CookingModePlusFlowProps, 'recipe'>) {
  const safeInitialStepIndex = Math.min(
    Math.max(initialStepIndex, 0),
    Math.max(steps.length - 1, 0),
  );
  const [stepIndex, setStepIndex] = useState(safeInitialStepIndex);
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const currentStepImagePath = catalogStepImages.find(
    (image) => image.step_id === currentStep.id,
  )?.storage_path;
  const { data: currentStepImageUrl } = useCatalogImageUrl(currentStepImagePath);
  const stepIngredients = resolveStepIngredients(currentStep.ingredientIds, ingredients);
  const currentStepText = renderMentionPlainText(
    stripStepImageMarkers(currentStep.text),
    ingredients,
  );
  const durationSeconds = getCookingTimerDurationSeconds(currentStep);
  const {
    remainingSeconds,
    running,
    start: startTimer,
    pause: pauseTimer,
    reset: resetTimer,
  } = useCookingTimer({ stepId: currentStep.id, durationSeconds });
  const finish = useCallback(() => onFinish(stepIndex), [onFinish, stepIndex]);
  const onNextStep = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish();
      return;
    }
    setStepIndex((value) => value + 1);
  }, [finish, stepIndex, steps.length]);
  const onPreviousStep = useCallback(() => setStepIndex((value) => Math.max(0, value - 1)), []);
  const voice = useCookingModeVoice({
    stepId: currentStep.id,
    currentStepText,
    stepIngredients,
    onNextStep,
    onPreviousStep,
    onStartTimer: startTimer,
    onFinish: finish,
  });

  return (
    <CookingModeStep
      steps={steps}
      stepIndex={stepIndex}
      currentStep={currentStep}
      currentStepImageUrl={currentStepImageUrl}
      mentionIngredients={ingredients}
      stepIngredients={stepIngredients}
      durationSeconds={durationSeconds}
      remainingSeconds={remainingSeconds}
      timerRunning={running}
      voice={voice}
      onStartTimer={startTimer}
      onPauseTimer={pauseTimer}
      onResetTimer={resetTimer}
      onPreviousStep={voice.onPreviousStep}
      onNextStep={voice.onNextStep}
    />
  );
}
