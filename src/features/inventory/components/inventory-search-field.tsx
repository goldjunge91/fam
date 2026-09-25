import { TextInput } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { SearchIcon } from '@/components/icons/fam-icon';
import { font } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/constants/ui';

import { InventoryIconButton } from './inventory-icon-button';

interface InventorySearchFieldProps {
  onPress?: () => void;
  isOpen?: boolean;
  /** Legacy field props remain supported by the Android screen until its UI pass. */
  value?: string;
  onChangeText?: (value: string) => void;
}

/** Öffnet die Suche als eigene Zeile, damit der Toolbar-Platz für Icons frei bleibt. */
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
      <SearchIcon size={22} color={isOpen ? colors.text : colors.textSecondary} />
    </InventoryIconButton>
  );
}

interface InventorySearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
}

const styles = StyleSheet.create((theme) => ({
  inputCard: {
    marginTop: 10,
    minHeight: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 11,
  },
  input: {
    flex: 1,
    padding: 0,
    color: theme.text,
    fontSize: font.sizes.sm,
    lineHeight: font.lineHeights.label,
  },
}));

/** Sichtbares Eingabefeld der aufgeklappten Artikelsuche. */
export function InventorySearchInput({ value, onChangeText }: InventorySearchInputProps) {
  const { colors } = useTheme();

  return (
    <Card padded={false} style={styles.inputCard}>
      <SearchIcon size={20} color={colors.textSecondary} />
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChangeText}
        placeholder="Artikel suchen"
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        style={styles.input}
        accessibilityLabel="Artikel suchen"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </Card>
  );
}
