import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { usePremium } from '@/features/premium/premium-provider';
import { celebrate } from '@/lib/celebration';
import { recordActivity } from '@/lib/streak';
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
import { useCookingTimer } from '../hooks/use-cooking-timer';
import { useRecipeDetail } from '../hooks/use-recipes';

function CookingModeLoading() {
  const { colors } = useTheme();

  return (
    <CookingModeShell title="Kochmodus" backLabel="Zurück">
      <Txt
        variant="caption"
        tone="secondary"
        className="p-six text-center"
        style={{ color: colors.textMuted }}>
        Kochmodus wird geladen…
      </Txt>
    </CookingModeShell>
  );
}

export function CookingModeScreen() {
  const { id, slug } = useLocalSearchParams<{ id?: string; slug?: string }>();
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
  const timerStep = data?.steps[Math.min(stepIndex, Math.max((data?.steps.length ?? 0) - 1, 0))];
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
  if (!hasPlus) return <FreeCookingMode data={data} />;
  if (finished) {
    return (
      <CookingModeFinished
        recipe={data.recipe}
        onBack={() => setFinished(false)}
        isCatalog={isCatalog}
      />
    );
  }

  const currentStep = data.steps[Math.min(stepIndex, Math.max(data.steps.length - 1, 0))];
  const mentionIngredients = flattenRecipeItems(data.items, data.productsById);

  return (
    <CookingModeShell title="Kochmodus" backLabel="Kochmodus schließen">
      {currentStep ? (
        <CookingModeStep
          steps={data.steps}
          stepIndex={stepIndex}
          currentStep={currentStep}
          currentStepImageUrl={catalogStepImageUrl}
          mentionIngredients={mentionIngredients}
          durationSeconds={durationSeconds}
          remainingSeconds={remainingSeconds}
          timerRunning={running}
          onStartTimer={startTimer}
          onPauseTimer={pauseTimer}
          onResetTimer={resetTimer}
          onPreviousStep={() => setStepIndex((value) => Math.max(0, value - 1))}
          onNextStep={() => {
            if (stepIndex >= data.steps.length - 1) {
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
