import { TextInput, View } from 'react-native';

import { SearchIcon } from '@/components/icons/fam-icon';
import { useTheme } from '@/components/theme/ThemeProvider';

import { InventoryIconButton } from './inventory-icon-button';

interface InventorySearchFieldProps {
  onPress?: () => void;
  isOpen?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
}

export function InventorySearchField({
  onPress,
  isOpen = false,
  value,
  onChangeText,
}: InventorySearchFieldProps) {
  const { colors } = useTheme();

  if (!onPress) {
    return (
      <InventorySearchInput
        value={value ?? ''}
        onChangeText={onChangeText ?? (() => undefined)}
      />
    );
  }

  return (
    <InventoryIconButton label="Artikel suchen" onPress={onPress} active={isOpen}>
      <SearchIcon color={colors.text} />
    </InventoryIconButton>
  );
}

interface InventorySearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
}

/** Unstyled iOS baseline. Theme colors only keep the native input legible. */
export function InventorySearchInput({ value, onChangeText }: InventorySearchInputProps) {
  const { colors } = useTheme();

  return (
    <View className="mt-two min-h-[48px] flex-row items-center gap-two">
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChangeText}
        placeholder="Artikel suchen"
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        accessibilityLabel="Artikel suchen"
        returnKeyType="search"
        clearButtonMode="while-editing"
        className="flex-1 p-0"
      />
    </View>
  );
}
