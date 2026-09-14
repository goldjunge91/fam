import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { type Palette, radius, space } from '@/components/theme/index';
import { useThemedStyles } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';

function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function fromTime(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

export interface TimeWheelFieldProps {
  label?: string;
  value: string;
  onChange: (time: string) => void;
}

export function TimeWheelField({ label, value, onChange }: TimeWheelFieldProps) {
  const styles = useThemedStyles(makeStyles);
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

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    root: {
      gap: space.xs,
    },
    inputField: {
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: space.lg,
      paddingVertical: 10,
      backgroundColor: colors.backgroundElement,
    },
  });
}
