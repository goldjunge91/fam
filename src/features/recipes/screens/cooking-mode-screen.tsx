import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Txt } from '@/constants/ui';
import { celebrate } from '@/features/gamification/celebration';
import { recordActivity } from '@/features/gamification/streak';
import { usePremium } from '@/features/premium/premium-provider';
import {
  toCookingRecipeDetail,
  useCatalogImageUrl,
  useCatalogRecipe,
} from '../catalog/use-recipe-catalog';
import { CookingModeFinished } from '../components/cooking-mode/cooking-mode-finished';
import { CookingModeNoSteps } from '../components/cooking-mode/cooking-mode-no-steps';
import { CookingModeShell } from '../components/cooking-mode/cooking-mode-shell';
import { CookingModeStep } from '../components/cooking-mode/cooking-mode-step';
import { getCookingTimerDurationSeconds } from '../components/cooking-mode/cooking-mode-timer';
import { FreeCookingMode } from '../components/cooking-mode/free-cooking-mode';
import { flattenRecipeItems } from '../domain/ingredient-mentions';
import {
  replaceIngredientInText,
  replaceIngredientName,
  type TemporaryIngredientSwap,
} from '../domain/temporary-ingredient-swap';
import { useCookingTimer } from '../hooks/use-cooking-timer';
import { useRecipeDetail } from '../hooks/use-recipes';

const styles = StyleSheet.create((theme) => ({
  loading: {
    padding: theme.space.xxxl,
    textAlign: 'center',
  },
}));

function CookingModeLoading() {
  return (
    <CookingModeShell title="Kochmodus" backLabel="Zurück">
      <Txt variant="caption" tone="secondary" style={styles.loading}>
        Kochmodus wird geladen…
      </Txt>
    </CookingModeShell>
  );
}

function firstSearchParam(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

export function CookingModeScreen() {
  const { id, slug, swapIngredient, swapReplacement } = useLocalSearchParams<{
    id?: string;
    slug?: string;
    swapIngredient?: string;
    swapReplacement?: string;
  }>();
  const temporarySwap = useMemo<TemporaryIngredientSwap | null>(() => {
    const ingredientName = firstSearchParam(swapIngredient);
    const replacement = firstSearchParam(swapReplacement);
    if (
      !ingredientName ||
      !replacement ||
      ingredientName.length > 120 ||
      replacement.length > 120
    ) {
      return null;
    }
    return { ingredientName, replacement };
  }, [swapIngredient, swapReplacement]);
  const recipeQuery = useRecipeDetail(id);
  const catalogQuery = useCatalogRecipe(slug);
  const catalogData = catalogQuery.data;
  const data = recipeQuery.data ?? (catalogData ? toCookingRecipeDetail(catalogData) : null);
  const isCatalog = !id && Boolean(slug);
  const isLoading = isCatalog ? catalogQuery.isLoading : recipeQuery.isLoading;
  const { hasPlus } = usePremium();
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const completedRecipeIdRef = useRef<string | null>(null);
  const displayedSteps = useMemo(
    () =>
      data?.steps.map((step) => ({
        ...step,
        text: replaceIngredientInText(step.text, temporarySwap),
      })) ?? [],
    [data, temporarySwap],
  );
  const displayedIngredients = useMemo(
    () =>
      data
        ? flattenRecipeItems(data.items, data.productsById).map((ingredient) => ({
            ...ingredient,
            name: replaceIngredientName(ingredient.name, temporarySwap),
          }))
        : [],
    [data, temporarySwap],
  );
  const timerStep = displayedSteps[Math.min(stepIndex, Math.max(displayedSteps.length - 1, 0))];
  const catalogStepImagePath = catalogData?.stepImages.find(
    (image) => image.step_id === timerStep?.id,
  )?.storage_path;
  const { data: catalogStepImageUrl } = useCatalogImageUrl(catalogStepImagePath);
  const durationSeconds = getCookingTimerDurationSeconds(timerStep);
  const {
    remainingSeconds,
    running,
    start: startTimer,
    pause: pauseTimer,
    reset: resetTimer,
  } = useCookingTimer({ stepId: timerStep?.id, durationSeconds });

  useEffect(() => {
    const recipeId = data?.recipe.id;
    if (!finished || !recipeId || completedRecipeIdRef.current === recipeId) return;

    completedRecipeIdRef.current = recipeId;
    const result = recordActivity();
    if (result.milestone) {
      try {
        celebrate(`🔥 ${result.count} Tage Streak!`);
      } catch {
        // Optionale Celebration darf den erfolgreichen Kochabschluss nicht blockieren.
      }
    }
  }, [data?.recipe.id, finished]);

  if (isLoading || !data) return <CookingModeLoading />;
  if (!hasPlus) return <FreeCookingMode data={data} temporarySwap={temporarySwap} />;
  if (finished) {
    return (
      <CookingModeFinished
        recipe={data.recipe}
        onBack={() => setFinished(false)}
        isCatalog={isCatalog}
      />
    );
  }

  const currentStep = displayedSteps[Math.min(stepIndex, Math.max(displayedSteps.length - 1, 0))];

  return (
    <CookingModeShell title="Kochmodus" backLabel="Kochmodus schließen">
      {temporarySwap ? (
        <Txt variant="caption" tone="secondary">
          Einmalig ersetzt: {temporarySwap.ingredientName} → {temporarySwap.replacement}
        </Txt>
      ) : null}
      {currentStep ? (
        <CookingModeStep
          steps={displayedSteps}
          stepIndex={stepIndex}
          currentStep={currentStep}
          currentStepImageUrl={catalogStepImageUrl}
          mentionIngredients={displayedIngredients}
          durationSeconds={durationSeconds}
          remainingSeconds={remainingSeconds}
          timerRunning={running}
          onStartTimer={startTimer}
          onPauseTimer={pauseTimer}
          onResetTimer={resetTimer}
          onPreviousStep={() => setStepIndex((value) => Math.max(0, value - 1))}
          onNextStep={() => {
            if (stepIndex >= displayedSteps.length - 1) {
              setFinished(true);
            } else {
              setStepIndex((value) => value + 1);
            }
          }}
        />
      ) : (
        <CookingModeNoSteps recipe={data.recipe} onFinish={() => setFinished(true)} />
      )}
    </CookingModeShell>
  );
}
