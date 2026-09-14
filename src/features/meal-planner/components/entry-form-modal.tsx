import { useEffect, useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import {
  Button,
  CloseButton,
  Press,
  SegmentedControl,
  Surface,
  TextField,
  Txt,
} from '@/constants/ui';
import { DEFAULT_PORTIONS_PER_PERSON, type ResolvedServings, resolveServings } from '../servings';
import { MEAL_SLOT_LABELS, type MealSlot } from '../week';

export type EntryFormInitial = {
  servings_mode: 'portions' | 'people';
  portions: number;
  people_count: number | null;
};

type EntryFormModalProps = {
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
    paddingHorizontal: theme.space.xl + theme.space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.lg,
  },
  headerText: {
    flex: 1,
    gap: theme.space.xs / 2,
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
}));

/**
 * Anlegen/Bearbeiten eines Wochenplan-Eintrags (#130): Umschalter
 * Portionen-Modus vs. Personen-Modus, Shortcut "ganzer Haushalt isst".
 */
export function EntryFormModal({
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
}: EntryFormModalProps) {
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
