import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import Svg, { Path } from 'react-native-svg';
import { FontSize } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { pickRecipeImage } from '@/features/recipes/recipe-image-uploader';
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

  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <TouchableOpacity
          onLongPress={drag}
          style={styles.dragHandle}
          accessibilityLabel="Schritt verschieben">
          <Text style={styles.dragHandleText}>≡</Text>
        </TouchableOpacity>
        <Text style={styles.stepIndex}>Schritt {index + 1}</Text>
        <TouchableOpacity
          onPress={() => onRemoveStep(step.id)}
          style={styles.trashCircleButton}
          accessibilityRole="button"
          accessibilityLabel="Delete step">
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
              stroke="#705773"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {ingredients.length > 0 ? (
        <View style={styles.chipRow}>
          {ingredients.map((ing) => {
            const selected = step.ingredientIds.includes(ing.itemId);
            return (
              <Pressable
                key={ing.itemId}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => onToggleIngredient(step.id, ing.itemId)}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {ing.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <TextInput
        style={styles.stepInput}
        value={step.text}
        onChangeText={(val) => onUpdateStep(step.id, { text: val })}
        placeholder={`Was ist in Schritt ${index + 1} zu tun?`}
        placeholderTextColor="#A89FA8"
        multiline
      />

      {step.localImageUri ? (
        <View style={styles.imagePreviewWrap}>
          <Image
            source={{ uri: step.localImageUri }}
            style={styles.imagePreview}
            contentFit="cover"
          />
          <TouchableOpacity
            style={styles.removeImageBtn}
            onPress={() => onUpdateStep(step.id, { localImageUri: null, existingImagePath: null })}>
            <Text style={styles.removeImageBtnText}>Bild entfernen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addImageBtn} onPress={() => onPickImage(step.id)}>
          <Text style={styles.addImageBtnText}>+ Bild hinzufügen</Text>
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
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
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
          <Text style={styles.eyebrow}>SCHRITT 3 VON 4</Text>
          <Text style={styles.sectionLabel}>Zubereitungsschritte</Text>
          <Text style={styles.hint}>Zum Umsortieren einen Schritt gedrückt halten und ziehen.</Text>
        </>
      }
      ListFooterComponent={
        <>
          <TouchableOpacity style={styles.addStepBtn} onPress={addStep}>
            <Text style={styles.addStepBtnText}>+ Schritt hinzufügen</Text>
          </TouchableOpacity>

          <View style={styles.navRow}>
            <Pressable style={[styles.navButton, styles.navButtonSecondary]} onPress={onBack}>
              <Text style={styles.navButtonSecondaryText}>Zurück</Text>
            </Pressable>
            <Pressable style={[styles.navButton, styles.navButtonPrimary]} onPress={onNext}>
              <Text style={styles.navButtonPrimaryText}>Weiter</Text>
            </Pressable>
          </View>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  eyebrow: {
    paddingTop: 8,
    paddingBottom: 6,
    ...FontSize[8],
    lineHeight: 10,
    fontWeight: '500',
    color: '#766E78',
    letterSpacing: 0.7,
  },
  sectionLabel: {
    ...FontSize[21],
    lineHeight: 25,
    fontWeight: '700',
    color: '#302A31',
    marginBottom: 4,
  },
  hint: {
    ...FontSize[13],
    color: '#786F79',
    marginBottom: 16,
  },
  stepCard: {
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    padding: 11,
    marginBottom: 12,
    gap: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dragHandle: {
    padding: 4,
  },
  dragHandleText: {
    ...FontSize[20],
    color: '#A89FA8',
  },
  stepIndex: {
    flex: 1,
    ...FontSize[14],
    fontWeight: '700',
    color: '#705773',
  },
  trashCircleButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.sheet,
    backgroundColor: '#EEE5EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.controlLarge,
    backgroundColor: '#EEE5EC',
  },
  chipActive: {
    backgroundColor: '#705773',
  },
  chipText: {
    color: '#705773',
    ...FontSize[12],
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  stepInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...FontSize[15],
    color: '#302A31',
    textAlignVertical: 'top',
  },
  imagePreviewWrap: {
    gap: 6,
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: Radius.controlLarge,
  },
  removeImageBtn: {
    alignSelf: 'flex-start',
  },
  removeImageBtnText: {
    color: '#705773',
    ...FontSize[13],
    fontWeight: '600',
  },
  addImageBtn: {
    alignSelf: 'flex-start',
  },
  addImageBtnText: {
    color: '#705773',
    ...FontSize[13],
    fontWeight: '600',
  },
  addStepBtn: {
    width: '100%',
    height: 42,
    backgroundColor: '#EEE5EC',
    borderRadius: Radius.controlLarge,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  addStepBtnText: {
    color: '#705773',
    ...FontSize[10],
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  navButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPrimary: {
    backgroundColor: '#705773',
  },
  navButtonPrimaryText: {
    color: '#FFFFFF',
    ...FontSize[11],
    fontWeight: '600',
  },
  navButtonSecondary: {
    backgroundColor: '#EEE5EC',
  },
  navButtonSecondaryText: {
    color: '#705773',
    ...FontSize[11],
    fontWeight: '600',
  },
});
