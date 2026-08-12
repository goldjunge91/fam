import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import Svg, { Path } from 'react-native-svg';

import { pickRecipeStepImage } from '@/features/recipes/recipe-step-image';
import type { IngredientComponentGroup, WizardStepItem } from './types';

interface AvailableIngredient {
  itemId: string;
  label: string;
}

function availableIngredients(components: IngredientComponentGroup[]): AvailableIngredient[] {
  const result: AvailableIngredient[] = [];
  for (const comp of components) {
    for (const item of comp.items) {
      if (item.itemId && item.product) {
        result.push({ itemId: item.itemId, label: `${item.product.name} (${comp.title})` });
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
    const uri = await pickRecipeStepImage();
    if (uri) updateStep(stepId, { localImageUri: uri });
  }

  return (
    <NestableScrollContainer
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionLabel}>Zubereitungsschritte</Text>
      <Text style={styles.hint}>Zum Umsortieren einen Schritt gedrückt halten und ziehen.</Text>

      <NestableDraggableFlatList<WizardStepItem>
        data={steps}
        keyExtractor={(item) => item.id}
        renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<WizardStepItem>) => {
          const index = getIndex() ?? 0;
          return (
            <ScaleDecorator>
              <View style={[styles.stepCard, isActive && styles.stepCardActive]}>
                <View style={styles.stepHeader}>
                  <TouchableOpacity
                    onLongPress={drag}
                    style={styles.dragHandle}
                    accessibilityLabel="Schritt verschieben">
                    <Text style={styles.dragHandleText}>≡</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepIndex}>Schritt {index + 1}</Text>
                  <TouchableOpacity
                    onPress={() => removeStep(item.id)}
                    style={styles.trashCircleButton}
                    accessibilityRole="button"
                    accessibilityLabel="Delete step">
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                        stroke="#FF5262"
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
                      const selected = item.ingredientIds.includes(ing.itemId);
                      return (
                        <Pressable
                          key={ing.itemId}
                          style={[styles.chip, selected && styles.chipActive]}
                          onPress={() => toggleIngredient(item.id, ing.itemId)}>
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
                  value={item.text}
                  onChangeText={(val) => updateStep(item.id, { text: val })}
                  placeholder={`Was ist in Schritt ${index + 1} zu tun?`}
                  placeholderTextColor="#C4B0B2"
                  multiline
                />

                {item.localImageUri ? (
                  <View style={styles.imagePreviewWrap}>
                    <Image
                      source={{ uri: item.localImageUri }}
                      style={styles.imagePreview}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={() =>
                        updateStep(item.id, { localImageUri: null, existingImagePath: null })
                      }>
                      <Text style={styles.removeImageBtnText}>Bild entfernen</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addImageBtn}
                    onPress={() => pickImageFor(item.id)}>
                    <Text style={styles.addImageBtnText}>+ Bild hinzufügen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScaleDecorator>
          );
        }}
        onDragEnd={({ data }) => onStepsChange(data)}
      />

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
    </NestableScrollContainer>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A181A',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#8A6E70',
    marginBottom: 16,
  },
  stepCard: {
    backgroundColor: '#FFF6F2',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  stepCardActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
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
    fontSize: 20,
    color: '#C4B0B2',
  },
  stepIndex: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FF5262',
  },
  trashCircleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE2E2',
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
    borderRadius: 14,
    backgroundColor: '#FFE2E2',
  },
  chipActive: {
    backgroundColor: '#FF5262',
  },
  chipText: {
    color: '#FF5262',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  stepInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#332222',
    textAlignVertical: 'top',
  },
  imagePreviewWrap: {
    gap: 6,
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: 14,
  },
  removeImageBtn: {
    alignSelf: 'flex-start',
  },
  removeImageBtnText: {
    color: '#FF5262',
    fontSize: 13,
    fontWeight: '600',
  },
  addImageBtn: {
    alignSelf: 'flex-start',
  },
  addImageBtnText: {
    color: '#FF5262',
    fontSize: 13,
    fontWeight: '600',
  },
  addStepBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#FF5262',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  addStepBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  navButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonPrimary: {
    backgroundColor: '#FF5262',
  },
  navButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonSecondary: {
    backgroundColor: '#FFE2E2',
  },
  navButtonSecondaryText: {
    color: '#FF5262',
    fontSize: 16,
    fontWeight: '600',
  },
});
