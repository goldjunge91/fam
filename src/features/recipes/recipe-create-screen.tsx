import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
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
  useDeleteComponentMutation,
  useDeleteItemMutation,
  useDeleteStepMutation,
  useRecipeDetail,
  useRemoveStepIngredientMutation,
  useUpdateComponentMutation,
  useUpdateItemMutation,
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
  const updateComponent = useUpdateComponentMutation();
  const deleteComponent = useDeleteComponentMutation();
  const addItem = useAddItemMutation();
  const updateItem = useUpdateItemMutation();
  const deleteItem = useDeleteItemMutation();
  const addProduct = useAddProductMutation();
  const addStep = useAddStepMutation();
  const updateStep = useUpdateStepMutation();
  const deleteStep = useDeleteStepMutation();
  const addStepIngredient = useAddStepIngredientMutation();
  const removeStepIngredient = useRemoveStepIngredientMutation();

  const isEditing = !!data;
  const householdId = data?.recipe.household_id ?? activeHouseholdId ?? undefined;

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
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
    { id: 'comp-1', title: 'Zutaten', items: [newIngredient()], existingComponentId: null },
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

    // Zutaten-Komponenten aus den vorhandenen recipe_components/-items
    // rekonstruieren, damit sie beim Bearbeiten nicht verschwinden. Nur der
    // Flachfall (Positionen zeigen auf ein product_id) wird abgebildet — eine
    // Position, die stattdessen auf eine Unterkomponente zeigt
    // (sub_component_id, Baukasten-Verschachtelung), wird uebersprungen: das
    // Wizard-Formular kennt kein Editieren verschachtelter Komponenten, eine
    // grobe Rekonstruktion wuerde beim Speichern eher Daten verfaelschen als
    // helfen.
    const hydrated: IngredientComponentGroup[] = data.components.map((component) => ({
      id: component.id,
      title: component.name,
      existingComponentId: component.id,
      items: data.items
        .filter((item) => item.component_id === component.id && item.product_id !== null)
        .map((item) => {
          const product = item.product_id ? data.productsById.get(item.product_id) : undefined;
          return {
            id: item.id,
            product: null,
            productQuery: product?.name ?? '',
            quantity: item.quantity !== null ? String(item.quantity) : String(item.grams),
            unit: item.unit,
            notConvertible: false,
            existingItemId: item.id,
            existingProductId: item.product_id,
          };
        }),
    }));
    if (hydrated.length > 0) setComponents(hydrated);

    // Zubereitungsschritte aus recipe_steps rekonstruieren — dieselbe Luecke
    // wie bei den Zutaten: ohne diese Hydration blieb beim Bearbeiten nur ein
    // leeres Schrittfeld sichtbar, und ein Speichern haette einen doppelten
    // Schritt mit falscher position angelegt statt die bestehenden zu zeigen.
    const hydratedSteps: WizardStepItem[] = data.steps
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((step) => ({
        id: step.id,
        serverId: step.id,
        text: step.text,
        localImageUri: null,
        existingImagePath: step.image_path,
        // ingredientIds bei recipe_steps sind bereits echte
        // recipe_component_items.id-Werte — decken sich mit den oben
        // hydrierten IngredientItem.id (dort ebenfalls die echte ID), daher
        // ohne Umweg direkt uebernehmbar.
        ingredientIds: step.ingredientIds,
      }));
    if (hydratedSteps.length > 0) setWizardSteps(hydratedSteps);
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
        existingComponentId: null,
      },
    ]);
  }

  function handleCancel() {
    const hasInput =
      title.trim() || components.some((c) => c.items.some((i) => i.product || i.existingProductId));
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

      {
        const db = await getDatabase();
        // Nur zur UI-Rueckmeldung ("nicht umrechenbar"), falls beim Speichern
        // ein Stueckgewicht fehlt — der Nutzer sieht die Markierung erst
        // wieder, wenn er auf Seite 1 zurueckgeht, deshalb wird sie trotzdem
        // gepflegt statt stillschweigend verworfen.
        const updatedComponents: IngredientComponentGroup[] = [];

        // Bestehende Komponenten/Positionen (Bearbeiten-Fall) fuer den
        // Abgleich am Ende: alles, was hier nicht mehr auftaucht, wurde vom
        // Nutzer entfernt und muss geloescht werden — ohne diesen Abgleich
        // blieben geloeschte Zutaten in der DB stehen ("Geisterzutaten").
        const originalComponentIds = new Set(data ? data.components.map((c) => c.id) : []);
        const originalItemByComponent = new Map<string, string>();
        if (data) {
          for (const item of data.items) {
            if (item.product_id !== null) originalItemByComponent.set(item.id, item.component_id);
          }
        }
        const keptComponentIds = new Set<string>();
        const keptItemIds = new Set<string>();

        for (const comp of components) {
          const updatedItemsById = new Map(comp.items.map((item) => [item.id, item]));
          type Resolved = {
            sourceItemId: string;
            existingItemId: string | null;
            productId: string;
            grams: number;
            quantity: number;
            unit: string;
          };
          const resolvedItems: Resolved[] = [];

          for (const item of comp.items) {
            const quantity = Number.parseFloat(item.quantity);
            if (!(quantity > 0)) continue;

            // item.product gesetzt = Nutzer hat (neu) eine OFF-Suche
            // abgeschlossen — gilt auch, wenn dieselbe Zeile vorher schon
            // eine andere Zutat war (Produkt-Ersetzung: alte Position wird
            // unten ueber den originalItemByComponent-Abgleich geloescht,
            // hier entsteht eine neue).
            let productId: string | null = null;
            if (item.product) {
              productId = await persistOffProductIfNeeded(item.product, userId, addProduct);
            } else if (item.existingProductId) {
              productId = item.existingProductId;
            }
            if (!productId) continue;

            const productRow = await db.getFirstAsync<{ serving_size_g: number | null }>(
              'select serving_size_g from products where id = ?',
              [productId],
            );
            const conversion = toGramsEquivalent(quantity, item.unit, {
              servingWeightG: productRow?.serving_size_g ?? undefined,
            });

            if (!conversion.convertible) {
              updatedItemsById.set(item.id, { ...item, notConvertible: true });
              continue;
            }
            resolvedItems.push({
              sourceItemId: item.id,
              existingItemId: item.product ? null : item.existingItemId,
              productId,
              grams: conversion.grams,
              quantity,
              unit: item.unit,
            });
          }

          if (resolvedItems.length === 0) {
            updatedComponents.push({
              ...comp,
              items: comp.items.map((item) => updatedItemsById.get(item.id) ?? item),
            });
            continue;
          }

          const totalGrams = resolvedItems.reduce((sum, r) => sum + r.grams, 0);

          let realComponentId: string;
          if (comp.existingComponentId) {
            keptComponentIds.add(comp.existingComponentId);
            await updateComponent.mutateAsync({
              id: comp.existingComponentId,
              recipe_id: newRecipeId,
              household_id: householdId,
              name: comp.title,
              serving_grams: totalGrams > 0 ? totalGrams : null,
            });
            realComponentId = comp.existingComponentId;
          } else {
            const created = await addComponent.mutateAsync({
              recipe_id: newRecipeId,
              household_id: householdId,
              name: comp.title,
              serving_grams: totalGrams > 0 ? totalGrams : null,
            });
            realComponentId = created.id;
          }

          for (const resolved of resolvedItems) {
            const source = updatedItemsById.get(resolved.sourceItemId);
            if (!source) continue;

            if (resolved.existingItemId) {
              keptItemIds.add(resolved.existingItemId);
              await updateItem.mutateAsync({
                id: resolved.existingItemId,
                recipe_id: newRecipeId,
                household_id: householdId,
                grams: resolved.grams,
                quantity: resolved.quantity,
                unit: resolved.unit,
              });
              localToRealItemId.set(resolved.sourceItemId, resolved.existingItemId);
            } else {
              const added = await addItem.mutateAsync({
                component_id: realComponentId,
                recipe_id: newRecipeId,
                household_id: householdId,
                product_id: resolved.productId,
                grams: resolved.grams,
                quantity: resolved.quantity,
                unit: resolved.unit,
              });
              localToRealItemId.set(resolved.sourceItemId, added.id);
            }
            updatedItemsById.set(resolved.sourceItemId, { ...source, notConvertible: false });
          }

          updatedComponents.push({
            ...comp,
            items: comp.items.map((item) => updatedItemsById.get(item.id) ?? item),
          });
        }

        setComponents(updatedComponents);

        if (isEditing) {
          for (const componentId of originalComponentIds) {
            if (!keptComponentIds.has(componentId)) {
              await deleteComponent.mutateAsync({
                id: componentId,
                recipe_id: newRecipeId,
                household_id: householdId,
              });
            }
          }
          for (const [itemId, componentId] of originalItemByComponent) {
            // Nur explizit loeschen, wenn die Komponente selbst erhalten
            // blieb — sonst hat deleteComponent die Position bereits
            // kaskadierend entfernt.
            if (!keptItemIds.has(itemId) && keptComponentIds.has(componentId)) {
              await deleteItem.mutateAsync({
                id: itemId,
                recipe_id: newRecipeId,
                household_id: householdId,
              });
            }
          }
        }
      }

      const stepsDb = await getDatabase();
      const originalStepIds = new Set(data ? data.steps.map((s) => s.id) : []);
      const keptStepIds = new Set<string>();

      let position = 0;
      for (const step of wizardSteps) {
        if (!step.text.trim()) continue;

        let stepId: string;
        if (step.serverId) {
          // Bestehender Schritt: aktualisieren statt einen zweiten mit
          // derselben position anzulegen.
          keptStepIds.add(step.serverId);
          stepId = step.serverId;
          const imagePath = step.localImageUri
            ? await uploadRecipeStepImage(step.localImageUri, householdId, stepId)
            : step.existingImagePath;
          await updateStep.mutateAsync({
            id: stepId,
            recipe_id: newRecipeId,
            household_id: householdId,
            position,
            text: step.text.trim(),
            image_path: imagePath,
          });

          // Bestehende Zutaten-Verknuepfungen dieses Schritts komplett
          // ersetzen statt einzeln zu diffen — bei wenigen Zutaten je Schritt
          // kein spuerbarer Mehraufwand, aber deutlich weniger Fehlerflaeche.
          const existingLinks = await stepsDb.getAllAsync<{ id: string }>(
            'select id from recipe_step_ingredients where step_id = ? and deleted_at is null',
            [stepId],
          );
          for (const link of existingLinks) {
            await removeStepIngredient.mutateAsync({
              id: link.id,
              recipe_id: newRecipeId,
              household_id: householdId,
            });
          }
        } else {
          const created = await addStep.mutateAsync({
            recipe_id: newRecipeId,
            household_id: householdId,
            position,
            text: step.text.trim(),
          });
          stepId = created.id;

          if (step.localImageUri) {
            const imagePath = await uploadRecipeStepImage(step.localImageUri, householdId, stepId);
            await updateStep.mutateAsync({
              id: stepId,
              recipe_id: newRecipeId,
              household_id: householdId,
              position,
              text: step.text.trim(),
              image_path: imagePath,
            });
          }
        }

        for (const localItemId of step.ingredientIds) {
          const realItemId = localToRealItemId.get(localItemId);
          // Zutat wurde nicht persistiert (kein Produkt gewaehlt, nicht
          // umrechenbar, oder in diesem Bearbeiten-Durchgang entfernt) —
          // Referenz verwerfen statt auf eine nie existente/geloeschte Zeile
          // zu verweisen.
          if (!realItemId) continue;
          await addStepIngredient.mutateAsync({
            step_id: stepId,
            item_id: realItemId,
            recipe_id: newRecipeId,
            household_id: householdId,
          });
        }

        position += 1;
      }

      // Schritte, die urspruenglich existierten aber jetzt aus dem Formular
      // entfernt wurden, loeschen — sonst blieben sie unsichtbar in der DB
      // stehen (dieselbe "Geisterzutaten"-Logik wie bei den Komponenten oben).
      for (const stepId of originalStepIds) {
        if (!keptStepIds.has(stepId)) {
          await deleteStep.mutateAsync({
            id: stepId,
            recipe_id: newRecipeId,
            household_id: householdId,
          });
        }
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
    <View style={styles.root}>
      <GradientBackground colors={['#FFD2B9', '#F8F4EF', '#EEE7F4']} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title={isEditing ? 'Rezept bearbeiten' : 'Rezept erstellen'}
          leading={
            <HeaderIconButton label="Zurück" onPress={handleCancel}>
              <ThemedText style={styles.backGlyph}>‹</ThemedText>
            </HeaderIconButton>
          }
        />

        <View style={styles.progressRow}>
          {[1, 2, 3, 4].map((step) => (
            <View
              key={step}
              style={[styles.progressSegment, step <= wizardStep && styles.progressSegmentActive]}
            />
          ))}
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={12}>
          {wizardStep === 1 ? (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <RecipeWizardStepBasics
                mode="details"
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
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <RecipeWizardStepBasics
                mode="ingredients"
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
                onCancel={() => setWizardStep(1)}
                onNext={() => setWizardStep(3)}
              />
            </ScrollView>
          ) : wizardStep === 3 ? (
            <RecipeWizardStepSteps
              steps={wizardSteps}
              onStepsChange={setWizardSteps}
              components={components}
              onBack={() => setWizardStep(2)}
              onNext={() => setWizardStep(4)}
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
              onBack={() => setWizardStep(3)}
              onSave={handleFinalSave}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  backGlyph: { ...FontSize[27], lineHeight: 29, fontWeight: 400 },
  progressRow: {
    height: 16,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
  },
  progressSegment: { flex: 1, height: 4, borderRadius: 3, backgroundColor: '#DFD6DD' },
  progressSegmentActive: { backgroundColor: '#755B79' },
  keyboardAvoider: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
