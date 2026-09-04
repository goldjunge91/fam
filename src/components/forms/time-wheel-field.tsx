import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';

function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function fromTime(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

type TimeWheelFieldProps = {
  label?: string;
  value: string;
  onChange: (time: string) => void;
};

export function TimeWheelField({ label, value, onChange }: TimeWheelFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingTime, setPendingTime] = useState(() => fromTime(value));

  function open() {
    setPendingTime(fromTime(value));
    setIsOpen(true);
  }

  function confirm() {
    onChange(toTime(pendingTime));
    setIsOpen(false);
  }

  return (
    <View className="gap-one">
      {label ? (
        <Txt variant="caption" tone="secondary">
          {label}
        </Txt>
      ) : null}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `${label ?? 'Uhrzeit'} ${value} ändern` : `${label ?? 'Uhrzeit'} auswählen`
        }
        className="input-field active:opacity-75">
        <Txt variant="body">{value || 'Uhrzeit auswählen'}</Txt>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View className="modal-backdrop">
          <View className="modal-sheet">
            <Txt variant="title" weight="600">
              {label ?? 'Uhrzeit auswählen'}
            </Txt>
            <DateTimePicker
              value={pendingTime}
              mode="time"
              display="spinner"
              onValueChange={(_event, date) => setPendingTime(date)}
            />
            <View className="flex-row gap-two mt-two">
              <View className="flex-1">
                <Button label="Übernehmen" onPress={confirm} />
              </View>
              <View className="flex-1">
                <Button label="Abbrechen" variant="secondary" onPress={() => setIsOpen(false)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
