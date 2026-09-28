import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Press, Txt } from '@/constants/ui';
import { formatIsoDate, toIsoDate } from '@/lib/format/format-date';

export interface DateWheelFieldProps {
  label?: string;
  /** ISO-Datum "YYYY-MM-DD", oder '' wenn noch keines gewählt wurde. */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
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
    <View style={styles.root}>
      {label && (
        <Txt variant="body" tone="secondary">
          {label}
        </Txt>
      )}
      <Press
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          value
            ? `${label ?? 'Datum'} ${formatIsoDate(value)} ändern`
            : `${label ?? 'Datum'} auswählen`
        }
        style={styles.inputField}>
        <Txt variant="body" tone={value ? 'primary' : 'secondary'}>
          {value ? formatIsoDate(value) : placeholder}
        </Txt>
      </Press>

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

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.xs,
  },
  inputField: {
    width: '100%',
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    backgroundColor: theme.backgroundElement,
  },
}));
