import { Picker } from '@expo/ui/community/picker';
import { useState } from 'react';
import { Modal, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { font, radius, space } from '@/components/theme/index';
import { Button, Press, Txt } from '@/constants/ui';

export type WheelPickerOption = {
  value: string;
  label: string;
};

interface WheelPickerFieldProps {
  label?: string;
  value: string;
  options: readonly WheelPickerOption[];
  onChange: (value: string) => void;
  size?: 'default' | 'large';
}

export function WheelPickerField({
  label,
  value,
  options,
  onChange,
  size = 'default',
}: WheelPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState(value);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  function open() {
    setPendingValue(value);
    setIsOpen(true);
  }

  function confirm() {
    onChange(pendingValue);
    setIsOpen(false);
  }

  function cancel() {
    setIsOpen(false);
  }

  return (
    <View style={styles.root}>
      {label && (
        <Txt variant="label" tone="secondary">
          {label}
        </Txt>
      )}
      <Press
        onPress={open}
        haptic="none"
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} ${selectedLabel} ändern` : `${selectedLabel} ändern`}
        containerStyle={styles.pressContainer}
        style={styles.inputField}>
        <Txt variant="body" tone="primary" style={size === 'large' ? styles.largeValue : undefined}>
          {selectedLabel}
        </Txt>
      </Press>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {label && (
              <Txt variant="heading" weight="700">
                {label}
              </Txt>
            )}
            <Picker selectedValue={pendingValue} onValueChange={setPendingValue}>
              {options.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
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

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: space.xs,
  },
  pressContainer: {
    width: '100%',
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
  largeValue: {
    fontSize: font.sizes.md,
    lineHeight: font.lineHeights.subheading,
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
