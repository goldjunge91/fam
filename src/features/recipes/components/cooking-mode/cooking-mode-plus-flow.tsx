import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';

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

function CookingModeKeepAwake() {
  useKeepAwake('cooking-mode-hands-free');
  return null;
}

type CookingModePlusFlowProps = {
  recipe: RecipeDetail['recipe'];
  steps: RecipeStep[];
  ingredients: MentionableIngredient[];
  catalogStepImages?: readonly CatalogStepImage[];
  initialStepIndex?: number;
  handsFreeEnabled?: boolean;
  onFinish: (stepIndex?: number) => void;
};

export function CookingModePlusFlow({
  recipe,
  steps,
  ingredients,
  catalogStepImages = [],
  initialStepIndex = 0,
  handsFreeEnabled = false,
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
      handsFreeEnabled={handsFreeEnabled}
      onFinish={onFinish}
    />
  );
}

function CookingModePlusStepFlow({
  steps,
  ingredients,
  catalogStepImages = [],
  initialStepIndex = 0,
  handsFreeEnabled = false,
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
    activeDurationSeconds,
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
  const onPreviousStep = useCallback(() => {
    if (stepIndex === 0) return false;
    setStepIndex((value) => Math.max(0, value - 1));
    return true;
  }, [stepIndex]);
  const handsFreeStartedRef = useRef(false);
  const timerWasRunningBeforeHandsFreePauseRef = useRef(false);
  const pauseHandsFree = useCallback(
    (pauseVoice: () => void) => {
      timerWasRunningBeforeHandsFreePauseRef.current = running;
      pauseVoice();
      pauseTimer();
    },
    [pauseTimer, running],
  );
  const voice = useCookingModeVoice({
    stepId: currentStep.id,
    currentStepText,
    stepIngredients,
    onNextStep,
    onPreviousStep,
    onStartTimer: startTimer,
    onPauseHandsFree: pauseHandsFree,
    onFinish: finish,
  });
  const displayedDurationSeconds = activeDurationSeconds || durationSeconds;

  const resumeHandsFree = useCallback(() => {
    voice.resumeHandsFree();
    if (timerWasRunningBeforeHandsFreePauseRef.current) startTimer();
  }, [startTimer, voice.resumeHandsFree]);
  const pauseHandsFreeFromUi = useCallback(
    () => pauseHandsFree(voice.pauseHandsFree),
    [pauseHandsFree, voice.pauseHandsFree],
  );
  const endHandsFree = useCallback(() => {
    voice.endHandsFree();
    pauseTimer();
  }, [pauseTimer, voice.endHandsFree]);

  useEffect(() => {
    if (!handsFreeEnabled || handsFreeStartedRef.current) return;
    handsFreeStartedRef.current = true;
    voice.startHandsFree();
  }, [handsFreeEnabled, voice.startHandsFree]);

  return (
    <>
      {voice.handsFreeEnabled && voice.status !== 'paused' ? <CookingModeKeepAwake /> : null}
      <CookingModeStep
        steps={steps}
        stepIndex={stepIndex}
        currentStep={currentStep}
        currentStepImageUrl={currentStepImageUrl}
        mentionIngredients={ingredients}
        stepIngredients={stepIngredients}
        durationSeconds={displayedDurationSeconds}
        remainingSeconds={remainingSeconds}
        timerRunning={running}
        voice={voice}
        onStartTimer={startTimer}
        onPauseTimer={pauseTimer}
        onResetTimer={resetTimer}
        onPreviousStep={voice.onPreviousStep}
        onNextStep={voice.onNextStep}
        onPauseHandsFree={pauseHandsFreeFromUi}
        onResumeHandsFree={resumeHandsFree}
        onEndHandsFree={endHandsFree}
      />
    </>
  );
}
