import { TextInput, View } from 'react-native';

import { SearchIcon } from '@/components/icons/fam-icon';
import { useTheme } from '@/hooks/use-theme';

interface InventorySearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
}

/** Kompaktes Suchfeld neben dem Lagerort-Filter, filtert die Vorratsliste nach Artikelname. */
export function InventorySearchField({ value, onChangeText }: InventorySearchFieldProps) {
  const theme = useTheme();

  return (
    <View className="inventory-search-field">
      <SearchIcon size={15} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Artikel suchen"
        placeholderTextColor={theme.textSecondary}
        className="inventory-search-input"
        accessibilityLabel="Artikel suchen"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );
}
