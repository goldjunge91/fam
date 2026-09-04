import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from '@/constants/ui';

export interface DateWheelFieldProps {
  label?: string;
  /** ISO-Datum "YYYY-MM-DD", oder '' wenn noch keines gewählt wurde. */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
}

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

/**
 * Android-Datumsfeld — öffnet den nativen Material-Dialog (presentation="dialog").
 */
export function DateWheelField({
  label,
  value,
  onChange,
  placeholder = 'TT.MM.JJJJ',
}: DateWheelFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pendingDate = value ? new Date(value) : new Date();

  function open() {
    setIsOpen(true);
  }

  function cancel() {
    setIsOpen(false);
  }

  return (
    <View className="gap-one">
      {label && (
        <Txt variant="body" tone="secondary">
          {label}
        </Txt>
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
        <Txt variant="body" tone={value ? 'primary' : 'secondary'}>
          {value ? formatIsoDate(value) : placeholder}
        </Txt>
      </Pressable>

      {isOpen && (
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
    </View>
  );
}
