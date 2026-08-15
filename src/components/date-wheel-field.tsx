import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

interface DateWheelFieldProps {
  label?: string;
  /** ISO-Datum "YYYY-MM-DD", oder '' wenn noch keines gewählt wurde. */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
}

/**
 * Datumsfeld ohne Texteingabe — öffnet ein natives Rad (iOS: SwiftUI-Wheel im
 * eigenen Modal mit Übernehmen/Abbrechen; Android: Material-Dialog, da Material 3
 * kein Wheel kennt). Verhindert ungültige Datumsangaben, weil nur der Picker
 * gültige Daten liefern kann — anders als ein Freitextfeld.
 */
export function DateWheelField({
  label,
  value,
  onChange,
  placeholder = 'TT.MM.JJJJ',
}: DateWheelFieldProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState(() => (value ? new Date(value) : new Date()));

  function open() {
    setPendingDate(value ? new Date(value) : new Date());
    setIsOpen(true);
  }

  function confirm() {
    onChange(toIsoDate(pendingDate));
    setIsOpen(false);
  }

  function cancel() {
    setIsOpen(false);
  }

  return (
    <View style={styles.container}>
      {label && (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      )}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          value
            ? `${label ?? 'Datum'} ${formatIsoDate(value)} ändern`
            : `${label ?? 'Datum'} auswählen`
        }
        style={[
          styles.field,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <ThemedText style={{ color: value ? theme.text : theme.textSecondary }}>
          {value ? formatIsoDate(value) : placeholder}
        </ThemedText>
      </Pressable>

      {Platform.OS === 'android' && isOpen && (
        <DateTimePicker
          value={pendingDate}
          mode="date"
          display="spinner"
          presentation="dialog"
          onValueChange={(_event, date) => {
            onChange(toIsoDate(date));
            setIsOpen(false);
          }}
          onDismiss={cancel}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cancel}>
          <View style={styles.backdrop}>
            <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
              <ThemedText type="subtitle">{label ?? 'Datum auswählen'}</ThemedText>
              <DateTimePicker
                value={pendingDate}
                mode="date"
                display="spinner"
                onValueChange={(_event, date) => setPendingDate(date)}
              />
              <View style={styles.modalActions}>
                <View style={styles.flex}>
                  <Button label="Übernehmen" onPress={confirm} />
                </View>
                <View style={styles.flex}>
                  <Button label="Abbrechen" variant="secondary" onPress={cancel} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  field: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
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
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
