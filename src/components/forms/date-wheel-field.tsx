import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';

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
 * iOS-Datumsfeld ohne Texteingabe — öffnet ein natives Rad (iOS: SwiftUI-Wheel im
 * eigenen Modal mit Übernehmen/Abbrechen). Verhindert ungültige Datumsangaben,
 * weil nur der Picker gültige Daten liefern kann — anders als ein Freitextfeld.
 * Für Android existiert eine .android.tsx Variante mit dem Material-Dialog.
 */
export function DateWheelField({
  label,
  value,
  onChange,
  placeholder = 'TT.MM.JJJJ',
}: DateWheelFieldProps) {
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
    <View className="gap-one">
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
        className="input-field active:opacity-75">
        <ThemedText themeColor={value ? 'text' : 'textSecondary'}>
          {value ? formatIsoDate(value) : placeholder}
        </ThemedText>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cancel}>
        <View className="modal-backdrop">
          <View className="modal-sheet">
            <ThemedText type="subtitle">{label ?? 'Datum auswählen'}</ThemedText>
            <DateTimePicker
              value={pendingDate}
              mode="date"
              display="spinner"
              onValueChange={(_event, date) => setPendingDate(date)}
            />
            <View className="flex-row gap-two mt-two">
              <View className="flex-1">
                <Button label="Übernehmen" onPress={confirm} />
              </View>
              <View className="flex-1">
                <Button label="Abbrechen" variant="secondary" onPress={cancel} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
