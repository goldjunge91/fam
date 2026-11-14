import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
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
  const [handsFreeChoice, setHandsFreeChoice] = useState<{
    key: string;
    enabled: boolean;
  } | null>(null);
  const handsFreePromptedRef = useRef<string | null>(null);
  const completedRecipeIdRef = useRef<string | null>(null);
  const handsFreePromptKey =
    data && data.steps.length > 0
      ? `${isCatalog ? 'catalog' : 'recipe'}:${isCatalog ? (slug ?? data.recipe.id) : data.recipe.id}`
      : null;
  const handsFreeEnabled = handsFreeChoice?.key === handsFreePromptKey && handsFreeChoice.enabled;
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
    if (!hasPlus || !handsFreePromptKey || handsFreePromptedRef.current === handsFreePromptKey) {
      return;
    }

    handsFreePromptedRef.current = handsFreePromptKey;
    setHandsFreeChoice({ key: handsFreePromptKey, enabled: false });
    Alert.alert(
      'Hands-free im Kochmodus?',
      'Soll der aktuelle Schritt vorgelesen werden und danach auf einen Sprachbefehl warten?',
      [
        {
          text: 'Nein',
          style: 'cancel',
          onPress: () => setHandsFreeChoice({ key: handsFreePromptKey, enabled: false }),
        },
        {
          text: 'Hands-free aktivieren',
          onPress: () => setHandsFreeChoice({ key: handsFreePromptKey, enabled: true }),
        },
      ],
    );
  }, [handsFreePromptKey, hasPlus]);

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
        handsFreeEnabled={handsFreeEnabled}
        onFinish={(stepIndex) => {
          if (stepIndex !== undefined) setLastPlusStepIndex(stepIndex);
          setHandsFreeChoice((current) =>
            current?.key === handsFreePromptKey ? { ...current, enabled: false } : current,
          );
          setFinished(true);
        }}
      />
    </CookingModeShell>
  );
}
