import { Picker } from '@expo/ui/community/picker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText, Typography } from '@/components/themed-text';

import { Radius, Spacing } from '@/constants/theme';

import { useTheme } from '@/hooks/use-theme';
import { Button } from './ui/buttons';

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

/**
 * Auswahlfeld aus einer festen Optionsliste — zeigt nur den aktuellen Wert,
 * das Rad erscheint erst beim Antippen. Auf iOS ist die SwiftUI-Wheel sonst
 * dauerhaft ausgeklappt sichtbar, deshalb hier in ein eigenes Modal mit
 * Übernehmen/Abbrechen verpackt. Android zeigt `@expo/ui/community/picker`
 * bereits nativ als Dropdown (Material 3 `ExposedDropdownMenuBox`), das erst
 * beim Antippen aufklappt — dort reicht die Komponente direkt.
 */
export function WheelPickerField({
  label,
  value,
  options,
  onChange,
  size = 'default',
}: WheelPickerFieldProps) {
  const theme = useTheme();
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

  if (Platform.OS === 'android') {
    return (
      <View style={styles.container}>
        {label && (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={size === 'large' && styles.largeLabel}>
            {label}
          </ThemedText>
        )}
        <Picker selectedValue={value} onValueChange={onChange}>
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {label && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={size === 'large' && styles.largeLabel}>
          {label}
        </ThemedText>
      )}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} ${selectedLabel} ändern` : `${selectedLabel} ändern`}
        style={[
          styles.field,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <ThemedText style={[{ color: theme.text }, size === 'large' && styles.largeSelectedLabel]}>
          {selectedLabel}
        </ThemedText>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cancel}>
        <View style={styles.backdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
            {label && <ThemedText type="subtitle">{label}</ThemedText>}
            <Picker selectedValue={pendingValue} onValueChange={setPendingValue}>
              {options.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
            <View style={styles.modalActions}>
              <View style={styles.flex}>
                <Button label="Übernehmen" onPress={confirm} />
              </View>
              <View style={styles.flex}>
                <Button label="Abbrechen" variant="secondary" onPress={cancel} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  field: {
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  largeLabel: {
    ...Typography.body,
  },
  largeSelectedLabel: {
    ...Typography.bodyLarge,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalBox: {
    borderRadius: Radius.sheet,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
