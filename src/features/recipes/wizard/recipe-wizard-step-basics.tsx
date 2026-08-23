import { Image } from 'expo-image';
import { Pressable, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { ThemedText } from '@/components/theme/themed-text';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import type { DietaryTag, Difficulty, DishType } from '@/features/recipes/use-recipes';
import { useTheme } from '@/hooks/use-theme';
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
  onUpdateComponentTitle: (componentId: string, title: string) => void;
  onRemoveComponentGroup: (componentId: string) => void;
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
  onUpdateComponentTitle,
  onRemoveComponentGroup,
  saving,
  onCancel,
  onNext,
}: RecipeWizardStepBasicsProps) {
  const theme = useTheme();

  return (
    <>
      <ThemedText
        type="detail"
        themeColor="textSecondary"
        className="pt-two text-[8px] leading-[10px] font-medium tracking-widest">
        SCHRITT {mode === 'details' ? '1' : '2'} VON 4
      </ThemedText>
      <ThemedText type="headingSmall" className="pt-[6px] pb-three">
        {mode === 'details' ? 'Rezeptdetails' : 'Gruppen und Zutaten'}
      </ThemedText>

      {mode === 'details' ? (
        <>
          <TouchableOpacity
            className="w-full h-[200px] bg-background-element rounded-sheet overflow-hidden mb-four justify-center items-center"
            activeOpacity={0.85}
            onPress={onPickCover}>
            {coverPreviewUri ? (
              <Image
                source={{ uri: coverPreviewUri }}
                // expo-image benötigt absoluteFill inline
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                contentFit="cover"
              />
            ) : (
              <View className="items-center">
                <View className="w-16 h-16 rounded-pill bg-accent items-center justify-center">
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M8 5v14l11-7z" fill={theme.onAccent} />
                  </Svg>
                </View>
                <ThemedText type="body" className="font-medium mt-[14px]">
                  Titelbild hinzufügen
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>

          <View className="mb-[14px]">
            <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold mb-[6px]">
              Titel
            </ThemedText>
            <TextInput
              className="bg-background-element rounded-control min-h-[44px] px-three text-body-small text-text"
              value={title}
              onChangeText={onTitleChange}
              placeholder="Rezepttitel"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View className="mb-[14px]">
            <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold mb-[6px]">
              Beschreibung
            </ThemedText>
            <TextInput
              className="bg-background-element rounded-control h-[76px] px-three py-three text-body-small text-text"
              value={description}
              onChangeText={onDescriptionChange}
              placeholder="Kurze Beschreibung des Rezepts"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View className="flex-row gap-[14px]">
            <View className="flex-1 mb-[14px]">
              <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold mb-[6px]">
                Kochzeit (Minuten)
              </ThemedText>
              <TextInput
                className="bg-background-element rounded-control min-h-[44px] px-three text-body-small text-text"
                value={cookTimeMinutes}
                onChangeText={onCookTimeMinutesChange}
                placeholder="30"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View className="mb-[14px]">
              <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold mb-[6px]">
                Portionen
              </ThemedText>
              <View className="flex-row items-center justify-between bg-background-element rounded-control h-[44px] px-three min-w-[100px]">
                <Pressable
                  onPress={() => onDefaultServingsChange(Math.max(1, defaultServings - 1))}>
                  <ThemedText type="headingSmall" themeColor="accent" className="font-bold">
                    −
                  </ThemedText>
                </Pressable>
                <ThemedText type="body" className="font-semibold">
                  {defaultServings}
                </ThemedText>
                <Pressable onPress={() => onDefaultServingsChange(defaultServings + 1)}>
                  <ThemedText type="headingSmall" themeColor="accent" className="font-bold">
                    +
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>

          <View className="mb-[14px]">
            <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold mb-[6px]">
              Schwierigkeit
            </ThemedText>
            <View className="row-wrap gap-[10px]">
              {DIFFICULTIES.map((d) => {
                const selected = difficulty === d.value;
                return (
                  <Pressable
                    key={d.value}
                    className={`px-three py-[7px] rounded-control ${
                      selected ? 'bg-accent' : 'bg-background-element'
                    }`}
                    onPress={() => onDifficultyChange(selected ? null : d.value)}>
                    <ThemedText
                      type="caption"
                      themeColor={selected ? 'onAccent' : 'accent'}
                      className="font-semibold">
                      {d.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mb-[14px]">
            <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold mb-[6px]">
              Art des Gerichts
            </ThemedText>
            <View className="row-wrap gap-[10px]">
              {DISH_TYPES.map((d) => {
                const selected = dishTypes.includes(d.value);
                return (
                  <Pressable
                    key={d.value}
                    className={`px-three py-[7px] rounded-control ${
                      selected ? 'bg-accent' : 'bg-background-element'
                    }`}
                    onPress={() => onDishTypesChange(toggle(dishTypes, d.value))}>
                    <ThemedText
                      type="caption"
                      themeColor={selected ? 'onAccent' : 'accent'}
                      className="font-semibold">
                      {d.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mb-[14px]">
            <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold mb-[6px]">
              Ernährung
            </ThemedText>
            <View className="row-wrap gap-[10px]">
              {DIETARY_TAGS.map((d) => {
                const selected = dietaryTags.includes(d.value);
                return (
                  <Pressable
                    key={d.value}
                    className={`px-three py-[7px] rounded-control ${
                      selected ? 'bg-accent' : 'bg-background-element'
                    }`}
                    onPress={() => onDietaryTagsChange(toggle(dietaryTags, d.value))}>
                    <ThemedText
                      type="caption"
                      themeColor={selected ? 'onAccent' : 'accent'}
                      className="font-semibold">
                      {d.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mb-[14px]">
            <ThemedText type="detail" className="text-[10px] leading-[12px] font-bold mb-[6px]">
              Hashtags
            </ThemedText>
            <TextInput
              className="bg-background-element rounded-control min-h-[44px] px-three text-body-small text-text"
              value={hashtagsInput}
              onChangeText={onHashtagsInputChange}
              placeholder="#vegan #schnell"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </>
      ) : (
        <>
          {components.map((comp) => (
            <View key={comp.id} className="mb-three p-[11px] rounded-sheet bg-white/70">
              <View className="flex-row items-center gap-two mb-two">
                <TextInput
                  className="flex-1 bg-background-element rounded-control min-h-[44px] px-three text-body-small font-bold text-text"
                  value={comp.title}
                  onChangeText={(val) => onUpdateComponentTitle(comp.id, val)}
                  placeholder="Gruppenname, z. B. Für den Teig"
                  placeholderTextColor={theme.textSecondary}
                />
                {components.length > 1 ? (
                  <TouchableOpacity
                    className="w-11 h-11 rounded-control bg-background-element items-center justify-center"
                    onPress={() => onRemoveComponentGroup(comp.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Zutaten-Gruppe entfernen">
                    <ThemedText
                      themeColor="accent"
                      className="text-[18px] leading-[20px] font-medium">
                      ×
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>

              {comp.items.map((item) => (
                <View key={item.id} className="mb-[14px] gap-two">
                  <ProductSearchDropdown
                    label="Zutat"
                    placeholder="Zutat suchen…"
                    value={item.productQuery}
                    onChangeText={(val) => onUpdateIngredientQuery(comp.id, item.id, val)}
                    onSelectProduct={(product) => onSelectProduct(comp.id, item.id, product)}
                  />
                  <View className="flex-row items-center gap-two">
                    <TextInput
                      className="flex-1 bg-background-element rounded-control min-h-[44px] px-three text-body-small text-text"
                      value={item.quantity}
                      onChangeText={(val) => onUpdateQuantity(comp.id, item.id, val)}
                      placeholder="Menge"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />
                    <View className="flex-1">
                      <WheelPickerField
                        value={item.unit}
                        options={UNIT_OPTIONS}
                        onChange={(unit) => onUpdateUnit(comp.id, item.id, unit)}
                      />
                    </View>
                    <TouchableOpacity
                      className="w-11 h-11 rounded-control bg-background-element items-center justify-center"
                      onPress={() => onRemoveIngredient(comp.id, item.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete ingredient">
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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
                  {item.notConvertible ? (
                    <ThemedText type="caption" themeColor="danger">
                      Automatische Umrechnung in Gramm für diese Einheit nicht möglich (Produkt hat
                      kein bekanntes Stückgewicht) — diese Zutat wurde beim Speichern übersprungen.
                    </ThemedText>
                  ) : null}
                </View>
              ))}

              <TouchableOpacity
                className="py-[6px] self-start"
                onPress={() => onAddIngredient(comp.id)}>
                <ThemedText
                  type="detail"
                  themeColor="accent"
                  className="text-[9px] leading-[11px] font-semibold">
                  + Zutat hinzufügen
                </ThemedText>
              </TouchableOpacity>
            </View>
          ))}

          <Pressable
            className="w-full h-[42px] bg-background-element rounded-fam-large items-center justify-center mt-two mb-four active:opacity-75"
            onPress={onAddComponentGroup}
            accessibilityRole="button"
            accessibilityLabel="Add Componente">
            <ThemedText type="detail" themeColor="accent" className="font-semibold">
              + Zutaten-Gruppe hinzufügen
            </ThemedText>
          </Pressable>
        </>
      )}

      <View className="flex-row gap-[14px] mb-three">
        <Pressable
          className="flex-1 min-h-[48px] rounded-card items-center justify-center bg-background-element active:opacity-75"
          onPress={onCancel}>
          <ThemedText type="captionCompact" themeColor="accent" className="font-semibold">
            {mode === 'details' ? 'Abbrechen' : 'Zurück'}
          </ThemedText>
        </Pressable>
        <Pressable
          className={`flex-1 min-h-[48px] rounded-card items-center justify-center bg-accent active:opacity-75 ${
            !title.trim() || saving ? 'opacity-50' : ''
          }`}
          onPress={onNext}
          disabled={!title.trim() || saving}>
          <ThemedText type="captionCompact" className="text-white font-semibold">
            {saving
              ? 'Speichert…'
              : mode === 'details'
                ? 'Weiter zu den Zutaten'
                : 'Weiter zu den Schritten'}
          </ThemedText>
        </Pressable>
      </View>
    </>
  );
}
