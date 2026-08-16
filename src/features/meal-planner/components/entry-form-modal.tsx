import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
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
      <ThemedView style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="subtitle" numberOfLines={1}>
                {recipeTitle}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {MEAL_SLOT_LABELS[mealSlot]} · {entryDate}
              </ThemedText>
            </View>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText>✕</ThemedText>
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={styles.modeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Portionen-Modus"
                accessibilityState={{ selected: mode === 'portions' }}
                onPress={() => setMode('portions')}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: mode === 'portions' ? theme.accent : theme.backgroundElement,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: mode === 'portions' ? '#ffffff' : theme.text }}>
                  Portionen
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Personen-Modus"
                accessibilityState={{ selected: mode === 'people' }}
                onPress={() => setMode('people')}
                style={[
                  styles.modeButton,
                  { backgroundColor: mode === 'people' ? theme.accent : theme.backgroundElement },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: mode === 'people' ? '#ffffff' : theme.text }}>
                  Personen
                </ThemedText>
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
                  style={styles.wholeHouseholdButton}>
                  <ThemedText type="link">
                    Ganzer Haushalt isst ({householdMemberCount}{' '}
                    {householdMemberCount === 1 ? 'Person' : 'Personen'})
                  </ThemedText>
                </Pressable>
                <ThemedText type="small" themeColor="textSecondary">
                  {previewPortions !== null
                    ? `≈ ${previewPortions} Portionen (${factor} Portionen/Person)`
                    : `${factor} Portionen/Person`}
                </ThemedText>
              </>
            )}

            <View style={styles.actions}>
              <Button label="Speichern" onPress={handleSave} disabled={saveDisabled} />
              {onDelete ? (
                <Button label="Eintrag entfernen" variant="danger" onPress={onDelete} />
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  headerText: { flex: 1, marginRight: Spacing.two, gap: 2 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { gap: Spacing.three },
  modeRow: { flexDirection: 'row', gap: Spacing.two },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radius.control,
    alignItems: 'center',
  },
  wholeHouseholdButton: { alignSelf: 'flex-start' },
  actions: { gap: Spacing.two, marginTop: Spacing.three },
});
