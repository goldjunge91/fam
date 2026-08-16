import { Pressable, StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText, Typography } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

import {
  type ShoppingProductSuggestion,
  type ShoppingSuggestionMode,
  useShoppingProductSuggestions,
} from '../use-shopping-product-suggestions';

type ShoppingProductSuggestionsProps = {
  userId: string | undefined;
  householdId: string;
  mode: ShoppingSuggestionMode;
  onModeChange: (mode: ShoppingSuggestionMode) => void;
  selectedName: string;
  onSelect: (product: OpenFoodFactsProduct, suggestion: ShoppingProductSuggestion) => void;
};

function unitLabel(unit: string | null): string {
  const labels: Record<string, string> = {
    piece: 'Stück',
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'L',
    package: 'Packung',
    portion: 'Portion',
  };
  return unit ? (labels[unit] ?? unit) : labels.piece;
}

export function formatPackageSize(quantity: number | null, unit: string | null): string {
  const amount = quantity ?? 1;
  const label = unitLabel(unit);
  return `${amount.toLocaleString('de-DE')} ${label}`;
}

function toProduct(suggestion: ShoppingProductSuggestion): OpenFoodFactsProduct {
  return {
    barcode: suggestion.barcode ?? '',
    name: suggestion.name,
    brand: suggestion.brand ?? undefined,
    quantity: suggestion.quantity ?? 1,
    unit: suggestion.unit ?? 'piece',
  };
}

export function ShoppingProductSuggestions({
  userId,
  householdId,
  mode,
  onModeChange,
  selectedName,
  onSelect,
}: ShoppingProductSuggestionsProps) {
  const theme = useTheme();
  const { data: suggestions = [] } = useShoppingProductSuggestions({ userId, householdId, mode });

  return (
    <View style={styles.root}>
      <SegmentedControl
        label="Produktvorschläge"
        options={[
          { value: 'recent', label: 'Zuletzt' },
          { value: 'frequent', label: 'Häufig' },
        ]}
        selected={mode}
        onSelect={onModeChange}
        appearance="surface"
        size="compact"
        gap={3}
        labelStyle={styles.tabLabel}
      />

      {suggestions.length > 0 ? (
        <View style={styles.cards}>
          {suggestions.map((suggestion) => {
            const selected = selectedName.trim().toLowerCase() === suggestion.name.toLowerCase();
            return (
              <Pressable
                key={suggestion.name.toLowerCase()}
                onPress={() => onSelect(toProduct(suggestion), suggestion)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${suggestion.name}, ${formatPackageSize(
                  suggestion.quantity,
                  suggestion.unit,
                )}`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: selected ? `${theme.accent}0D` : theme.backgroundElement,
                    borderColor: selected ? theme.accent : theme.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="label" numberOfLines={1} style={styles.name}>
                  {suggestion.name}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.meta}>
                  {formatPackageSize(suggestion.quantity, suggestion.unit)}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={[styles.store, { color: theme.accent }]}
                  numberOfLines={1}>
                  {suggestion.last_store_name
                    ? `Zuletzt: ${suggestion.last_store_name}`
                    : 'Ohne Liste'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  cards: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 75,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    padding: Spacing.two,
  },
  name: {
    fontWeight: 700,
  },
  meta: {
    fontWeight: 500,
  },
  store: {
    fontWeight: 500,
  },
  tabLabel: {
    ...Typography.label,
  },
  pressed: {
    opacity: 0.72,
  },
});
