import { Picker } from '@expo/ui/community/picker';
import { View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

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
export function WheelPickerField({
  label,
  value,
  options,
  onChange,
  size = 'default',
}: WheelPickerFieldProps) {
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
      <Picker selectedValue={value} onValueChange={onChange}>
        {options.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
    </View>
  );
}
