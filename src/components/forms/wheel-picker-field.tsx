import { Picker } from '@expo/ui/community/picker';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Txt } from '@/constants/ui';
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
        <Txt variant="body" tone="secondary" className={size === 'large' ? 'text-body' : ''}>
          {label}
        </Txt>
      )}
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} ${selectedLabel} ändern` : `${selectedLabel} ändern`}
        className="input-field active:opacity-75">
        <Txt variant="body" tone="primary" className={size === 'large' ? 'text-body-lg' : ''}>
          {selectedLabel}
        </Txt>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={cancel}>
        <View className="modal-backdrop">
          <View className="modal-sheet">
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
