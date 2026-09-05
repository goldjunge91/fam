import { GlassView } from 'expo-glass-effect';
import { TextInput, View } from 'react-native';

import { SearchIcon } from '@/components/icons/fam-icon';
import { radius } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useGlassAvailable } from '@/components/ui/glass-card';

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
      <InventorySearchInput
        value={value ?? ''}
        onChangeText={onChangeText ?? (() => undefined)}
      />
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

/** Sichtbares Eingabefeld der aufgeklappten Artikelsuche. */
export function InventorySearchInput({ value, onChangeText }: InventorySearchInputProps) {
  const { colors } = useTheme();
  const canUseGlass = useGlassAvailable();

  const content = (
    <>
      <SearchIcon size={20} color={colors.textSecondary} />
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChangeText}
        placeholder="Artikel suchen"
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        className="inventory-search-input"
        accessibilityLabel="Artikel suchen"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </>
  );

  if (canUseGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        style={{
          width: '100%',
          minHeight: 48,
          marginTop: 10,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 11,
        }}>
        {content}
      </GlassView>
    );
  }

  return <View className="inventory-search-field inventory-search-panel">{content}</View>;
}
