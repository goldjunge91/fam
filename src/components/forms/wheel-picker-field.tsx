import { Picker } from '@expo/ui/community/picker';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '../ui/buttons';

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
 * iOS-Auswahlfeld aus einer festen Optionsliste — zeigt nur den aktuellen Wert,
 * das Rad erscheint erst beim Antippen. Auf iOS ist das SwiftUI-Wheel sonst
 * dauerhaft ausgeklappt sichtbar, deshalb hier in ein eigenes Modal mit
 * Übernehmen/Abbrechen verpackt.
 * Für Android existiert eine .android.tsx mit nativer Dropdown-Logik.
 */
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
    <View className="gap-one">
      {label && (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          className={size === 'large' ? 'text-body' : ''}>
          {label}
        </ThemedText>
      )}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} ${selectedLabel} ändern` : `${selectedLabel} ändern`}
        className="input-field active:opacity-75">
        <ThemedText themeColor="text" className={size === 'large' ? 'text-body-lg' : ''}>
          {selectedLabel}
        </ThemedText>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cancel}>
        <View className="modal-backdrop">
          <View className="modal-sheet">
            {label && <ThemedText type="subtitle">{label}</ThemedText>}
            <Picker selectedValue={pendingValue} onValueChange={setPendingValue}>
              {options.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
            <View className="flex-row gap-two mt-two">
              <View className="flex-1">
                <Button label="Übernehmen" onPress={confirm} />
              </View>
              <View className="flex-1">
                <Button label="Abbrechen" variant="secondary" onPress={cancel} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
