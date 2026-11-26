import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import {
  Button,
  Card,
  CloseButton,
  MIN_TOUCH_SIZE,
  Press,
  SegmentedControl,
  Surface,
  TextField,
  Txt,
} from '@/constants/ui';
import { getUnitOptions } from '@/lib/units';
import {
  type CustomIngredient,
  customIngredientsSchema,
  customTitleSchema,
  normalizeCustomIngredientUnit,
} from '../domain/custom-ingredients';
import { DEFAULT_PORTIONS_PER_PERSON, type ResolvedServings, resolveServings } from '../servings';
import { dateLabel, getMealSlotLabel, type MealSlot } from '../week';

export type EntryFormInitial = {
  servings_mode: 'portions' | 'people';
  portions: number;
  people_count: number | null;
};

type RecipeEntryFormModalProps = {
  mode?: 'recipe';
  visible: boolean;
  recipeTitle: string;
  entryDate: string;
  mealSlot: MealSlot;
  /** Portionen/Person-Faktor aus den Einstellungen (#130). */
  portionsPerPerson: number;
  /** Anzahl aktiver Haushaltsmitglieder, fuer den Shortcut "ganzer Haushalt isst". */
  householdMemberCount: number;
  initial?: EntryFormInitial;
  onDismiss: () => void;
  onSave: (resolved: ResolvedServings) => void;
  onDelete?: () => void;
};

export type CustomEntryFormValue = {
  title: string;
  ingredients: CustomIngredient[];
  portions: number;
};

type CustomEntryFormModalProps = {
  mode: 'custom';
  visible: boolean;
  entryDate: string;
  mealSlot: MealSlot;
  initial?: CustomEntryFormValue;
  onDismiss: () => void;
  onSave: (value: CustomEntryFormValue) => void;
  onDelete?: () => void;
};

type EntryFormModalProps = RecipeEntryFormModalProps | CustomEntryFormModalProps;

const SERVINGS_MODE_VALUES = ['portions', 'people'] as const;

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: theme.space.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.lg,
  },
  headerText: {
    flex: 1,
    gap: theme.space.xs,
    marginRight: theme.space.sm,
  },
  content: {
    gap: theme.space.lg,
  },
  wholeHouseholdButton: {
    alignSelf: 'flex-start',
  },
  actions: {
    gap: theme.space.sm,
    marginTop: theme.space.lg,
  },
  ingredientList: {
    gap: theme.space.md,
  },
  ingredientRow: {
    gap: theme.space.md,
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  ingredientFields: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.space.md,
  },
  ingredientField: {
    flex: 1,
  },
  removeIngredientButton: {
    minHeight: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
  },
  addIngredientButton: {
    minHeight: MIN_TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.backgroundElement,
  },
}));

/**
 * Anlegen/Bearbeiten eines Wochenplan-Eintrags (#130): Umschalter
 * Portionen-Modus vs. Personen-Modus, Shortcut "ganzer Haushalt isst".
 */
export function EntryFormModal(props: EntryFormModalProps) {
  return props.mode === 'custom' ? (
    <CustomEntryFormModal {...props} />
  ) : (
    <RecipeEntryFormModal {...props} />
  );
}

function RecipeEntryFormModal({
  visible,
  recipeTitle,
  entryDate,
  mealSlot,
  portionsPerPerson,
  householdMemberCount,
  initial,
  onDismiss,
  onSave,
  onDelete,
}: RecipeEntryFormModalProps) {
  const { t, i18n } = useTranslation();
  const servingsModeOptions = SERVINGS_MODE_VALUES.map((value) => ({
    value,
    label: t(`mealPlanner.entry.${value}Mode`),
    accessibilityLabel: t(`mealPlanner.entry.${value}ModeAccessibility`),
  }));
  const [mode, setMode] = useState<'portions' | 'people'>(initial?.servings_mode ?? 'portions');
  const [portionsText, setPortionsText] = useState(String(initial?.portions ?? 1));
  const [peopleText, setPeopleText] = useState(String(initial?.people_count ?? ''));

  useEffect(() => {
    if (!visible) return;
    setMode(initial?.servings_mode ?? 'portions');
    setPortionsText(String(initial?.portions ?? 1));
    setPeopleText(String(initial?.people_count ?? ''));
  }, [visible, initial]);

  const factor = portionsPerPerson || DEFAULT_PORTIONS_PER_PERSON;
  const peopleCount = Number(peopleText);
  const previewPortions =
    mode === 'people' && peopleCount > 0 ? Math.round(peopleCount * factor * 100) / 100 : null;

  function handleWholeHousehold() {
    setPeopleText(String(householdMemberCount));
  }

  function handleSave() {
    try {
      const resolved =
        mode === 'portions'
          ? resolveServings({ mode: 'portions', portions: Number(portionsText) })
          : resolveServings({
              mode: 'people',
              peopleCount: Number(peopleText),
              portionsPerPerson: factor,
            });
      onSave(resolved);
    } catch {
      // Ungueltige Eingabe (<= 0 oder NaN): Button bleibt aktiv, Save schlaegt
      // still fehl, disabled-Zustand unten verhindert den haeufigsten Fall
      // bereits vorher.
    }
  }

  const saveDisabled =
    mode === 'portions' ? !(Number(portionsText) > 0) : !(Number(peopleText) > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onDismiss}>
      <Surface tone="page" style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Txt variant="title" numberOfLines={1}>
                {recipeTitle}
              </Txt>
              <Txt variant="body" tone="secondary">
                {getMealSlotLabel(t, mealSlot)} · {dateLabel(entryDate, i18n.language)}
              </Txt>
            </View>
            <CloseButton onPress={onDismiss} accessibilityLabel={t('mealPlanner.entry.close')} />
          </View>

          <View style={styles.content}>
            <SegmentedControl
              label={t('mealPlanner.entry.servingsMode')}
              options={servingsModeOptions}
              selected={mode}
              onSelect={setMode}
            />

            {mode === 'portions' ? (
              <TextField
                label={t('mealPlanner.entry.portions')}
                value={portionsText}
                onChangeText={setPortionsText}
                keyboardType="decimal-pad"
                placeholder={t('mealPlanner.entry.numberPlaceholder')}
              />
            ) : (
              <>
                <TextField
                  label={t('mealPlanner.entry.people')}
                  value={peopleText}
                  onChangeText={setPeopleText}
                  keyboardType="number-pad"
                  placeholder={t('mealPlanner.entry.numberPlaceholder')}
                />
                <Press
                  haptic="selection"
                  accessibilityRole="button"
                  accessibilityLabel={t('mealPlanner.entry.wholeHousehold', {
                    count: householdMemberCount,
                    unit: t('mealPlanner.entry.person', { count: householdMemberCount }),
                  })}
                  onPress={handleWholeHousehold}
                  style={styles.wholeHouseholdButton}>
                  <Txt variant="label" tone="primary" weight="400">
                    {t('mealPlanner.entry.wholeHousehold', {
                      count: householdMemberCount,
                      unit: t('mealPlanner.entry.person', { count: householdMemberCount }),
                    })}
                  </Txt>
                </Press>
                <Txt variant="body" tone="secondary">
                  {previewPortions !== null
                    ? t('mealPlanner.entry.preview', { portions: previewPortions, factor })
                    : t('mealPlanner.entry.factor', { factor })}
                </Txt>
              </>
            )}

            <View style={styles.actions}>
              <Button
                title={t('mealPlanner.entry.save')}
                onPress={handleSave}
                disabled={saveDisabled}
              />
              {onDelete ? (
                <Button title={t('mealPlanner.entry.remove')} variant="danger" onPress={onDelete} />
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </Surface>
    </Modal>
  );
}

type IngredientDraft = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
};

function toDraft(ingredient: CustomIngredient, id: string): IngredientDraft {
  return {
    id,
    name: ingredient.name,
    quantity: String(ingredient.quantity),
    unit: ingredient.unit,
  };
}

function parseIngredientDrafts(ingredients: IngredientDraft[]) {
  return customIngredientsSchema.safeParse(
    ingredients.map(({ name, quantity, unit }) => ({
      name,
      quantity: Number(quantity.trim().replace(',', '.')),
      unit: normalizeCustomIngredientUnit(unit),
    })),
  );
}

function CustomEntryFormModal({
  visible,
  entryDate,
  mealSlot,
  initial,
  onDismiss,
  onSave,
  onDelete,
}: CustomEntryFormModalProps) {
  const { t, i18n } = useTranslation();
  const unitOptions = getUnitOptions(t);
  const nextId = useRef(0);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [portionsText, setPortionsText] = useState(String(initial?.portions ?? 1));
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    (initial?.ingredients ?? []).map((item) => toDraft(item, `initial-${nextId.current++}`)),
  );

  useEffect(() => {
    if (!visible) return;
    nextId.current = 0;
    setTitle(initial?.title ?? '');
    setPortionsText(String(initial?.portions ?? 1));
    setIngredients(
      (initial?.ingredients ?? []).map((item) => toDraft(item, `initial-${nextId.current++}`)),
    );
  }, [visible, initial?.title, initial?.portions, initial?.ingredients]);

  function addIngredient() {
    setIngredients((current) => [
      ...current,
      { id: `new-${nextId.current++}`, name: '', quantity: '1', unit: 'piece' },
    ]);
  }

  function updateIngredient(id: string, patch: Partial<Omit<IngredientDraft, 'id'>>) {
    setIngredients((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function handleSave() {
    const parsedTitle = customTitleSchema.safeParse(title);
    const parsedIngredients = parseIngredientDrafts(ingredients);
    const portions = Number(portionsText.trim().replace(',', '.'));

    if (
      !parsedTitle.success ||
      !parsedIngredients.success ||
      !Number.isFinite(portions) ||
      portions <= 0
    ) {
      return;
    }

    onSave({ title: parsedTitle.data, ingredients: parsedIngredients.data, portions });
  }

  const portions = Number(portionsText.trim().replace(',', '.'));
  const saveDisabled =
    !customTitleSchema.safeParse(title).success ||
    !parseIngredientDrafts(ingredients).success ||
    !Number.isFinite(portions) ||
    portions <= 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onDismiss}>
      <Surface tone="page" style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Txt variant="title">{t('mealPlanner.entry.customTitle')}</Txt>
              <Txt variant="body" tone="secondary">
                {getMealSlotLabel(t, mealSlot)} · {dateLabel(entryDate, i18n.language)}
              </Txt>
            </View>
            <CloseButton onPress={onDismiss} accessibilityLabel={t('mealPlanner.entry.close')} />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <TextField
              label={t('mealPlanner.entry.dish')}
              value={title}
              onChangeText={setTitle}
              placeholder={t('mealPlanner.entry.dishPlaceholder')}
              maxLength={120}
            />

            <TextField
              label={t('mealPlanner.entry.portions')}
              value={portionsText}
              onChangeText={setPortionsText}
              keyboardType="decimal-pad"
              placeholder={t('mealPlanner.entry.numberPlaceholder')}
            />

            <View style={styles.ingredientList}>
              <Txt variant="heading">{t('mealPlanner.entry.ingredients')}</Txt>
              {ingredients.map((ingredient, index) => (
                <Card key={ingredient.id} soft style={styles.ingredientRow}>
                  <View style={styles.ingredientHeader}>
                    <Txt variant="label">
                      {t('mealPlanner.entry.ingredient', { index: index + 1 })}
                    </Txt>
                    <Press
                      accessibilityRole="button"
                      accessibilityLabel={t('mealPlanner.entry.removeIngredient', {
                        index: index + 1,
                      })}
                      haptic="none"
                      onPress={() => {
                        setIngredients((current) =>
                          current.filter((item) => item.id !== ingredient.id),
                        );
                      }}
                      style={styles.removeIngredientButton}>
                      <Txt variant="caption" tone="danger">
                        {t('mealPlanner.entry.removeIngredient', { index: index + 1 })}
                      </Txt>
                    </Press>
                  </View>
                  <TextField
                    accessibilityLabel={t('mealPlanner.entry.ingredient', { index: index + 1 })}
                    value={ingredient.name}
                    onChangeText={(name) => updateIngredient(ingredient.id, { name })}
                    placeholder={t('mealPlanner.entry.namePlaceholder')}
                    maxLength={200}
                  />
                  <View style={styles.ingredientFields}>
                    <View style={styles.ingredientField}>
                      <TextField
                        label={t('mealPlanner.entry.quantity')}
                        value={ingredient.quantity}
                        onChangeText={(quantity) => updateIngredient(ingredient.id, { quantity })}
                        keyboardType="decimal-pad"
                        placeholder={t('mealPlanner.entry.numberPlaceholder')}
                      />
                    </View>
                    <View style={styles.ingredientField}>
                      <WheelPickerField
                        label={t('mealPlanner.entry.unit')}
                        value={ingredient.unit}
                        options={unitOptions}
                        onChange={(unit) => updateIngredient(ingredient.id, { unit })}
                      />
                    </View>
                  </View>
                </Card>
              ))}
              <Press
                accessibilityRole="button"
                haptic="none"
                onPress={addIngredient}
                disabled={ingredients.length >= 100}
                style={styles.addIngredientButton}>
                <Txt variant="body" tone="primary" weight="600">
                  {t('mealPlanner.entry.addIngredient')}
                </Txt>
              </Press>
            </View>

            <View style={styles.actions}>
              <Button
                title={t('mealPlanner.entry.save')}
                onPress={handleSave}
                disabled={saveDisabled}
              />
              {onDelete ? (
                <Button title={t('mealPlanner.entry.remove')} variant="danger" onPress={onDelete} />
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Surface>
    </Modal>
  );
}
