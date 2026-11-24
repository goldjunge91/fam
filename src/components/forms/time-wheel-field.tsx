import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Txt } from '@/constants/ui';
import { fromTime, toTime } from '@/lib/format/format-date';

type TimeWheelFieldProps = {
  label?: string;
  value: string;
  onChange: (time: string) => void;
};

export function TimeWheelField({ label, value, onChange }: TimeWheelFieldProps) {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const displayLabel = label ?? t('common.timePicker.defaultLabel');
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
          {displayLabel}
        </Txt>
      ) : null}
      <Press
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          value
            ? t('common.timePicker.change', { label: displayLabel, value })
            : t('common.timePicker.choose', { label: displayLabel })
        }
        haptic="selection"
        style={styles.inputField}>
        <Txt variant="body">{value || t('common.timePicker.placeholder')}</Txt>
      </Press>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Txt variant="title" weight="600">
              {displayLabel}
            </Txt>
            <DateTimePicker
              value={pendingTime}
              mode="time"
              display="spinner"
              themeVariant={mode}
              onValueChange={(_event, date) => setPendingTime(date)}
            />
            <View style={styles.footerRow}>
              <View style={styles.flex}>
                <Button title={t('common.actions.apply')} onPress={confirm} />
              </View>
              <View style={styles.flex}>
                <Button
                  title={t('common.actions.cancel')}
                  variant="secondary"
                  onPress={() => setIsOpen(false)}
                />
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
