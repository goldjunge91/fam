import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Txt } from '@/constants/ui';
import { celebrate } from '@/features/gamification/celebration';
import { recordActivity } from '@/features/gamification/streak';
import { usePremium } from '@/features/premium/premium-provider';
import { toCookingRecipeDetail, useCatalogRecipe } from '../catalog/use-recipe-catalog';
import { CookingModeFinished } from '../components/cooking-mode/cooking-mode-finished';
import { CookingModePlusFlow } from '../components/cooking-mode/cooking-mode-plus-flow';
import { CookingModeShell } from '../components/cooking-mode/cooking-mode-shell';
import { FreeCookingMode } from '../components/cooking-mode/free-cooking-mode';
import { flattenRecipeItems } from '../domain/ingredient-mentions';
import {
  replaceIngredientInText,
  replaceIngredientName,
  type TemporaryIngredientSwap,
} from '../domain/temporary-ingredient-swap';
import { useRecipeDetail } from '../hooks/use-recipes';

const styles = StyleSheet.create((theme) => ({
  loading: {
    padding: theme.space.xxxl,
    textAlign: 'center',
  },
  context: {
    paddingHorizontal: theme.space.xxl,
    paddingTop: theme.space.sm,
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
  const [finished, setFinished] = useState(false);
  const [lastPlusStepIndex, setLastPlusStepIndex] = useState(0);
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

  return (
    <CookingModeShell title="Kochmodus" backLabel="Kochmodus schließen">
      {temporarySwap ? (
        <Txt variant="caption" tone="secondary" style={styles.context}>
          Einmalig ersetzt: {temporarySwap.ingredientName} → {temporarySwap.replacement}
        </Txt>
      ) : null}
      <CookingModePlusFlow
        recipe={data.recipe}
        steps={displayedSteps}
        ingredients={displayedIngredients}
        catalogStepImages={catalogData?.stepImages}
        initialStepIndex={lastPlusStepIndex}
        onFinish={(stepIndex) => {
          if (stepIndex !== undefined) setLastPlusStepIndex(stepIndex);
          setFinished(true);
        }}
      />
    </CookingModeShell>
  );
}
