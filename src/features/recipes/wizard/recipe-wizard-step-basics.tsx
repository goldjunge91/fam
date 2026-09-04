import { Image } from 'expo-image';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { Pressable, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import type { CatalogProduct } from '@/features/product-search/types';
import type { RecipeFormValues } from '@/lib/db/zod/recipe-form-schema.zod';
import { UNIT_OPTIONS } from '@/lib/units';
import { DIETARY_TAGS, DIFFICULTIES, DISH_TYPES } from './recipe-metadata-options';
import type { IngredientComponentGroup } from './types';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Txt variant="caption" tone="danger" accessibilityRole="alert">
      {message}
    </Txt>
  );
}

interface RecipeWizardStepBasicsProps {
  mode: 'details' | 'ingredients';
  control: Control<RecipeFormValues>;
  coverPreviewUri: string | null;
  onPickCover: () => void;
  components: IngredientComponentGroup[];
  onAddIngredient: (componentId: string) => void;
  onRemoveIngredient: (componentId: string, ingredientId: string) => void;
  onSelectProduct: (componentId: string, ingredientId: string, product: CatalogProduct) => void;
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
  control,
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
  const { colors } = useTheme();
  const title = useWatch({ control, name: 'title' });
  const fieldStyle = {
    backgroundColor: colors.backgroundElement,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  } as const;

  return (
    <>
      <Txt variant="micro" tone="secondary" className="pt-two tracking-widest" weight="500">
        SCHRITT {mode === 'details' ? '1' : '2'} VON 4
      </Txt>
      <Txt variant="heading" className="pt-[6px] pb-three">
        {mode === 'details' ? 'Rezeptdetails' : 'Gruppen und Zutaten'}
      </Txt>

      {mode === 'details' ? (
        <>
          {/* Titelbild */}
          <TouchableOpacity
            className="w-full h-[200px] rounded-sheet overflow-hidden mb-four justify-center items-center"
            style={{ backgroundColor: colors.surface }}
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
                <View
                  className="w-16 h-16 rounded-pill items-center justify-center"
                  style={{ backgroundColor: colors.basil }}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M8 5v14l11-7z" fill={colors.inverse} />
                  </Svg>
                </View>
                <Txt variant="body" weight="500" className="mt-[14px]">
                  Titelbild hinzufügen
                </Txt>
              </View>
            )}
          </TouchableOpacity>

          <View className="mb-[14px]">
            <Txt variant="micro" weight="700" className="mb-[6px]">
              Titel
            </Txt>
            <Controller
              control={control}
              name="title"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <>
                  <TextInput
                    accessibilityLabel="Titel"
                    className="rounded-control min-h-[44px] px-three"
                    style={fieldStyle}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Rezepttitel"
                    placeholderTextColor={colors.textMuted}
                  />
                  <FieldError message={error?.message} />
                </>
              )}
            />
          </View>

          <View className="mb-[14px]">
            <Txt variant="micro" weight="700" className="mb-[6px]">
              Beschreibung
            </Txt>
            <Controller
              control={control}
              name="description"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <>
                  <TextInput
                    accessibilityLabel="Beschreibung"
                    className="rounded-control h-[76px] px-three py-three"
                    style={fieldStyle}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Kurze Beschreibung des Rezepts"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <FieldError message={error?.message} />
                </>
              )}
            />
          </View>

          <View className="flex-row gap-[14px]">
            <View className="flex-1 mb-[14px]">
              <Txt variant="micro" weight="700" className="mb-[6px]">
                Kochzeit (Minuten)
              </Txt>
              <Controller
                control={control}
                name="cookTimeMinutes"
                render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                  <>
                    <TextInput
                      accessibilityLabel="Kochzeit in Minuten"
                      className="rounded-control min-h-[44px] px-three"
                      style={fieldStyle}
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder="30"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                    <FieldError message={error?.message} />
                  </>
                )}
              />
            </View>

            <View className="mb-[14px]">
              <Txt variant="micro" weight="700" className="mb-[6px]">
                Portionen
              </Txt>
              <Controller
                control={control}
                name="defaultServings"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <>
                    <View
                      className="flex-row items-center justify-between rounded-control h-[44px] px-three min-w-[100px]"
                      style={{ backgroundColor: colors.surface }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Eine Portion weniger"
                        onPress={() => onChange(Math.max(1, value - 1))}>
                        <Txt variant="heading" tone="secondary" weight="700">
                          −
                        </Txt>
                      </Pressable>
                      <Txt variant="body" weight="700">
                        {value}
                      </Txt>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Eine Portion mehr"
                        onPress={() => onChange(value + 1)}>
                        <Txt variant="heading" tone="secondary" weight="700">
                          +
                        </Txt>
                      </Pressable>
                    </View>
                    <FieldError message={error?.message} />
                  </>
                )}
              />
            </View>
          </View>

          {/* Schwierigkeit */}
          <View className="mb-[14px]">
            <Txt variant="micro" weight="700" className="mb-[6px]">
              Schwierigkeit
            </Txt>
            <Controller
              control={control}
              name="difficulty"
              render={({ field: { onChange, value } }) => (
                <View className="row-wrap gap-[10px]">
                  {DIFFICULTIES.map((difficulty) => {
                    const selected = value === difficulty.value;
                    return (
                      <Pressable
                        key={difficulty.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        className="px-three py-[7px] rounded-control"
                        style={{
                          backgroundColor: selected ? colors.basil : colors.surface,
                          borderColor: selected ? colors.basil : colors.border,
                          borderWidth: 1,
                        }}
                        onPress={() => onChange(selected ? null : difficulty.value)}>
                        <Txt
                          variant="captionCompact"
                          tone={selected ? 'onAccent' : 'primary'}
                          weight="600">
                          {difficulty.label}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Rezepttyp */}
          <View className="mb-[14px]">
            <Txt variant="micro" weight="700" className="mb-[6px]">
              Art des Gerichts
            </Txt>
            <Controller
              control={control}
              name="dishTypes"
              render={({ field: { onChange, value } }) => (
                <View className="row-wrap gap-[10px]">
                  {DISH_TYPES.map((dishType) => {
                    const selected = value.includes(dishType.value);
                    return (
                      <Pressable
                        key={dishType.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        className="px-three py-[7px] rounded-control"
                        style={{
                          backgroundColor: selected ? colors.basil : colors.surface,
                          borderColor: selected ? colors.basil : colors.border,
                          borderWidth: 1,
                        }}
                        onPress={() => onChange(toggle(value, dishType.value))}>
                        <Txt
                          variant="captionCompact"
                          tone={selected ? 'onAccent' : 'primary'}
                          weight="600">
                          {dishType.label}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Ernaehrung */}
          <View className="mb-[14px]">
            <Txt variant="micro" weight="700" className="mb-[6px]">
              Ernährung
            </Txt>
            <Controller
              control={control}
              name="dietaryTags"
              render={({ field: { onChange, value } }) => (
                <View className="row-wrap gap-[10px]">
                  {DIETARY_TAGS.map((dietaryTag) => {
                    const selected = value.includes(dietaryTag.value);
                    return (
                      <Pressable
                        key={dietaryTag.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        className="px-three py-[7px] rounded-control"
                        style={{
                          backgroundColor: selected ? colors.basil : colors.surface,
                          borderColor: selected ? colors.basil : colors.border,
                          borderWidth: 1,
                        }}
                        onPress={() => onChange(toggle(value, dietaryTag.value))}>
                        <Txt
                          variant="captionCompact"
                          tone={selected ? 'onAccent' : 'primary'}
                          weight="600">
                          {dietaryTag.label}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Hashtags */}
          <View className="mb-[14px]">
            <Txt variant="micro" weight="700" className="mb-[6px]">
              Hashtags
            </Txt>
            <Controller
              control={control}
              name="hashtagsInput"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <>
                  <TextInput
                    accessibilityLabel="Hashtags"
                    className="rounded-control min-h-[44px] px-three"
                    style={fieldStyle}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="#vegan #schnell"
                    placeholderTextColor={colors.textMuted}
                  />
                  <FieldError message={error?.message} />
                </>
              )}
            />
          </View>
        </>
      ) : (
        <>
          {/* Zutaten-Gruppen */}
          {components.map((comp) => (
            <View
              key={comp.id}
              className="mb-three p-[11px] rounded-sheet"
              style={{ backgroundColor: colors.surface }}>
              <View className="flex-row items-center gap-two mb-two">
                <TextInput
                  className="flex-1 rounded-control min-h-[44px] px-three"
                  style={[fieldStyle, { fontWeight: '700' }]}
                  value={comp.title}
                  onChangeText={(val) => onUpdateComponentTitle(comp.id, val)}
                  placeholder="Gruppenname, z. B. Für den Teig"
                  placeholderTextColor={colors.textMuted}
                />
                {components.length > 1 ? (
                  <TouchableOpacity
                    className="w-11 h-11 rounded-control items-center justify-center"
                    style={{ backgroundColor: colors.surfaceSoft }}
                    onPress={() => onRemoveComponentGroup(comp.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Zutaten-Gruppe entfernen">
                    <Txt variant="controlAction" tone="secondary" weight="500">
                      ×
                    </Txt>
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
                      className="flex-1 rounded-control min-h-[44px] px-three"
                      style={fieldStyle}
                      value={item.quantity}
                      onChangeText={(val) => onUpdateQuantity(comp.id, item.id, val)}
                      placeholder="Menge"
                      placeholderTextColor={colors.textMuted}
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
                      className="w-11 h-11 rounded-control items-center justify-center"
                      style={{ backgroundColor: colors.surfaceSoft }}
                      onPress={() => onRemoveIngredient(comp.id, item.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete ingredient">
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                          stroke={colors.text}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </TouchableOpacity>
                  </View>
                  {item.notConvertible ? (
                    <Txt variant="caption" tone="danger">
                      Automatische Umrechnung in Gramm für diese Einheit nicht möglich (Produkt hat
                      kein bekanntes Stückgewicht) — diese Zutat wurde beim Speichern übersprungen.
                    </Txt>
                  ) : null}
                </View>
              ))}

              <TouchableOpacity
                className="py-[6px] self-start"
                onPress={() => onAddIngredient(comp.id)}>
                <Txt variant="micro" tone="primary" weight="600">
                  + Zutat hinzufügen
                </Txt>
              </TouchableOpacity>
            </View>
          ))}

          <Pressable
            className="w-full h-[42px] rounded-fam-large items-center justify-center mt-two mb-four active:opacity-75"
            style={{ backgroundColor: colors.surface }}
            onPress={onAddComponentGroup}
            accessibilityRole="button"
            accessibilityLabel="Add Componente">
            <Txt variant="captionCompact" tone="primary" weight="600">
              + Zutaten-Gruppe hinzufügen
            </Txt>
          </Pressable>
        </>
      )}

      <View className="flex-row gap-[14px] mb-three">
        <Pressable
          className="flex-1 min-h-[48px] rounded-card items-center justify-center active:opacity-75"
          style={{ backgroundColor: colors.surface }}
          onPress={onCancel}>
          <Txt variant="captionCompact" tone="primary" weight="600">
            {mode === 'details' ? 'Abbrechen' : 'Zurück'}
          </Txt>
        </Pressable>
        <Pressable
          className="flex-1 min-h-[48px] rounded-card items-center justify-center active:opacity-75"
          style={{
            backgroundColor: colors.basil,
            opacity: !title.trim() || saving ? 0.5 : 1,
          }}
          onPress={onNext}
          accessibilityRole="button"
          disabled={!title.trim() || saving}>
          <Txt variant="captionCompact" tone="onAccent" weight="600">
            {saving
              ? 'Speichert…'
              : mode === 'details'
                ? 'Weiter zu den Zutaten'
                : 'Weiter zu den Schritten'}
          </Txt>
        </Pressable>
      </View>
    </>
  );
}
