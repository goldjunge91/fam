import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FontSize } from '@/components/themed-text';

import { WheelPickerField } from '@/components/wheel-picker-field';
import { Radius } from '@/constants/theme';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import type { DietaryTag, Difficulty, DishType } from '@/features/recipes/use-recipes';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';
import { UNIT_OPTIONS } from '@/lib/units';
import { DIETARY_TAGS, DIFFICULTIES, DISH_TYPES } from './recipe-metadata-options';
import type { IngredientComponentGroup } from './types';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface RecipeWizardStepBasicsProps {
  mode: 'details' | 'ingredients';
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  cookTimeMinutes: string;
  onCookTimeMinutesChange: (v: string) => void;
  defaultServings: number;
  onDefaultServingsChange: (v: number) => void;
  difficulty: Difficulty | null;
  onDifficultyChange: (v: Difficulty | null) => void;
  dishTypes: DishType[];
  onDishTypesChange: (v: DishType[]) => void;
  dietaryTags: DietaryTag[];
  onDietaryTagsChange: (v: DietaryTag[]) => void;
  hashtagsInput: string;
  onHashtagsInputChange: (v: string) => void;
  coverPreviewUri: string | null;
  onPickCover: () => void;
  components: IngredientComponentGroup[];
  onAddIngredient: (componentId: string) => void;
  onRemoveIngredient: (componentId: string, ingredientId: string) => void;
  onSelectProduct: (
    componentId: string,
    ingredientId: string,
    product: OpenFoodFactsProduct,
  ) => void;
  onUpdateIngredientQuery: (componentId: string, ingredientId: string, query: string) => void;
  onUpdateQuantity: (componentId: string, ingredientId: string, quantity: string) => void;
  onUpdateUnit: (componentId: string, ingredientId: string, unit: string) => void;
  onAddComponentGroup: () => void;
  saving: boolean;
  onCancel: () => void;
  onNext: () => void;
}

export function RecipeWizardStepBasics({
  mode,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  cookTimeMinutes,
  onCookTimeMinutesChange,
  defaultServings,
  onDefaultServingsChange,
  difficulty,
  onDifficultyChange,
  dishTypes,
  onDishTypesChange,
  dietaryTags,
  onDietaryTagsChange,
  hashtagsInput,
  onHashtagsInputChange,
  coverPreviewUri,
  onPickCover,
  components,
  onAddIngredient,
  onRemoveIngredient,
  onSelectProduct,
  onUpdateIngredientQuery,
  onUpdateQuantity,
  onUpdateUnit,
  onAddComponentGroup,
  saving,
  onCancel,
  onNext,
}: RecipeWizardStepBasicsProps) {
  return (
    <>
      <Text style={styles.eyebrow}>SCHRITT {mode === 'details' ? '1' : '2'} VON 4</Text>
      <Text style={styles.pageTitle}>
        {mode === 'details' ? 'Rezeptdetails' : 'Gruppen und Zutaten'}
      </Text>

      {mode === 'details' ? (
        <>
          {/* Titelbild */}
          <TouchableOpacity style={styles.videoCard} activeOpacity={0.85} onPress={onPickCover}>
            {coverPreviewUri ? (
              <Image
                source={{ uri: coverPreviewUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={styles.videoPlaceholderContent}>
                <View style={styles.playIconCircle}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M8 5v14l11-7z" fill="#FFFFFF" />
                  </Svg>
                </View>
                <Text style={styles.videoPlaceholderText}>Titelbild hinzufügen</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Titel</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={onTitleChange}
              placeholder="Rezepttitel"
              placeholderTextColor="#A89FA8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Beschreibung</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={description}
              onChangeText={onDescriptionChange}
              placeholder="Kurze Beschreibung des Rezepts"
              placeholderTextColor="#A89FA8"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, styles.flexInput]}>
              <Text style={styles.label}>Kochzeit (Minuten)</Text>
              <TextInput
                style={styles.input}
                value={cookTimeMinutes}
                onChangeText={onCookTimeMinutesChange}
                placeholder="30"
                placeholderTextColor="#A89FA8"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Portionen</Text>
              <View style={styles.stepperPill}>
                <Pressable
                  onPress={() => onDefaultServingsChange(Math.max(1, defaultServings - 1))}>
                  <Text style={styles.stepperSign}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{defaultServings}</Text>
                <Pressable onPress={() => onDefaultServingsChange(defaultServings + 1)}>
                  <Text style={styles.stepperSign}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Schwierigkeit */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Schwierigkeit</Text>
            <View style={styles.chipRow}>
              {DIFFICULTIES.map((d) => {
                const selected = difficulty === d.value;
                return (
                  <Pressable
                    key={d.value}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => onDifficultyChange(selected ? null : d.value)}>
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Rezepttyp */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Art des Gerichts</Text>
            <View style={styles.chipRow}>
              {DISH_TYPES.map((d) => {
                const selected = dishTypes.includes(d.value);
                return (
                  <Pressable
                    key={d.value}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => onDishTypesChange(toggle(dishTypes, d.value))}>
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Ernaehrung */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ernährung</Text>
            <View style={styles.chipRow}>
              {DIETARY_TAGS.map((d) => {
                const selected = dietaryTags.includes(d.value);
                return (
                  <Pressable
                    key={d.value}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => onDietaryTagsChange(toggle(dietaryTags, d.value))}>
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Hashtags */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hashtags</Text>
            <TextInput
              style={styles.input}
              value={hashtagsInput}
              onChangeText={onHashtagsInputChange}
              placeholder="#vegan #schnell"
              placeholderTextColor="#A89FA8"
            />
          </View>
        </>
      ) : (
        <>
          {/* Zutaten-Gruppen */}
          {components.map((comp) => (
            <View key={comp.id} style={styles.componentSection}>
              <Text style={styles.label}>{comp.title}</Text>

              {comp.items.map((item) => (
                <View key={item.id} style={styles.ingredientBlock}>
                  <ProductSearchDropdown
                    label="Zutat"
                    placeholder="Zutat suchen…"
                    value={item.productQuery}
                    onChangeText={(val) => onUpdateIngredientQuery(comp.id, item.id, val)}
                    onSelectProduct={(product) => onSelectProduct(comp.id, item.id, product)}
                  />
                  <View style={styles.ingredientQuantityRow}>
                    <TextInput
                      style={[styles.input, styles.amountInput]}
                      value={item.quantity}
                      onChangeText={(val) => onUpdateQuantity(comp.id, item.id, val)}
                      placeholder="Menge"
                      placeholderTextColor="#A89FA8"
                      keyboardType="numeric"
                    />
                    <View style={styles.unitPicker}>
                      <WheelPickerField
                        value={item.unit}
                        options={UNIT_OPTIONS}
                        onChange={(unit) => onUpdateUnit(comp.id, item.id, unit)}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.trashCircleButton}
                      onPress={() => onRemoveIngredient(comp.id, item.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete ingredient">
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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
                  {item.notConvertible ? (
                    <Text style={styles.warningText}>
                      Automatische Umrechnung in Gramm für diese Einheit nicht möglich (Produkt hat
                      kein bekanntes Stückgewicht) — diese Zutat wurde beim Speichern übersprungen.
                    </Text>
                  ) : null}
                </View>
              ))}

              <TouchableOpacity
                style={styles.addIngredientSmallBtn}
                onPress={() => onAddIngredient(comp.id)}>
                <Text style={styles.addIngredientSmallText}>+ Zutat hinzufügen</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Pressable
            style={styles.addComponentButton}
            onPress={onAddComponentGroup}
            accessibilityRole="button"
            accessibilityLabel="Add Componente">
            <Text style={styles.addComponentText}>+ Zutaten-Gruppe hinzufügen</Text>
          </Pressable>
        </>
      )}

      <View style={styles.navRow}>
        <Pressable style={[styles.navButton, styles.navButtonSecondary]} onPress={onCancel}>
          <Text style={styles.navButtonSecondaryText}>
            {mode === 'details' ? 'Abbrechen' : 'Zurück'}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.navButton,
            styles.navButtonPrimary,
            (!title.trim() || saving) && styles.navButtonDisabled,
          ]}
          onPress={onNext}
          disabled={!title.trim() || saving}>
          <Text style={styles.navButtonPrimaryText}>
            {saving
              ? 'Speichert…'
              : mode === 'details'
                ? 'Weiter zu den Zutaten'
                : 'Weiter zu den Schritten'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    paddingTop: 8,
    ...FontSize[8],
    lineHeight: 10,
    fontWeight: '500',
    color: '#766E78',
    letterSpacing: 0.7,
  },
  pageTitle: {
    paddingTop: 6,
    paddingBottom: 12,
    ...FontSize[21],
    lineHeight: 25,
    fontWeight: '700',
    color: '#302A31',
    letterSpacing: -0.35,
  },
  videoCard: {
    width: '100%',
    height: 200,
    backgroundColor: '#EEE5EC',
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderContent: {
    alignItems: 'center',
  },
  playIconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: '#705773',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    ...FontSize[15],
    fontWeight: '500',
    color: '#302A31',
    marginTop: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 14,
  },
  flexInput: {
    flex: 1,
  },
  label: {
    ...FontSize[10],
    lineHeight: 12,
    fontWeight: '700',
    color: '#302A31',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#EEE5EC',
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    minHeight: 44,
    paddingHorizontal: 12,
    ...FontSize[11],
    color: '#302A31',
  },
  multilineInput: {
    height: 76,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEE5EC',
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    height: 44,
    paddingHorizontal: 12,
    minWidth: 100,
  },
  stepperSign: {
    ...FontSize[18],
    fontWeight: '700',
    color: '#705773',
  },
  stepperValue: {
    ...FontSize[15],
    fontWeight: '600',
    color: '#302A31',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    backgroundColor: '#EEE5EC',
  },
  chipActive: {
    backgroundColor: '#705773',
  },
  chipText: {
    color: '#705773',
    ...FontSize[10],
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  componentSection: {
    marginBottom: 12,
    padding: 11,
    borderRadius: Radius.sheet,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  ingredientBlock: {
    marginBottom: 14,
    gap: 8,
  },
  ingredientQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountInput: {
    flex: 1,
  },
  unitPicker: {
    flex: 1,
  },
  warningText: {
    ...FontSize[12],
    color: '#B45309',
  },
  trashCircleButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    backgroundColor: '#EEE5EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIngredientSmallBtn: {
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  addIngredientSmallText: {
    color: '#705773',
    ...FontSize[9],
    fontWeight: '600',
  },
  addComponentButton: {
    width: '100%',
    height: 42,
    backgroundColor: '#EEE5EC',
    borderRadius: Radius.controlLarge,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  addComponentText: {
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
  navButtonDisabled: {
    opacity: 0.5,
  },
});
