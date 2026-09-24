import { Picker } from '@expo/ui/community/picker';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { space } from '@/components/theme/index';
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
  accessibilityLabel?: string;
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
  accessibilityLabel,
}: WheelPickerFieldProps) {
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={styles.root}>
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

const styles = StyleSheet.create({
  root: {
    gap: space.xs,
  },
});
