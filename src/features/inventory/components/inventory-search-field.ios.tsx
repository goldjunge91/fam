import { TextInput } from 'react-native';

import { SearchIcon } from '@/components/icons/fam-icon';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/constants/ui';

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
      <InventorySearchInput value={value ?? ''} onChangeText={onChangeText ?? (() => undefined)} />
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
    <Card elevation="none" padded={false} style={styles.inputCard}>
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
        className="inventory-search-input"
      />
    </Card>
  );
}

const styles = {
  inputCard: {
    marginTop: 10,
    minHeight: 48,
    width: '100%' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
  },
};
