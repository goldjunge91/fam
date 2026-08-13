import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { persistOffProductIfNeeded } from '@/features/inventory/persist-off-product';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';
import { getDatabase } from '@/lib/db/client';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { toGramsEquivalent } from '@/lib/units';

import { pickRecipeCoverImage, uploadRecipeCoverImage } from './recipe-cover';
import { uploadRecipeStepImage } from './recipe-step-image';
import {
  type DietaryTag,
  type Difficulty,
  type DishType,
  useAddComponentMutation,
  useAddItemMutation,
  useAddRecipeMutation,
  useAddStepIngredientMutation,
  useAddStepMutation,
  useRecipeDetail,
  useUpdateRecipeMutation,
  useUpdateStepMutation,
} from './use-recipes';
import { RecipeWizardStepBasics } from './wizard/recipe-wizard-step-basics';
import { RecipeWizardStepPreview } from './wizard/recipe-wizard-step-preview';
import { RecipeWizardStepSteps } from './wizard/recipe-wizard-step-steps';
import {
  type IngredientComponentGroup,
  newIngredient,
  newWizardStep,
  type WizardStepItem,
} from './wizard/types';

export function RecipeCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const { activeHouseholdId } = useActiveHousehold();

  const { data } = useRecipeDetail(id);
  const addRecipe = useAddRecipeMutation();
  const updateRecipe = useUpdateRecipeMutation();
  const addComponent = useAddComponentMutation();
  const addItem = useAddItemMutation();
  const addProduct = useAddProductMutation();
  const addStep = useAddStepMutation();
  const updateStep = useUpdateStepMutation();
  const addStepIngredient = useAddStepIngredientMutation();

  const isEditing = !!data;
  const householdId = data?.recipe.household_id ?? activeHouseholdId ?? undefined;

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [defaultServings, setDefaultServings] = useState(4);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [dishTypes, setDishTypes] = useState<DishType[]>([]);
  const [dietaryTags, setDietaryTags] = useState<DietaryTag[]>([]);
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [localCoverUri, setLocalCoverUri] = useState<string | null>(null);
  const [existingCoverPath, setExistingCoverPath] = useState<string | null>(null);

  const [components, setComponents] = useState<IngredientComponentGroup[]>([
    { id: 'comp-1', title: 'Zutaten', items: [newIngredient()] },
  ]);

  const [wizardSteps, setWizardSteps] = useState<WizardStepItem[]>([newWizardStep()]);

  useEffect(() => {
    if (!data) return;
    setTitle(data.recipe.title);
    setDescription(data.recipe.instructions ?? '');
    setCookTimeMinutes(data.recipe.cook_time_minutes ? String(data.recipe.cook_time_minutes) : '');
    setDefaultServings(data.recipe.default_servings);
    setDifficulty(data.recipe.difficulty);
    setDishTypes(data.recipe.dish_types);
    setDietaryTags(data.recipe.dietary_tags);
    setHashtagsInput(data.recipe.hashtags.join(' '));
    setExistingCoverPath(data.recipe.cover_image_path);
    // Zutaten-Komponenten werden beim Bearbeiten bewusst nicht aus den
    // vorhandenen recipe_components rekonstruiert — nur die Rezeptfelder oben
    // sind editierbar, Zutaten bleiben ein reiner Neuanlage-Schritt.
  }, [data]);

  async function handlePickCover() {
    const uri = await pickRecipeCoverImage();
    if (uri) setLocalCoverUri(uri);
  }

  function handleAddIngredient(componentId: string) {
    setComponents((prev) =>
      prev.map((comp) =>
        comp.id === componentId ? { ...comp, items: [...comp.items, newIngredient()] } : comp,
      ),
    );
  }

  function handleRemoveIngredient(componentId: string, ingredientId: string) {
    setComponents((prev) =>
      prev.map((comp) =>
        comp.id === componentId
          ? { ...comp, items: comp.items.filter((item) => item.id !== ingredientId) }
          : comp,
      ),
    );
  }

  function handleSelectProduct(
    componentId: string,
    ingredientId: string,
    product: OpenFoodFactsProduct,
  ) {
    setComponents((prev) =>
      prev.map((comp) => {
        if (comp.id !== componentId) return comp;
        return {
          ...comp,
          items: comp.items.map((item) =>
            item.id === ingredientId ? { ...item, product, productQuery: product.name } : item,
          ),
        };
      }),
    );
  }

  function handleUpdateIngredientQuery(componentId: string, ingredientId: string, query: string) {
    setComponents((prev) =>
      prev.map((comp) => {
        if (comp.id !== componentId) return comp;
        return {
          ...comp,
          items: comp.items.map((item) =>
            item.id === ingredientId ? { ...item, productQuery: query, product: null } : item,
          ),
        };
      }),
    );
  }

  function handleUpdateQuantity(componentId: string, ingredientId: string, quantity: string) {
    setComponents((prev) =>
      prev.map((comp) => {
        if (comp.id !== componentId) return comp;
        return {
          ...comp,
          items: comp.items.map((item) =>
            item.id === ingredientId ? { ...item, quantity } : item,
          ),
        };
      }),
    );
  }

  function handleUpdateUnit(componentId: string, ingredientId: string, unit: string) {
    setComponents((prev) =>
      prev.map((comp) => {
        if (comp.id !== componentId) return comp;
        return {
          ...comp,
          items: comp.items.map((item) => (item.id === ingredientId ? { ...item, unit } : item)),
        };
      }),
    );
  }

  function handleAddComponentGroup() {
    setComponents((prev) => [
      ...prev,
      {
        id: `comp-${Date.now()}`,
        title: `Zutaten-Gruppe ${prev.length + 1}`,
        items: [newIngredient()],
      },
    ]);
  }

  function handleCancel() {
    const hasInput = title.trim() || components.some((c) => c.items.some((i) => i.product));
    if (!hasInput) {
      router.back();
      return;
    }
    Alert.alert('Änderungen verwerfen?', 'Deine Eingaben gehen verloren.', [
      { text: 'Zurück', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  /**
   * Seite 1 "Weiter": reine Navigation, keine Persistenz. Das Rezept bleibt
   * bis zum finalen Speichern (Seite 3) ausschliesslich im Formular-State —
   * so entsteht waehrend des Bearbeitens kein einziger Schreibzugriff auf
   * SQLite/Outbox und damit kein Sync-Traffic, bevor der Nutzer wirklich
   * fertig ist.
   */
  function handleNextFromBasics() {
    if (!title.trim()) return;
    setWizardStep(2);
  }

  /**
   * Seite 3 "Speichern": persistiert das komplette Rezept — Basisdaten,
   * Titelbild, Zutaten und Schritte — in einem Zug. Vorher wurde bewusst
   * nichts geschrieben (siehe `handleNextFromBasics`); dieser eine Schwung
   * geht durch die normale Outbox (#46) und wird von deren Debounce als ein
   * einzelner Push behandelt, statt vieler kleiner waehrend des Bearbeitens.
   */
  async function handleFinalSave() {
    if (!title.trim() || !householdId || !userId) return;
    setSaving(true);
    try {
      const hashtags = hashtagsInput
        .split(/[\s,#]+/)
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      const cookTime = Number.parseInt(cookTimeMinutes, 10);

      const metadata = {
        instructions: description.trim() || null,
        cook_time_minutes: Number.isFinite(cookTime) && cookTime > 0 ? cookTime : null,
        difficulty,
        dish_types: dishTypes,
        dietary_tags: dietaryTags,
        hashtags,
        default_servings: defaultServings,
      };

      const newRecipeId = isEditing
        ? data.recipe.id
        : (
            await addRecipe.mutateAsync({
              household_id: householdId,
              title: title.trim(),
              created_by: userId,
              ...metadata,
            })
          ).id;

      let coverPath = existingCoverPath;
      if (localCoverUri) {
        coverPath = await uploadRecipeCoverImage(localCoverUri, householdId, newRecipeId);
      }

      if (isEditing || coverPath) {
        await updateRecipe.mutateAsync({
          id: newRecipeId,
          household_id: householdId,
          title: title.trim(),
          cover_image_path: coverPath,
          ...metadata,
        });
      }

      // Wizard-Seiten 2/3 referenzieren Zutaten ueber die lokale
      // IngredientItem.id (siehe recipe-wizard-step-steps.tsx) — diese Map
      // uebersetzt sie nach dem Persistieren auf die echten
      // recipe_component_items.id fuer die Schritt-Zutaten-Verknuepfung unten.
      const localToRealItemId = new Map<string, string>();

      if (!isEditing) {
        const db = await getDatabase();
        // Nur zur UI-Rueckmeldung ("nicht umrechenbar"), falls beim Speichern
        // ein Stueckgewicht fehlt — der Nutzer sieht die Markierung erst
        // wieder, wenn er auf Seite 1 zurueckgeht, deshalb wird sie trotzdem
        // gepflegt statt stillschweigend verworfen.
        const updatedComponents: IngredientComponentGroup[] = [];

        for (const comp of components) {
          const readyItems = comp.items.filter(
            (item) => item.product && Number.parseFloat(item.quantity) > 0,
          );
          if (readyItems.length === 0) {
            updatedComponents.push(comp);
            continue;
          }

          const updatedItemsById = new Map(comp.items.map((item) => [item.id, item]));
          const resolvedItems: { itemId: string; productId: string; grams: number }[] = [];

          for (const item of readyItems) {
            if (!item.product) continue;
            const productId = await persistOffProductIfNeeded(item.product, userId, addProduct);
            if (!productId) continue;

            const productRow = await db.getFirstAsync<{ serving_size_g: number | null }>(
              'select serving_size_g from products where id = ?',
              [productId],
            );
            const quantity = Number.parseFloat(item.quantity);
            const conversion = toGramsEquivalent(quantity, item.unit, {
              servingWeightG: productRow?.serving_size_g ?? undefined,
            });

            if (!conversion.convertible) {
              updatedItemsById.set(item.id, { ...item, notConvertible: true });
              continue;
            }
            resolvedItems.push({ itemId: item.id, productId, grams: conversion.grams });
          }

          if (resolvedItems.length === 0) {
            updatedComponents.push({
              ...comp,
              items: comp.items.map((item) => updatedItemsById.get(item.id) ?? item),
            });
            continue;
          }

          const totalGrams = resolvedItems.reduce((sum, r) => sum + r.grams, 0);
          const component = await addComponent.mutateAsync({
            recipe_id: newRecipeId,
            household_id: householdId,
            name: comp.title,
            serving_grams: totalGrams > 0 ? totalGrams : null,
          });

          for (const resolved of resolvedItems) {
            const source = updatedItemsById.get(resolved.itemId);
            if (!source) continue;
            const added = await addItem.mutateAsync({
              component_id: component.id,
              recipe_id: newRecipeId,
              household_id: householdId,
              product_id: resolved.productId,
              grams: resolved.grams,
              quantity: Number.parseFloat(source.quantity),
              unit: source.unit,
            });
            localToRealItemId.set(resolved.itemId, added.id);
            updatedItemsById.set(resolved.itemId, { ...source, notConvertible: false });
          }

          updatedComponents.push({
            ...comp,
            items: comp.items.map((item) => updatedItemsById.get(item.id) ?? item),
          });
        }

        setComponents(updatedComponents);
      }

      let position = 0;
      for (const step of wizardSteps) {
        if (!step.text.trim()) continue;

        const created = await addStep.mutateAsync({
          recipe_id: newRecipeId,
          household_id: householdId,
          position,
          text: step.text.trim(),
        });

        if (step.localImageUri) {
          const imagePath = await uploadRecipeStepImage(
            step.localImageUri,
            householdId,
            created.id,
          );
          await updateStep.mutateAsync({
            id: created.id,
            recipe_id: newRecipeId,
            household_id: householdId,
            position,
            text: step.text.trim(),
            image_path: imagePath,
          });
        }

        for (const localItemId of step.ingredientIds) {
          const realItemId = localToRealItemId.get(localItemId);
          // Zutat wurde nicht persistiert (kein Produkt gewaehlt oder nicht
          // umrechenbar) — Referenz verwerfen statt auf eine nie existente
          // Zeile zu verweisen.
          if (!realItemId) continue;
          await addStepIngredient.mutateAsync({
            step_id: created.id,
            item_id: realItemId,
            recipe_id: newRecipeId,
            household_id: householdId,
          });
        }

        position += 1;
      }

      router.replace({ pathname: '/recipe/detail', params: { id: newRecipeId } });
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Konnte nicht speichern.');
    } finally {
      setSaving(false);
    }
  }

  const coverPreviewUri = localCoverUri;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke="#FF5262"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {isEditing ? 'Rezept bearbeiten' : `Neues Rezept (${wizardStep}/3)`}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        {wizardStep === 1 ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <RecipeWizardStepBasics
              title={title}
              onTitleChange={setTitle}
              description={description}
              onDescriptionChange={setDescription}
              cookTimeMinutes={cookTimeMinutes}
              onCookTimeMinutesChange={setCookTimeMinutes}
              defaultServings={defaultServings}
              onDefaultServingsChange={setDefaultServings}
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              dishTypes={dishTypes}
              onDishTypesChange={setDishTypes}
              dietaryTags={dietaryTags}
              onDietaryTagsChange={setDietaryTags}
              hashtagsInput={hashtagsInput}
              onHashtagsInputChange={setHashtagsInput}
              coverPreviewUri={coverPreviewUri}
              onPickCover={handlePickCover}
              components={components}
              onAddIngredient={handleAddIngredient}
              onRemoveIngredient={handleRemoveIngredient}
              onSelectProduct={handleSelectProduct}
              onUpdateIngredientQuery={handleUpdateIngredientQuery}
              onUpdateQuantity={handleUpdateQuantity}
              onUpdateUnit={handleUpdateUnit}
              onAddComponentGroup={handleAddComponentGroup}
              saving={saving}
              onCancel={handleCancel}
              onNext={handleNextFromBasics}
            />
          </ScrollView>
        ) : wizardStep === 2 ? (
          <RecipeWizardStepSteps
            steps={wizardSteps}
            onStepsChange={setWizardSteps}
            components={components}
            onBack={() => setWizardStep(1)}
            onNext={() => setWizardStep(3)}
          />
        ) : (
          <RecipeWizardStepPreview
            coverPreviewUri={coverPreviewUri}
            title={title}
            description={description}
            cookTimeMinutes={cookTimeMinutes}
            defaultServings={defaultServings}
            difficulty={difficulty}
            dishTypes={dishTypes}
            dietaryTags={dietaryTags}
            hashtagsInput={hashtagsInput}
            components={components}
            steps={wizardSteps}
            saving={saving}
            onBack={() => setWizardStep(2)}
            onSave={handleFinalSave}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF5262',
  },
  keyboardAvoider: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
