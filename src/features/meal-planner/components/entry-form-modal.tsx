import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/forms/text-field';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Surface, Txt } from '@/constants/ui';
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
  const { colors } = useTheme();
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
      <Surface tone="page" className="rpm-root">
        <SafeAreaView className="rpm-safe-area" edges={['top', 'left', 'right', 'bottom']}>
          <View className="rpm-header">
            <View className="efm-header-text">
              <Txt variant="title" numberOfLines={1}>
                {recipeTitle}
              </Txt>
              <Txt variant="body" tone="secondary">
                {MEAL_SLOT_LABELS[mealSlot]} · {entryDate}
              </Txt>
            </View>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              className="rpm-close-button">
              <Txt variant="body">✕</Txt>
            </Pressable>
          </View>

          <View className="efm-content">
            <View className="efm-mode-row">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Portionen-Modus"
                accessibilityState={{ selected: mode === 'portions' }}
                onPress={() => setMode('portions')}
                className="efm-mode-button"
                style={{
                  backgroundColor: mode === 'portions' ? colors.accent : colors.backgroundElement,
                }}>
                <Txt
                  variant="body"
                  tone={mode === 'portions' ? 'onAccent' : 'primary'}
                  weight="700">
                  Portionen
                </Txt>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Personen-Modus"
                accessibilityState={{ selected: mode === 'people' }}
                onPress={() => setMode('people')}
                className="efm-mode-button"
                style={{
                  backgroundColor: mode === 'people' ? colors.accent : colors.backgroundElement,
                }}>
                <Txt variant="body" tone={mode === 'people' ? 'onAccent' : 'primary'} weight="700">
                  Personen
                </Txt>
              </Pressable>
            </View>

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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ganzer Haushalt isst"
                  onPress={handleWholeHousehold}
                  className="efm-whole-household-button">
                  <Txt variant="label" tone="primary" weight="400">
                    Ganzer Haushalt isst ({householdMemberCount}{' '}
                    {householdMemberCount === 1 ? 'Person' : 'Personen'})
                  </Txt>
                </Pressable>
                <Txt variant="body" tone="secondary">
                  {previewPortions !== null
                    ? `≈ ${previewPortions} Portionen (${factor} Portionen/Person)`
                    : `${factor} Portionen/Person`}
                </Txt>
              </>
            )}

            <View className="efm-actions">
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
