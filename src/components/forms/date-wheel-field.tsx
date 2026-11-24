import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Txt } from '@/constants/ui';
import { formatIsoDate, toIsoDate } from '@/lib/format/format-date';

interface DateWheelFieldProps {
  label?: string;
  /** ISO-Datum "YYYY-MM-DD", oder '' wenn noch keines gewählt wurde. */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
}

export function DateWheelField({ label, value, onChange, placeholder }: DateWheelFieldProps) {
  const { i18n, t } = useTranslation();
  const { mode } = useTheme();
  const accessibilityTargetLabel = label ?? t('common.datePicker.defaultLabel');
  const displayLabel = label ?? t('common.datePicker.heading');
  const accessibilityLabel = t('common.datePicker.choose', {
    label: accessibilityTargetLabel,
  });
  const displayPlaceholder = placeholder ?? t('common.datePicker.wheelPlaceholder');
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
          {displayLabel}
        </Txt>
      )}
      <Press
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          value
            ? t('common.datePicker.change', {
                label: accessibilityTargetLabel,
                value: formatIsoDate(value, i18n.language),
              })
            : accessibilityLabel
        }
        haptic="selection"
        scaleTo={0.98}
        containerStyle={styles.inputPressContainer}
        style={styles.inputField}>
        <Txt variant="body" tone={value ? 'primary' : 'secondary'}>
          {value ? formatIsoDate(value, i18n.language) : displayPlaceholder}
        </Txt>
      </Press>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Txt variant="heading" weight="700">
              {displayLabel}
            </Txt>
            <DateTimePicker
              value={pendingDate}
              mode="date"
              display="spinner"
              themeVariant={mode}
              onValueChange={(_event, date) => setPendingDate(date)}
            />
            <View style={styles.footerRow}>
              <View style={styles.flex}>
                <Button title={t('common.actions.apply')} onPress={confirm} />
              </View>
              <View style={styles.flex}>
                <Button title={t('common.actions.cancel')} variant="secondary" onPress={cancel} />
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
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: theme.backgroundElement,
  },
  inputPressContainer: {
    width: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.scrim,
    justifyContent: 'center',
    padding: space.xxl,
  },
  modalSheet: {
    gap: space.lg,
    padding: space.xxl,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
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
