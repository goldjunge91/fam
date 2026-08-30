import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';

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
  const [isOpen, setIsOpen] = useState(false);
  const pickerDate = fromTime(value);

  return (
    <View className="gap-one">
      {label ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `${label ?? 'Uhrzeit'} ${value} ändern` : `${label ?? 'Uhrzeit'} auswählen`
        }
        className="input-field active:opacity-75">
        <ThemedText>{value || 'Uhrzeit auswählen'}</ThemedText>
      </Pressable>
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
