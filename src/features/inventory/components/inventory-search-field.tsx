import { TextInput, View } from 'react-native';

import { SearchIcon } from '@/components/icons/fam-icon';
import { useTheme } from '@/components/theme/ThemeProvider';

interface InventorySearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
}

/** Kompaktes Suchfeld neben dem Lagerort-Filter, filtert die Vorratsliste nach Artikelname. */
export function InventorySearchField({ value, onChangeText }: InventorySearchFieldProps) {
  const { colors } = useTheme();

  return (
    <View className="inventory-search-field">
      <SearchIcon size={15} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Artikel suchen"
        placeholderTextColor={colors.textMuted}
        className="inventory-search-input"
        accessibilityLabel="Artikel suchen"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}
