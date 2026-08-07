import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type OpenFoodFactsProduct, searchOpenFoodFacts } from '@/lib/open-food-facts';

interface ProductSearchDropdownProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelectProduct: (product: OpenFoodFactsProduct) => void;
}

export function ProductSearchDropdown({
  label = 'Name',
  placeholder = 'z. B. Hafermilch',
  value,
  onChangeText,
  onSelectProduct,
}: ProductSearchDropdownProps) {
  const theme = useTheme();
  const [suggestions, setSuggestions] = useState<OpenFoodFactsProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await searchOpenFoodFacts(value);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  return (
    <View style={styles.container}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowDropdown(true);
        }}
      />

      {searching && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      )}

      {showDropdown && suggestions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}>
          {suggestions.map((item) => (
            <Pressable
              key={item.barcode || item.name}
              onPress={() => {
                onSelectProduct(item);
                setShowDropdown(false);
              }}
              style={[styles.itemRow, { borderBottomColor: theme.border }]}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.img} />
              ) : (
                <View style={[styles.imgPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={{ fontSize: 14 }}>🥫</ThemedText>
                </View>
              )}

              <View style={styles.itemText}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {item.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.brand ? `${item.brand} · ` : ''}
                  {item.quantity} {item.unit}
                  {item.caloriesPer100g ? ` · ${item.caloriesPer100g} kcal/100g` : ''}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  loader: {
    position: 'absolute',
    right: 12,
    top: 36,
  },
  dropdown: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    maxHeight: 220,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  img: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  imgPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
});
