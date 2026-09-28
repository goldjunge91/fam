import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { space } from '@/components/theme/index';
import {
  Button,
  CloseButton,
  Press,
  Row,
  SegmentedControl,
  Surface,
  TextField,
  Txt,
} from '@/constants/ui';
import { UNIT_OPTIONS } from '@/lib/units';
import {
  type CustomIngredient,
  customIngredientsSchema,
  customTitleSchema,
  normalizeCustomIngredientUnit,
} from '../domain/custom-ingredients';
import { DEFAULT_PORTIONS_PER_PERSON, type ResolvedServings, resolveServings } from '../servings';
import { MEAL_SLOT_LABELS, type MealSlot } from '../week';

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

const SERVINGS_MODE_OPTIONS = [
  {
    value: 'portions',
    label: 'Portionen',
    accessibilityLabel: 'Portionen-Modus',
  },
  {
    value: 'people',
    label: 'Personen',
    accessibilityLabel: 'Personen-Modus',
  },
] as const;

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
    gap: theme.space.xs,
  },
  ingredientName: {
    flex: 1,
  },
  ingredientQuantity: {
    width: 76,
  },
  ingredientUnit: {
    width: 88,
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
                {MEAL_SLOT_LABELS[mealSlot]} · {entryDate}
              </Txt>
            </View>
            <CloseButton onPress={onDismiss} accessibilityLabel="Schließen" />
          </View>

          <View style={styles.content}>
            <SegmentedControl
              label="Portionen-/Personen-Modus"
              options={SERVINGS_MODE_OPTIONS}
              selected={mode}
              onSelect={setMode}
            />

            {mode === 'portions' ? (
              <TextField
                label="Portionen"
                value={portionsText}
                onChangeText={setPortionsText}
                keyboardType="decimal-pad"
                placeholder="z. B. 4"
              />
            ) : (
              <>
                <TextField
                  label="Personen"
                  value={peopleText}
                  onChangeText={setPeopleText}
                  keyboardType="number-pad"
                  placeholder="z. B. 4"
                />
                <Press
                  haptic="selection"
                  accessibilityRole="button"
                  accessibilityLabel="Ganzer Haushalt isst"
                  onPress={handleWholeHousehold}
                  style={styles.wholeHouseholdButton}>
                  <Txt variant="label" tone="primary" weight="400">
                    Ganzer Haushalt isst ({householdMemberCount}{' '}
                    {householdMemberCount === 1 ? 'Person' : 'Personen'})
                  </Txt>
                </Press>
                <Txt variant="body" tone="secondary">
                  {previewPortions !== null
                    ? `≈ ${previewPortions} Portionen (${factor} Portionen/Person)`
                    : `${factor} Portionen/Person`}
                </Txt>
              </>
            )}

            <View style={styles.actions}>
              <Button title="Speichern" onPress={handleSave} disabled={saveDisabled} />
              {onDelete ? (
                <Button title="Eintrag entfernen" variant="danger" onPress={onDelete} />
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
  const nextId = useRef(0);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    (initial?.ingredients ?? []).map((item) => toDraft(item, `initial-${nextId.current++}`)),
  );

  useEffect(() => {
    if (!visible) return;
    nextId.current = 0;
    setTitle(initial?.title ?? '');
    setIngredients(
      (initial?.ingredients ?? []).map((item) => toDraft(item, `initial-${nextId.current++}`)),
    );
  }, [visible, initial?.title, initial?.ingredients]);

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

    if (!parsedTitle.success || !parsedIngredients.success) return;

    onSave({ title: parsedTitle.data, ingredients: parsedIngredients.data });
  }

  const saveDisabled =
    !customTitleSchema.safeParse(title).success || !parseIngredientDrafts(ingredients).success;

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
              <Txt variant="title">Freies Gericht</Txt>
              <Txt variant="body" tone="secondary">
                {MEAL_SLOT_LABELS[mealSlot]} · {entryDate}
              </Txt>
            </View>
            <CloseButton onPress={onDismiss} accessibilityLabel="Schließen" />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <TextField
              label="Gericht"
              value={title}
              onChangeText={setTitle}
              placeholder="z. B. Gemüsepfanne"
              maxLength={120}
            />

            <View style={styles.ingredientList}>
              <Txt variant="heading">Zutaten</Txt>
              {ingredients.map((ingredient, index) => (
                <Surface key={ingredient.id} tone="soft" style={styles.ingredientRow}>
                  <Row gap={space.sm} align="flex-end">
                    <View style={styles.ingredientName}>
                      <TextField
                        label={`Zutat ${index + 1}`}
                        value={ingredient.name}
                        onChangeText={(name) => updateIngredient(ingredient.id, { name })}
                        placeholder="Zutat"
                        maxLength={200}
                      />
                    </View>
                    <View style={styles.ingredientQuantity}>
                      <TextField
                        label="Menge"
                        value={ingredient.quantity}
                        onChangeText={(quantity) => updateIngredient(ingredient.id, { quantity })}
                        keyboardType="decimal-pad"
                        placeholder="1"
                      />
                    </View>
                    <View style={styles.ingredientUnit}>
                      <TextField
                        label="Einheit"
                        value={ingredient.unit}
                        onChangeText={(unit) => updateIngredient(ingredient.id, { unit })}
                        placeholder="piece"
                        maxLength={16}
                        autoCapitalize="none"
                      />
                    </View>
                  </Row>
                  <Button
                    title="Zutat entfernen"
                    variant="link"
                    size="sm"
                    onPress={() => {
                      setIngredients((current) =>
                        current.filter((item) => item.id !== ingredient.id),
                      );
                    }}
                  />
                </Surface>
              ))}
              <Button
                title="Zutat hinzufügen"
                variant="secondary"
                onPress={addIngredient}
                disabled={ingredients.length >= 100}
              />
              <Txt variant="caption" tone="secondary">
                Einheiten:{' '}
                {UNIT_OPTIONS.map((option) => `${option.label} (${option.value})`).join(', ')}
              </Txt>
            </View>

            <View style={styles.actions}>
              <Button title="Speichern" onPress={handleSave} disabled={saveDisabled} />
              {onDelete ? (
                <Button title="Eintrag entfernen" variant="danger" onPress={onDelete} />
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Surface>
    </Modal>
  );
}
