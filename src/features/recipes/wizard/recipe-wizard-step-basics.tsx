import { Image } from 'expo-image';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { font, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, Press, TextField, Txt } from '@/constants/ui';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import type { CatalogProduct } from '@/features/product-search/types';
import type { RecipeFormValues } from '@/lib/db/zod/recipe-form-schema.zod';
import { UNIT_OPTIONS } from '@/lib/units';
import { DIETARY_TAGS, DIFFICULTIES, DISH_TYPES } from './recipe-metadata-options';
import type { IngredientComponentGroup } from './types';

const styles = StyleSheet.create((theme) => ({
  eyebrow: {
    paddingTop: theme.space.md,
  },
  heading: {
    paddingTop: theme.space.md,
    paddingBottom: theme.space.lg,
  },
  cover: {
    width: '100%',
    height: rs(200),
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: theme.space.xxl,
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
    marginTop: theme.space.lg,
  },
  fieldGroup: {
    marginBottom: theme.space.lg,
  },
  fieldLabel: {
    marginBottom: theme.space.md,
  },
  inputLayout: {
    minHeight: rs(44),
    paddingHorizontal: theme.space.xxl,
  },
  descriptionField: {
    height: rs(76),
  },
  detailsRow: {
    flexDirection: 'row',
    gap: theme.space.lg,
  },
  detailsColumn: {
    flex: 1,
    marginBottom: theme.space.lg,
  },
  servingsColumn: {
    marginBottom: theme.space.lg,
  },
  servingsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radius.sm,
    height: rs(44),
    paddingHorizontal: theme.space.xxl,
    minWidth: rs(100),
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.md,
  },
  tag: {
    paddingHorizontal: theme.space.xxl,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.sm,
    borderWidth: theme.borderWidth.base,
  },
  componentGroup: {
    marginBottom: theme.space.lg,
    padding: theme.space.md,
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
  // `rs(44)` faellt auf Geraeten unter 384pt auf 43. Die Interaktionsflaeche
  // haengt deshalb an der festen Untergrenze, die sichtbare am skalierten Wert.
  squareButtonFace: {
    width: rs(44),
    height: rs(44),
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ingredientRow: {
    marginBottom: theme.space.lg,
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
    paddingVertical: theme.space.md,
    alignSelf: 'flex-start',
  },
  addGroup: {
    width: '100%',
    height: rs(42),
    borderRadius: theme.radius.famLarge,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.space.sm,
    marginBottom: theme.space.xxl,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space.lg,
    marginBottom: theme.space.lg,
  },
  actionContainer: {
    flex: 1,
  },
  action: {
    minHeight: theme.controlSizes.touchTarget,
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
  const title = useWatch({ control, name: 'title' });

  return (
    <>
      <Txt variant="eyebrow" tone="secondary" style={styles.eyebrow} weight="500">
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
                <TextField
                  accessibilityLabel="Titel"
                  style={styles.inputLayout}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Rezepttitel"
                  error={error?.message}
                />
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
                <TextField
                  accessibilityLabel="Beschreibung"
                  style={[styles.inputLayout, styles.descriptionField]}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Kurze Beschreibung des Rezepts"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  error={error?.message}
                />
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
                  <TextField
                    accessibilityLabel="Kochzeit in Minuten"
                    style={styles.inputLayout}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="30"
                    keyboardType="numeric"
                    error={error?.message}
                  />
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
                <TextField
                  accessibilityLabel="Hashtags"
                  style={styles.inputLayout}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="#vegan #schnell"
                  error={error?.message}
                />
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
                <View style={styles.componentTitle}>
                  <TextField
                    accessibilityLabel="Gruppenname"
                    weight={font.weight.bold}
                    value={comp.title}
                    onChangeText={(val) => onUpdateComponentTitle(comp.id, val)}
                    placeholder="Gruppenname, z. B. Für den Teig"
                  />
                </View>
                {components.length > 1 ? (
                  <TouchableOpacity
                    style={styles.squareButton}
                    onPress={() => onRemoveComponentGroup(comp.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Zutaten-Gruppe entfernen">
                    <View
                      style={[styles.squareButtonFace, { backgroundColor: colors.backgroundSoft }]}>
                      <Txt variant="subheading" tone="secondary" weight="500">
                        ×
                      </Txt>
                    </View>
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
                    <View style={styles.ingredientInput}>
                      <TextField
                        accessibilityLabel="Menge"
                        value={item.quantity}
                        onChangeText={(val) => onUpdateQuantity(comp.id, item.id, val)}
                        placeholder="Menge"
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.unitField}>
                      <WheelPickerField
                        value={item.unit}
                        options={UNIT_OPTIONS}
                        onChange={(unit) => onUpdateUnit(comp.id, item.id, unit)}
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.squareButton}
                      onPress={() => onRemoveIngredient(comp.id, item.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete ingredient">
                      <View
                        style={[
                          styles.squareButtonFace,
                          { backgroundColor: colors.backgroundSoft },
                        ]}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                            stroke={colors.text}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
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
