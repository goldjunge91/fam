import { Image } from 'expo-image';
import { useState } from 'react';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import type { CatalogProduct } from '@/features/product-search/types';
import type { RecipeFormValues } from '@/lib/db/zod/recipe-form-schema.zod';
import { UNIT_OPTIONS } from '@/lib/units';
import { DIETARY_TAGS, DIFFICULTIES, DISH_TYPES } from './recipe-metadata-options';
import type { IngredientComponentGroup } from './types';

const styles = StyleSheet.create((theme) => ({
  eyebrow: {
    paddingTop: rs(8),
    letterSpacing: 1.5,
  },
  heading: {
    paddingTop: rs(6),
    paddingBottom: rs(16),
  },
  cover: {
    width: '100%',
    height: rs(200),
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: rs(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholder: {
    alignItems: 'center',
  },
  coverIcon: {
    width: rs(64),
    height: rs(64),
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverActionText: {
    marginTop: rs(14),
  },
  fieldGroup: {
    marginBottom: rs(14),
  },
  fieldLabel: {
    marginBottom: rs(6),
  },
  field: {
    borderRadius: theme.radius.sm,
    minHeight: rs(44),
    paddingHorizontal: rs(24),
  },
  focusableField: {
    borderWidth: theme.borderWidth.strong,
    borderColor: theme.border,
  },
  focusedField: {
    borderColor: theme.accent,
  },
  descriptionField: {
    height: rs(76),
    paddingVertical: rs(12),
  },
  detailsRow: {
    flexDirection: 'row',
    gap: rs(14),
  },
  detailsColumn: {
    flex: 1,
    marginBottom: rs(14),
  },
  servingsColumn: {
    marginBottom: rs(14),
  },
  servingsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radius.sm,
    height: rs(44),
    paddingHorizontal: rs(24),
    minWidth: rs(100),
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(10),
  },
  tag: {
    paddingHorizontal: rs(24),
    paddingVertical: rs(7),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  componentGroup: {
    marginBottom: rs(16),
    padding: rs(11),
    borderRadius: theme.radius.lg,
  },
  componentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    marginBottom: theme.space.sm,
  },
  componentTitle: {
    flex: 1,
  },
  squareButton: {
    width: rs(44),
    height: rs(44),
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientRow: {
    marginBottom: rs(14),
    gap: theme.space.sm,
  },
  ingredientFields: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  ingredientInput: {
    flex: 1,
  },
  unitField: {
    flex: 1,
  },
  addIngredient: {
    paddingVertical: rs(6),
    alignSelf: 'flex-start',
  },
  addGroup: {
    width: '100%',
    height: rs(42),
    borderRadius: theme.radius.famLarge,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.space.sm,
    marginBottom: rs(24),
  },
  actions: {
    flexDirection: 'row',
    gap: rs(14),
    marginBottom: rs(16),
  },
  actionContainer: {
    flex: 1,
  },
  action: {
    minHeight: rs(48),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const title = useWatch({ control, name: 'title' });
  const fieldStyle = {
    backgroundColor: colors.backgroundElement,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  } as const;

  return (
    <>
      <Txt variant="caption" tone="secondary" style={styles.eyebrow} weight="500">
        SCHRITT {mode === 'details' ? '1' : '2'} VON 4
      </Txt>
      <Txt variant="heading" style={styles.heading}>
        {mode === 'details' ? 'Rezeptdetails' : 'Gruppen und Zutaten'}
      </Txt>

      {mode === 'details' ? (
        <>
          {/* Titelbild */}
          <TouchableOpacity
            style={[styles.cover, { backgroundColor: colors.backgroundElement }]}
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
              <View style={styles.coverPlaceholder}>
                <View style={[styles.coverIcon, { backgroundColor: colors.accent }]}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M8 5v14l11-7z" fill={colors.onAccent} />
                  </Svg>
                </View>
                <Txt variant="body" weight="500" style={styles.coverActionText}>
                  Titelbild hinzufügen
                </Txt>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.fieldGroup}>
            <Txt variant="caption" weight="700" style={styles.fieldLabel}>
              Titel
            </Txt>
            <Controller
              control={control}
              name="title"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <>
                  <TextInput
                    accessibilityLabel="Titel"
                    style={[styles.field, fieldStyle]}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Rezepttitel"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <FieldError message={error?.message} />
                </>
              )}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Txt variant="caption" weight="700" style={styles.fieldLabel}>
              Beschreibung
            </Txt>
            <Controller
              control={control}
              name="description"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <>
                  <TextInput
                    accessibilityLabel="Beschreibung"
                    style={[styles.field, styles.descriptionField, fieldStyle]}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Kurze Beschreibung des Rezepts"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <FieldError message={error?.message} />
                </>
              )}
            />
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailsColumn}>
              <Txt variant="caption" weight="700" style={styles.fieldLabel}>
                Kochzeit (Minuten)
              </Txt>
              <Controller
                control={control}
                name="cookTimeMinutes"
                render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                  <>
                    <TextInput
                      accessibilityLabel="Kochzeit in Minuten"
                      style={[styles.field, fieldStyle]}
                      value={value}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder="30"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                    <FieldError message={error?.message} />
                  </>
                )}
              />
            </View>

            <View style={styles.servingsColumn}>
              <Txt variant="caption" weight="700" style={styles.fieldLabel}>
                Portionen
              </Txt>
              <Controller
                control={control}
                name="defaultServings"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <>
                    <View
                      style={[
                        styles.servingsControl,
                        { backgroundColor: colors.backgroundElement },
                      ]}>
                      <Press
                        accessibilityRole="button"
                        accessibilityLabel="Eine Portion weniger"
                        onPress={() => onChange(Math.max(1, value - 1))}>
                        <Txt variant="heading" tone="secondary" weight="700">
                          −
                        </Txt>
                      </Press>
                      <Txt variant="body" weight="700">
                        {value}
                      </Txt>
                      <Press
                        accessibilityRole="button"
                        accessibilityLabel="Eine Portion mehr"
                        onPress={() => onChange(value + 1)}>
                        <Txt variant="heading" tone="secondary" weight="700">
                          +
                        </Txt>
                      </Press>
                    </View>
                    <FieldError message={error?.message} />
                  </>
                )}
              />
            </View>
          </View>

          {/* Schwierigkeit */}
          <View style={styles.fieldGroup}>
            <Txt variant="caption" weight="700" style={styles.fieldLabel}>
              Schwierigkeit
            </Txt>
            <Controller
              control={control}
              name="difficulty"
              render={({ field: { onChange, value } }) => (
                <View style={styles.tagWrap}>
                  {DIFFICULTIES.map((difficulty) => {
                    const selected = value === difficulty.value;
                    return (
                      <Press
                        key={difficulty.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[
                          styles.tag,
                          {
                            backgroundColor: selected ? colors.accent : colors.backgroundElement,
                            borderColor: selected ? colors.accent : colors.border,
                          },
                        ]}
                        onPress={() => onChange(selected ? null : difficulty.value)}>
                        <Txt
                          variant="caption"
                          tone={selected ? 'onAccent' : 'primary'}
                          weight="600">
                          {difficulty.label}
                        </Txt>
                      </Press>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Rezepttyp */}
          <View style={styles.fieldGroup}>
            <Txt variant="caption" weight="700" style={styles.fieldLabel}>
              Art des Gerichts
            </Txt>
            <Controller
              control={control}
              name="dishTypes"
              render={({ field: { onChange, value } }) => (
                <View style={styles.tagWrap}>
                  {DISH_TYPES.map((dishType) => {
                    const selected = value.includes(dishType.value);
                    return (
                      <Press
                        key={dishType.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[
                          styles.tag,
                          {
                            backgroundColor: selected ? colors.accent : colors.backgroundElement,
                            borderColor: selected ? colors.accent : colors.border,
                          },
                        ]}
                        onPress={() => onChange(toggle(value, dishType.value))}>
                        <Txt
                          variant="caption"
                          tone={selected ? 'onAccent' : 'primary'}
                          weight="600">
                          {dishType.label}
                        </Txt>
                      </Press>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Ernaehrung */}
          <View style={styles.fieldGroup}>
            <Txt variant="caption" weight="700" style={styles.fieldLabel}>
              Ernährung
            </Txt>
            <Controller
              control={control}
              name="dietaryTags"
              render={({ field: { onChange, value } }) => (
                <View style={styles.tagWrap}>
                  {DIETARY_TAGS.map((dietaryTag) => {
                    const selected = value.includes(dietaryTag.value);
                    return (
                      <Press
                        key={dietaryTag.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[
                          styles.tag,
                          {
                            backgroundColor: selected ? colors.accent : colors.backgroundElement,
                            borderColor: selected ? colors.accent : colors.border,
                          },
                        ]}
                        onPress={() => onChange(toggle(value, dietaryTag.value))}>
                        <Txt
                          variant="caption"
                          tone={selected ? 'onAccent' : 'primary'}
                          weight="600">
                          {dietaryTag.label}
                        </Txt>
                      </Press>
                    );
                  })}
                </View>
              )}
            />
          </View>

          {/* Hashtags */}
          <View style={styles.fieldGroup}>
            <Txt variant="caption" weight="700" style={styles.fieldLabel}>
              Hashtags
            </Txt>
            <Controller
              control={control}
              name="hashtagsInput"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <>
                  <TextInput
                    accessibilityLabel="Hashtags"
                    style={[styles.field, fieldStyle]}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="#vegan #schnell"
                    placeholderTextColor={colors.textSecondary}
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
              style={[styles.componentGroup, { backgroundColor: colors.backgroundElement }]}>
              <View style={styles.componentHeader}>
                <TextInput
                  style={[
                    styles.field,
                    styles.focusableField,
                    focusedField === `component-title-${comp.id}` && styles.focusedField,
                    styles.componentTitle,
                    fieldStyle,
                    { fontWeight: '700' },
                  ]}
                  value={comp.title}
                  onFocus={() => setFocusedField(`component-title-${comp.id}`)}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(val) => onUpdateComponentTitle(comp.id, val)}
                  placeholder="Gruppenname, z. B. Für den Teig"
                  placeholderTextColor={colors.textSecondary}
                />
                {components.length > 1 ? (
                  <TouchableOpacity
                    style={[styles.squareButton, { backgroundColor: colors.backgroundSoft }]}
                    onPress={() => onRemoveComponentGroup(comp.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Zutaten-Gruppe entfernen">
                    <Txt variant="subheading" tone="secondary" weight="500">
                      ×
                    </Txt>
                  </TouchableOpacity>
                ) : null}
              </View>

              {comp.items.map((item) => (
                <View key={item.id} style={styles.ingredientRow}>
                  <ProductSearchDropdown
                    label="Zutat"
                    placeholder="Zutat suchen…"
                    value={item.productQuery}
                    onChangeText={(val) => onUpdateIngredientQuery(comp.id, item.id, val)}
                    onSelectProduct={(product) => onSelectProduct(comp.id, item.id, product)}
                  />
                  <View style={styles.ingredientFields}>
                    <TextInput
                      style={[
                        styles.field,
                        styles.focusableField,
                        focusedField === `quantity-${comp.id}-${item.id}` && styles.focusedField,
                        styles.ingredientInput,
                        fieldStyle,
                      ]}
                      value={item.quantity}
                      onFocus={() => setFocusedField(`quantity-${comp.id}-${item.id}`)}
                      onBlur={() => setFocusedField(null)}
                      onChangeText={(val) => onUpdateQuantity(comp.id, item.id, val)}
                      placeholder="Menge"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                    />
                    <View style={styles.unitField}>
                      <WheelPickerField
                        value={item.unit}
                        options={UNIT_OPTIONS}
                        onChange={(unit) => onUpdateUnit(comp.id, item.id, unit)}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.squareButton, { backgroundColor: colors.backgroundSoft }]}
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
                style={styles.addIngredient}
                onPress={() => onAddIngredient(comp.id)}>
                <Txt variant="caption" tone="primary" weight="600">
                  + Zutat hinzufügen
                </Txt>
              </TouchableOpacity>
            </View>
          ))}

          <Press
            style={[styles.addGroup, { backgroundColor: colors.backgroundElement }]}
            onPress={onAddComponentGroup}
            accessibilityRole="button"
            accessibilityLabel="Add Componente">
            <Txt variant="caption" tone="primary" weight="600">
              + Zutaten-Gruppe hinzufügen
            </Txt>
          </Press>
        </>
      )}

      <View style={styles.actions}>
        <Press
          containerStyle={styles.actionContainer}
          style={[styles.action, { backgroundColor: colors.backgroundElement }]}
          onPress={onCancel}>
          <Txt variant="caption" tone="primary" weight="600">
            {mode === 'details' ? 'Abbrechen' : 'Zurück'}
          </Txt>
        </Press>
        <Press
          containerStyle={styles.actionContainer}
          style={[
            styles.action,
            {
              backgroundColor: colors.accent,
              opacity: !title.trim() || saving ? 0.5 : 1,
            },
          ]}
          onPress={onNext}
          accessibilityRole="button"
          disabled={!title.trim() || saving}>
          <Txt variant="caption" tone="onAccent" weight="600">
            {saving
              ? 'Speichert…'
              : mode === 'details'
                ? 'Weiter zu den Zutaten'
                : 'Weiter zu den Schritten'}
          </Txt>
        </Press>
      </View>
    </>
  );
}
