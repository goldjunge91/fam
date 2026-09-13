import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { type Palette, radius, space } from '@/components/theme/index';
import { useThemedStyles } from '@/components/theme/ThemeProvider';
import { Button, TextField, Txt } from '@/constants/ui';

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
  const styles = useThemedStyles(makeStyles);
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
    <View style={styles.root}>
      <View style={styles.dateRow}>
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
          accessibilityRole="button"
          accessibilityLabel="Datum auswählen"
          style={styles.calendarButton}>
          <Txt variant="body">📅</Txt>
        </Pressable>
      </View>

      {formattedDisplay && (
        <Txt variant="body" tone="secondary" style={styles.formattedDate}>
          📅 {formattedDisplay}
        </Txt>
      )}

      {/* Modal Date Selector */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Txt variant="title" weight="600">
              Datum auswählen
            </Txt>

            <View style={styles.dateColumns}>
              {/* Year Adjust */}
              <View style={styles.column}>
                <Txt variant="body" weight="700">
                  Jahr
                </Txt>
                <View style={styles.adjustments}>
                  <Pressable
                    onPress={() => setSelYear((y) => Math.max(1900, y - 1))}
                    style={styles.adjustButton}>
                    <Txt variant="body" weight="700">
                      -
                    </Txt>
                  </Pressable>
                  <Txt variant="body" weight="700">
                    {selYear}
                  </Txt>
                  <Pressable
                    onPress={() => setSelYear((y) => Math.min(2100, y + 1))}
                    style={styles.adjustButton}>
                    <Txt variant="body" weight="700">
                      +
                    </Txt>
                  </Pressable>
                </View>
              </View>

              {/* Month Adjust */}
              <View style={styles.column}>
                <Txt variant="body" weight="700">
                  Monat
                </Txt>
                <View style={styles.adjustments}>
                  <Pressable
                    onPress={() => setSelMonth((m) => (m <= 1 ? 12 : m - 1))}
                    style={styles.adjustButton}>
                    <Txt variant="body" weight="700">
                      -
                    </Txt>
                  </Pressable>
                  <Txt variant="body" weight="700">
                    {String(selMonth).padStart(2, '0')}
                  </Txt>
                  <Pressable
                    onPress={() => setSelMonth((m) => (m >= 12 ? 1 : m + 1))}
                    style={styles.adjustButton}>
                    <Txt variant="body" weight="700">
                      +
                    </Txt>
                  </Pressable>
                </View>
              </View>

              {/* Day Adjust */}
              <View style={styles.column}>
                <Txt variant="body" weight="700">
                  Tag
                </Txt>
                <View style={styles.adjustments}>
                  <Pressable
                    onPress={() => setSelDay((d) => (d <= 1 ? 31 : d - 1))}
                    style={styles.adjustButton}>
                    <Txt variant="body" weight="700">
                      -
                    </Txt>
                  </Pressable>
                  <Txt variant="body" weight="700">
                    {String(selDay).padStart(2, '0')}
                  </Txt>
                  <Pressable
                    onPress={() => setSelDay((d) => (d >= 31 ? 1 : d + 1))}
                    style={styles.adjustButton}>
                    <Txt variant="body" weight="700">
                      +
                    </Txt>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.flex}>
                <Button title="Übernehmen" onPress={handleApplyModal} />
              </View>
              <View style={styles.flex}>
                <Button title="Abbrechen" variant="secondary" onPress={() => setShowModal(false)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    root: {
      gap: space.xs,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space.sm,
    },
    flex: {
      flex: 1,
    },
    calendarButton: {
      height: 48,
      paddingHorizontal: space.lg,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundElement,
    },
    formattedDate: {
      marginLeft: space.xs,
      marginTop: -2,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'center',
      padding: 24,
    },
    modalSheet: {
      gap: space.lg,
      padding: 24,
      borderRadius: radius.lg,
      backgroundColor: colors.background,
    },
    dateColumns: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: space.sm,
    },
    column: {
      alignItems: 'center',
      gap: space.sm,
    },
    adjustments: {
      alignItems: 'center',
      gap: 6,
    },
    adjustButton: {
      width: 40,
      height: 40,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundElement,
    },
    footerRow: {
      flexDirection: 'row',
      gap: space.sm,
      marginTop: space.sm,
    },
  });
}
