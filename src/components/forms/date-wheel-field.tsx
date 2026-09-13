import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { type Palette, radius, space } from '@/components/theme/index';
import { useThemedStyles } from '@/components/theme/ThemeProvider';
import { Button, Txt } from '@/constants/ui';

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

export function DateWheelField({
  label,
  value,
  onChange,
  placeholder = 'TT.MM.JJJJ',
}: DateWheelFieldProps) {
  const styles = useThemedStyles(makeStyles);
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
    <View style={styles.root}>
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
        style={({ pressed }) => [styles.inputField, pressed && styles.pressed]}>
        <Txt variant="body" tone={value ? 'primary' : 'secondary'}>
          {value ? formatIsoDate(value) : placeholder}
        </Txt>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Txt variant="heading" weight="700">
              {label ?? 'Datum auswählen'}
            </Txt>
            <DateTimePicker
              value={pendingDate}
              mode="date"
              display="spinner"
              onValueChange={(_event, date) => setPendingDate(date)}
            />
            <View style={styles.footerRow}>
              <View style={styles.flex}>
                <Button title="Übernehmen" onPress={confirm} />
              </View>
              <View style={styles.flex}>
                <Button title="Abbrechen" variant="secondary" onPress={cancel} />
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
