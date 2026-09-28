import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Press, Txt } from '@/constants/ui';
import { fromTime, toTime } from '@/lib/format/format-date';

export interface TimeWheelFieldProps {
  label?: string;
  value: string;
  onChange: (time: string) => void;
}

export function TimeWheelField({ label, value, onChange }: TimeWheelFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerDate = fromTime(value);

  return (
    <View style={styles.root}>
      {label ? (
        <Txt variant="caption" tone="secondary">
          {label}
        </Txt>
      ) : null}
      <Press
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `${label ?? 'Uhrzeit'} ${value} ändern` : `${label ?? 'Uhrzeit'} auswählen`
        }
        haptic="selection"
        style={styles.inputField}>
        <Txt variant="body">{value || 'Uhrzeit auswählen'}</Txt>
      </Press>
      {isOpen ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="spinner"
          presentation="dialog"
          onValueChange={(_event, date) => {
            onChange(toTime(date));
            setIsOpen(false);
          }}
          onDismiss={() => setIsOpen(false)}
        />
      ) : null}
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
