import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
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
  const { data: suggestions = [] } = useShoppingProductSuggestions({ userId, householdId, mode });

  return (
    <View className="col-gap">
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
      />

      {suggestions.length > 0 ? (
        <View className="input-row">
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
                className={`suggestion-card ${
                  selected ? 'selectable-selected' : 'selectable-idle'
                }`}>
                <ThemedText type="labelBold" numberOfLines={1}>
                  {suggestion.name}
                </ThemedText>
                <ThemedText type="captionMuted">
                  {formatPackageSize(suggestion.quantity, suggestion.unit)}
                </ThemedText>
                <ThemedText type="caption" themeColor="accent" numberOfLines={1}>
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
