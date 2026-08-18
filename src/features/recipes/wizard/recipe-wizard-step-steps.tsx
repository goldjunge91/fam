import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, TextInput, TouchableOpacity, View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import Svg, { Path } from 'react-native-svg';
import { ThemedText } from '@/components/theme/themed-text';
import { pickRecipeImage } from '@/features/recipes/recipe-image-uploader';
import { useTheme } from '@/hooks/use-theme';
import type { IngredientComponentGroup, WizardStepItem } from './types';

interface AvailableIngredient {
  /**
   * Die lokale `IngredientItem.id` — nicht `itemId` (recipe_component_items.id).
   * Solange das Rezept nicht final gespeichert ist, existiert noch keine
   * DB-Zeile; der Wizard referenziert Zutaten deshalb ueber ihre stabile
   * Client-ID und uebersetzt erst beim Speichern in echte item-IDs.
   */
  itemId: string;
  label: string;
}

function availableIngredients(components: IngredientComponentGroup[]): AvailableIngredient[] {
  const result: AvailableIngredient[] = [];
  for (const comp of components) {
    for (const item of comp.items) {
      // item.product ist nur bei einer frisch abgeschlossenen OFF-Suche
      // gesetzt. Beim Bearbeiten geladene Zutaten haben stattdessen
      // productQuery/existingProductId (siehe recipe-create-screen.tsx-
      // Hydration) — ohne diesen Fallback wuerden sie hier fehlen.
      const name = item.product?.name ?? (item.existingProductId ? item.productQuery : null);
      if (name) {
        result.push({ itemId: item.id, label: `${name} (${comp.title})` });
      }
    }
  }
  return result;
}

interface RecipeWizardStepStepsProps {
  steps: WizardStepItem[];
  onStepsChange: (steps: WizardStepItem[]) => void;
  components: IngredientComponentGroup[];
  onBack: () => void;
  onNext: () => void;
}

interface StepCardProps {
  step: WizardStepItem;
  index: number;
  ingredients: AvailableIngredient[];
  onUpdateStep: (id: string, patch: Partial<WizardStepItem>) => void;
  onRemoveStep: (id: string) => void;
  onToggleIngredient: (stepId: string, itemId: string) => void;
  onPickImage: (stepId: string) => void;
}

const StepCard = memo(function StepCard({
  step,
  index,
  ingredients,
  onUpdateStep,
  onRemoveStep,
  onToggleIngredient,
  onPickImage,
}: StepCardProps) {
  const drag = useReorderableDrag();
  const theme = useTheme();

  return (
    <View className="bg-white/70 rounded-sheet p-[11px] mb-three gap-[10px]">
      <View className="row-center gap-[10px]">
        <TouchableOpacity
          onLongPress={drag}
          className="p-one"
          accessibilityLabel="Schritt verschieben">
          <ThemedText type="headingSmall" themeColor="textSecondary">
            ≡
          </ThemedText>
        </TouchableOpacity>
        <ThemedText type="label" themeColor="accent" className="flex-1 font-bold">
          Schritt {index + 1}
        </ThemedText>
        <TouchableOpacity
          onPress={() => onRemoveStep(step.id)}
          className="w-9 h-9 rounded-sheet bg-background-element items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Delete step">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
              stroke={theme.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {ingredients.length > 0 ? (
        <View className="row-wrap gap-two">
          {ingredients.map((ing) => {
            const selected = step.ingredientIds.includes(ing.itemId);
            return (
              <Pressable
                key={ing.itemId}
                className={`px-three py-[6px] rounded-fam-large ${
                  selected ? 'bg-accent' : 'bg-background-element'
                }`}
                onPress={() => onToggleIngredient(step.id, ing.itemId)}>
                <ThemedText
                  type="caption"
                  themeColor={selected ? 'onAccent' : 'accent'}
                  className="font-semibold">
                  {ing.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <TextInput
        className="bg-white rounded-card min-h-[72px] px-four py-three text-[15px] text-text"
        value={step.text}
        onChangeText={(val) => onUpdateStep(step.id, { text: val })}
        placeholder={`Was ist in Schritt ${index + 1} zu tun?`}
        placeholderTextColor={theme.textSecondary}
        multiline
        textAlignVertical="top"
      />

      {step.localImageUri ? (
        <View className="gap-[6px]">
          <Image
            source={{ uri: step.localImageUri }}
            // expo-image benötigt inline Dimensionen
            style={{ width: '100%', height: 140, borderRadius: 12 }}
            contentFit="cover"
          />
          <TouchableOpacity
            className="self-start"
            onPress={() => onUpdateStep(step.id, { localImageUri: null, existingImagePath: null })}>
            <ThemedText type="label" themeColor="accent" className="font-semibold">
              Bild entfernen
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity className="self-start" onPress={() => onPickImage(step.id)}>
          <ThemedText type="label" themeColor="accent" className="font-semibold">
            + Bild hinzufügen
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
});

export function RecipeWizardStepSteps({
  steps,
  onStepsChange,
  components,
  onBack,
  onNext,
}: RecipeWizardStepStepsProps) {
  const ingredients = availableIngredients(components);

  function updateStep(id: string, patch: Partial<WizardStepItem>) {
    onStepsChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStep(id: string) {
    onStepsChange(steps.filter((s) => s.id !== id));
  }

  function addStep() {
    onStepsChange([
      ...steps,
      {
        id: `step-${Date.now()}-${Math.random()}`,
        serverId: null,
        text: '',
        localImageUri: null,
        existingImagePath: null,
        ingredientIds: [],
      },
    ]);
  }

  function toggleIngredient(stepId: string, itemId: string) {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    const ingredientIds = step.ingredientIds.includes(itemId)
      ? step.ingredientIds.filter((id) => id !== itemId)
      : [...step.ingredientIds, itemId];
    updateStep(stepId, { ingredientIds });
  }

  async function pickImageFor(stepId: string) {
    const uri = await pickRecipeImage();
    if (uri) updateStep(stepId, { localImageUri: uri });
  }

  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    onStepsChange(reorderItems(steps, from, to));
  }

  return (
    <ReorderableList
      className="flex-1"
      contentContainerClassName="px-four pb-six"
      showsVerticalScrollIndicator={false}
      data={steps}
      onReorder={handleReorder}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <StepCard
          step={item}
          index={index ?? 0}
          ingredients={ingredients}
          onUpdateStep={updateStep}
          onRemoveStep={removeStep}
          onToggleIngredient={toggleIngredient}
          onPickImage={pickImageFor}
        />
      )}
      ListHeaderComponent={
        <>
          <ThemedText
            type="detail"
            themeColor="textSecondary"
            className="pt-two pb-[6px] text-[8px] leading-[10px] font-medium tracking-widest">
            SCHRITT 3 VON 4
          </ThemedText>
          <ThemedText type="headingSmall" className="mb-one">
            Zubereitungsschritte
          </ThemedText>
          <ThemedText type="label" themeColor="textSecondary" className="mb-four">
            Zum Umsortieren einen Schritt gedrückt halten und ziehen.
          </ThemedText>
        </>
      }
      ListFooterComponent={
        <>
          <TouchableOpacity
            className="w-full h-[42px] bg-background-element rounded-fam-large items-center justify-center mt-one mb-seven active:opacity-75"
            onPress={addStep}>
            <ThemedText type="detail" themeColor="accent" className="font-semibold">
              + Schritt hinzufügen
            </ThemedText>
          </TouchableOpacity>

          <View className="flex-row gap-[14px] mb-three">
            <Pressable
              className="flex-1 min-h-[48px] rounded-card items-center justify-center bg-background-element active:opacity-75"
              onPress={onBack}>
              <ThemedText type="captionCompact" themeColor="accent" className="font-semibold">
                Zurück
              </ThemedText>
            </Pressable>
            <Pressable
              className="flex-1 min-h-[48px] rounded-card items-center justify-center bg-accent active:opacity-75"
              onPress={onNext}>
              <ThemedText type="captionCompact" className="text-white font-semibold">
                Weiter
              </ThemedText>
            </Pressable>
          </View>
        </>
      }
    />
  );
}
