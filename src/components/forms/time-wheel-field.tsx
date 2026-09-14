import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Modal, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { Button, Press, Txt } from '@/constants/ui';

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
    <View style={styles.root}>
      {label ? (
        <Txt variant="caption" tone="secondary">
          {label}
        </Txt>
      ) : null}
      <Press
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `${label ?? 'Uhrzeit'} ${value} ändern` : `${label ?? 'Uhrzeit'} auswählen`
        }
        haptic="selection"
        style={styles.inputField}>
        <Txt variant="body">{value || 'Uhrzeit auswählen'}</Txt>
      </Press>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Txt variant="title" weight="600">
              {label ?? 'Uhrzeit auswählen'}
            </Txt>
            <DateTimePicker
              value={pendingTime}
              mode="time"
              display="spinner"
              onValueChange={(_event, date) => setPendingTime(date)}
            />
            <View style={styles.footerRow}>
              <View style={styles.flex}>
                <Button title="Übernehmen" onPress={confirm} />
              </View>
              <View style={styles.flex}>
                <Button title="Abbrechen" variant="secondary" onPress={() => setIsOpen(false)} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: space.xs,
  },
  inputField: {
    width: '100%',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    backgroundColor: theme.backgroundElement,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.scrim,
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    gap: space.lg,
    padding: 24,
    borderRadius: radius.lg,
    backgroundColor: theme.background,
  },
  footerRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  flex: {
    flex: 1,
  },
}));
