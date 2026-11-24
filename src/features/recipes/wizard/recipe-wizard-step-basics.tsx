import { Image } from 'expo-image';
import { type Control, Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StyleSheet } from 'react-native-unistyles';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { font, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, Press, TextField, Txt } from '@/constants/ui';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import type { CatalogProduct } from '@/features/product-search/types';
import type { RecipeFormValues } from '@/lib/db/zod/recipe-form-schema.zod';
import { getUnitOptions } from '@/lib/units';
import { IngredientMappingEditor } from '../components/ingredient-mapping-editor';
import type { IngredientMappingReview } from '../domain/ingredient-mapping';
import {
  getDietaryTagOptions,
  getDifficultyOptions,
  getDishTypeOptions,
} from './recipe-metadata-options';
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
  reviewerId?: string;
  showIngredientMapping?: boolean;
  onIngredientMappingChange?: (
    componentId: string,
    ingredientId: string,
    mapping: IngredientMappingReview,
  ) => void;
  onIngredientEvidenceChange?: (
    componentId: string,
    ingredientId: string,
    evidence: string,
  ) => void;
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
  reviewerId,
  showIngredientMapping = true,
  onIngredientMappingChange,
  onIngredientEvidenceChange,
  onAddComponentGroup,
  onUpdateComponentTitle,
  onRemoveComponentGroup,
  saving,
  onCancel,
  onNext,
}: RecipeWizardStepBasicsProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const title = useWatch({ control, name: 'title' });
  const difficulties = getDifficultyOptions(t);
  const dishTypes = getDishTypeOptions(t);
  const dietaryTags = getDietaryTagOptions(t);
  const unitOptions = getUnitOptions(t);

  return (
    <>
      <Txt variant="eyebrow" tone="secondary" style={styles.eyebrow} weight="500">
        {t('recipes.wizard.stepOf', { current: mode === 'details' ? 1 : 2 })}
      </Txt>
      <Txt variant="heading" style={styles.heading}>
        {mode === 'details' ? t('recipes.wizard.details') : t('recipes.wizard.groups')}
      </Txt>

      {mode === 'details' ? (
        <>
          {/* Titelbild */}
          <Press
            style={[styles.cover, { backgroundColor: colors.backgroundElement }]}
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
                  {t('recipes.wizard.coverAdd')}
                </Txt>
              </View>
            )}
          </Press>

          <View style={styles.fieldGroup}>
            <Txt variant="caption" weight="700" style={styles.fieldLabel}>
              {t('recipes.wizard.title')}
            </Txt>
            <Controller
              control={control}
              name="title"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <TextField
                  accessibilityLabel={t('recipes.wizard.titleLabel')}
                  style={styles.inputLayout}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('recipes.wizard.titlePlaceholder')}
                  error={error?.message}
                />
              )}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Txt variant="caption" weight="700" style={styles.fieldLabel}>
              {t('recipes.wizard.description')}
            </Txt>
            <Controller
              control={control}
              name="description"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <TextField
                  accessibilityLabel={t('recipes.wizard.descriptionLabel')}
                  style={[styles.inputLayout, styles.descriptionField]}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('recipes.wizard.descriptionPlaceholder')}
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
                {t('recipes.wizard.cookTime')}
              </Txt>
              <Controller
                control={control}
                name="cookTimeMinutes"
                render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                  <TextField
                    accessibilityLabel={t('recipes.wizard.cookTimeLabel')}
                    style={styles.inputLayout}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder={t('recipes.wizard.cookTimePlaceholder')}
                    keyboardType="numeric"
                    error={error?.message}
                  />
                )}
              />
            </View>

            <View style={styles.servingsColumn}>
              <Txt variant="caption" weight="700" style={styles.fieldLabel}>
                {t('recipes.wizard.servings')}
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
                        accessibilityLabel={t('recipes.wizard.lessServing')}
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
                        accessibilityLabel={t('recipes.wizard.moreServing')}
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
              {t('recipes.wizard.difficulty')}
            </Txt>
            <Controller
              control={control}
              name="difficulty"
              render={({ field: { onChange, value } }) => (
                <View style={styles.tagWrap}>
                  {difficulties.map((difficulty) => {
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
              {t('recipes.wizard.dishType')}
            </Txt>
            <Controller
              control={control}
              name="dishTypes"
              render={({ field: { onChange, value } }) => (
                <View style={styles.tagWrap}>
                  {dishTypes.map((dishType) => {
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
              {t('recipes.wizard.dietary')}
            </Txt>
            <Controller
              control={control}
              name="dietaryTags"
              render={({ field: { onChange, value } }) => (
                <View style={styles.tagWrap}>
                  {dietaryTags.map((dietaryTag) => {
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
              {t('recipes.wizard.hashtags')}
            </Txt>
            <Controller
              control={control}
              name="hashtagsInput"
              render={({ field: { onBlur, onChange, value }, fieldState: { error } }) => (
                <TextField
                  accessibilityLabel={t('recipes.wizard.hashtags')}
                  style={styles.inputLayout}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('recipes.wizard.hashtagsPlaceholder')}
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
                    accessibilityLabel={t('recipes.wizard.groupName')}
                    weight={font.weight.bold}
                    value={comp.title}
                    onChangeText={(val) => onUpdateComponentTitle(comp.id, val)}
                    placeholder={t('recipes.wizard.groupPlaceholder')}
                  />
                </View>
                {components.length > 1 ? (
                  <Press
                    style={styles.squareButton}
                    onPress={() => onRemoveComponentGroup(comp.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('recipes.wizard.removeGroup')}>
                    <View
                      style={[styles.squareButtonFace, { backgroundColor: colors.backgroundSoft }]}>
                      <Txt variant="subheading" tone="secondary" weight="500">
                        ×
                      </Txt>
                    </View>
                  </Press>
                ) : null}
              </View>

              {comp.items.map((item) => (
                <View key={item.id} style={styles.ingredientRow}>
                  <ProductSearchDropdown
                    label={t('recipes.wizard.ingredient')}
                    placeholder={t('recipes.wizard.ingredientSearch')}
                    value={item.productQuery}
                    onChangeText={(val) => onUpdateIngredientQuery(comp.id, item.id, val)}
                    onSelectProduct={(product) => onSelectProduct(comp.id, item.id, product)}
                  />
                  {showIngredientMapping ? (
                    <IngredientMappingEditor
                      key={`${item.id}:${item.mappingSource?.sourceId ?? 'unknown'}:${item.mappingSource?.sourceVersion ?? 'unversioned'}`}
                      itemId={item.id}
                      sourceText={item.sourceText ?? null}
                      extractionConfidence={item.ingredientExtractionConfidence}
                      mapping={
                        item.ingredientMapping ?? {
                          version: 1,
                          status: 'unknown',
                          ingredientIds: [],
                          complete: false,
                        }
                      }
                      evidenceSnapshot={item.mappingEvidenceSnapshot ?? ''}
                      source={item.mappingSource ?? null}
                      reviewerId={reviewerId}
                      onChange={(mapping) => onIngredientMappingChange?.(comp.id, item.id, mapping)}
                      onEvidenceChange={(evidence) =>
                        onIngredientEvidenceChange?.(comp.id, item.id, evidence)
                      }
                    />
                  ) : null}
                  <View style={styles.ingredientFields}>
                    <View style={styles.ingredientInput}>
                      <TextField
                        accessibilityLabel={t('recipes.wizard.quantity')}
                        value={item.quantity}
                        onChangeText={(val) => onUpdateQuantity(comp.id, item.id, val)}
                        placeholder={t('recipes.wizard.quantity')}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.unitField}>
                      <WheelPickerField
                        value={item.unit}
                        options={unitOptions}
                        onChange={(unit) => onUpdateUnit(comp.id, item.id, unit)}
                      />
                    </View>
                    <Press
                      style={styles.squareButton}
                      onPress={() => onRemoveIngredient(comp.id, item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('recipes.wizard.deleteIngredient')}>
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
                    </Press>
                  </View>
                  {item.notConvertible ? (
                    <Txt variant="caption" tone="danger">
                      {t('recipes.wizard.conversionWarning')}
                    </Txt>
                  ) : null}
                </View>
              ))}

              <Press style={styles.addIngredient} onPress={() => onAddIngredient(comp.id)}>
                <Txt variant="caption" tone="primary" weight="600">
                  {t('recipes.wizard.addIngredient')}
                </Txt>
              </Press>
            </View>
          ))}

          <Press
            style={[styles.addGroup, { backgroundColor: colors.backgroundElement }]}
            onPress={onAddComponentGroup}
            accessibilityRole="button"
            accessibilityLabel={t('recipes.wizard.addGroup')}>
            <Txt variant="caption" tone="primary" weight="600">
              {t('recipes.wizard.addGroup')}
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
            {mode === 'details' ? t('recipes.wizard.cancel') : t('recipes.wizard.back')}
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
              ? t('recipes.wizard.saving')
              : mode === 'details'
                ? t('recipes.wizard.nextIngredients')
                : t('recipes.wizard.nextSteps')}
          </Txt>
        </Press>
      </View>
    </>
  );
}
