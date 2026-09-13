import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { type Palette, radius, space } from '@/components/theme/index';
import { useThemedStyles } from '@/components/theme/ThemeProvider';
import { Button, Txt } from '@/constants/ui';

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
  const styles = useThemedStyles(makeStyles);
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
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          value ? `${label ?? 'Uhrzeit'} ${value} ändern` : `${label ?? 'Uhrzeit'} auswählen`
        }
        style={({ pressed }) => [styles.inputField, pressed && styles.pressed]}>
        <Txt variant="body">{value || 'Uhrzeit auswählen'}</Txt>
      </Pressable>

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
    pressed: {
      opacity: 0.75,
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
    footerRow: {
      flexDirection: 'row',
      gap: space.sm,
      marginTop: space.sm,
    },
    flex: {
      flex: 1,
    },
  });
}
