import { Picker } from '@expo/ui/community/picker';
import { View } from 'react-native';

import { Txt } from '@/constants/ui';

export type WheelPickerOption = {
  value: string;
  label: string;
};

export interface WheelPickerFieldProps {
  label?: string;
  value: string;
  options: readonly WheelPickerOption[];
  onChange: (value: string) => void;
  size?: 'default' | 'large';
}

/**
 * Android-Auswahlfeld — nutzt `@expo/ui/community/picker` nativ als Dropdown
 * (Material 3 `ExposedDropdownMenuBox`), das beim Antippen aufklappt.
 */
export function WheelPickerField({ label, value, options, onChange }: WheelPickerFieldProps) {
  return (
    <View className="gap-one">
      {label && (
        <Txt variant="label" tone="secondary">
          {label}
        </Txt>
      )}
      <Picker selectedValue={value} onValueChange={onChange}>
        {options.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
    </View>
  );
}
