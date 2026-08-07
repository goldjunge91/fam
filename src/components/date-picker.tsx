import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DatePickerProps {
  label?: string;
  value: string; // "YYYY-MM-DD"
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}

export function DatePicker({
  label = 'Geburtsdatum',
  value,
  onChangeText,
  placeholder = 'JJJJ-MM-TT (z.B. 2020-05-14)',
  error,
}: DatePickerProps) {
  const theme = useTheme();
  const [showModal, setShowModal] = useState(false);

  // Default year/month/day selection state in modal
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? new Date(value.trim())
    : new Date();
  const [selYear, setSelYear] = useState(initialDate.getFullYear());
  const [selMonth, setSelMonth] = useState(initialDate.getMonth() + 1);
  const [selDay, setSelDay] = useState(initialDate.getDate());

  function handleChange(text: string) {
    onChangeText(text);
  }

  function handleApplyModal() {
    const y = String(selYear).padStart(4, '0');
    const m = String(selMonth).padStart(2, '0');
    const d = String(selDay).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;
    onChangeText(formatted);
    setShowModal(false);
  }

  // Format valid ISO date into readable German format
  let formattedDisplay: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const dateObj = new Date(value.trim());
    if (!Number.isNaN(dateObj.getTime())) {
      formattedDisplay = dateObj.toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <TextField
            label={label}
            placeholder={placeholder}
            value={value}
            onChangeText={handleChange}
            keyboardType="numeric"
            error={error}
          />
        </View>
        <Pressable
          onPress={() => setShowModal(true)}
          style={[
            styles.pickerBtn,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <ThemedText style={{ fontSize: 18 }}>📅</ThemedText>
        </Pressable>
      </View>

      {formattedDisplay && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          📅 {formattedDisplay}
        </ThemedText>
      )}

      {/* Modal Date Selector */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle">Datum auswählen</ThemedText>

            <View style={styles.pickerGrid}>
              {/* Year Adjust */}
              <View style={styles.column}>
                <ThemedText type="smallBold">Jahr</ThemedText>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setSelYear((y) => Math.max(1900, y - 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>-</ThemedText>
                  </Pressable>
                  <ThemedText type="smallBold">{selYear}</ThemedText>
                  <Pressable
                    onPress={() => setSelYear((y) => Math.min(2100, y + 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>+</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Month Adjust */}
              <View style={styles.column}>
                <ThemedText type="smallBold">Monat</ThemedText>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setSelMonth((m) => (m <= 1 ? 12 : m - 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>-</ThemedText>
                  </Pressable>
                  <ThemedText type="smallBold">{String(selMonth).padStart(2, '0')}</ThemedText>
                  <Pressable
                    onPress={() => setSelMonth((m) => (m >= 12 ? 1 : m + 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>+</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Day Adjust */}
              <View style={styles.column}>
                <ThemedText type="smallBold">Tag</ThemedText>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setSelDay((d) => (d <= 1 ? 31 : d - 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>-</ThemedText>
                  </Pressable>
                  <ThemedText type="smallBold">{String(selDay).padStart(2, '0')}</ThemedText>
                  <Pressable
                    onPress={() => setSelDay((d) => (d >= 31 ? 1 : d + 1))}
                    style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.btnText}>+</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <View style={styles.flex}>
                <Button label="Übernehmen" onPress={handleApplyModal} />
              </View>
              <View style={styles.flex}>
                <Button label="Abbrechen" variant="secondary" onPress={() => setShowModal(false)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  pickerBtn: {
    height: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginLeft: 4,
    marginTop: -2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalBox: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  pickerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: Spacing.two,
  },
  column: {
    alignItems: 'center',
    gap: 8,
  },
  stepper: {
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
