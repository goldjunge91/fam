import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from '@/constants/ui';
import type { CatalogProduct } from '@/features/product-search/types';

import {
  type ShoppingProductSuggestion,
  type ShoppingSuggestionMode,
  useShoppingProductSuggestions,
} from '../hooks/use-shopping-product-suggestions';

type ShoppingProductSuggestionsProps = {
  userId: string | undefined;
  householdId: string;
  mode: ShoppingSuggestionMode;
  selectedName: string;
  onSelect: (product: CatalogProduct, suggestion: ShoppingProductSuggestion) => void;
};

/** Anzahl Karten in der ersten, immer sichtbaren Reihe. */
const COLLAPSED_COUNT = 3;

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

function toProduct(suggestion: ShoppingProductSuggestion): CatalogProduct {
  return {
    productId: suggestion.product_id ?? undefined,
    barcode: suggestion.barcode ?? '',
    name: suggestion.name,
    brand: suggestion.brand ?? undefined,
    quantity: suggestion.quantity ?? 1,
    unit: suggestion.unit ?? 'piece',
    // Vorschlagsverlauf (#79) fuehrt keine OFF-Tags mit.
    categoryTags: [],
  };
}

function SuggestionCard({
  suggestion,
  selected,
  onPress,
}: {
  suggestion: ShoppingProductSuggestion;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${suggestion.name}, ${formatPackageSize(
        suggestion.quantity,
        suggestion.unit,
      )}`}
      className={`suggestion-card ${selected ? 'selectable-selected' : 'selectable-idle'}`}>
      <Txt variant="label" weight="700" numberOfLines={1}>
        {suggestion.name}
      </Txt>
      <Txt variant="caption" tone="secondary">
        {formatPackageSize(suggestion.quantity, suggestion.unit)}
      </Txt>
      <Txt variant="caption" tone="secondary" numberOfLines={1}>
        {suggestion.last_store_name ? `Zuletzt: ${suggestion.last_store_name}` : 'Ohne Markt'}
      </Txt>
    </Pressable>
  );
}

export function ShoppingProductSuggestions({
  userId,
  householdId,
  mode,
  selectedName,
  onSelect,
}: ShoppingProductSuggestionsProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: suggestions = [] } = useShoppingProductSuggestions({ userId, householdId, mode });

  if (suggestions.length === 0) return null;

  const firstRow = suggestions.slice(0, COLLAPSED_COUNT);
  const rest = suggestions.slice(COLLAPSED_COUNT);
  const isSelected = (suggestion: ShoppingProductSuggestion) =>
    selectedName.trim().toLowerCase() === suggestion.name.toLowerCase();

  return (
    <View className="gap-two">
      <View className="input-row">
        {firstRow.map((suggestion) => (
          <SuggestionCard
            key={suggestion.name.toLowerCase()}
            suggestion={suggestion}
            selected={isSelected(suggestion)}
            onPress={() => onSelect(toProduct(suggestion), suggestion)}
          />
        ))}
      </View>

      {rest.length > 0 ? (
        <>
          {expanded ? (
            <View className="flex-row flex-wrap gap-two">
              {rest.map((suggestion) => (
                <View key={suggestion.name.toLowerCase()} className="w-[31.5%]">
                  <SuggestionCard
                    suggestion={suggestion}
                    selected={isSelected(suggestion)}
                    onPress={() => onSelect(toProduct(suggestion), suggestion)}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => setExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={
              expanded ? 'Weniger Vorschläge anzeigen' : 'Weitere Vorschläge anzeigen'
            }
            className="details-summary">
            <Txt variant="body" tone="secondary" weight="500">
              {expanded ? '▾' : '›'}
            </Txt>
            <Txt variant="body" tone="primary" weight="500">
              {expanded ? 'Weniger anzeigen' : `${rest.length} weitere anzeigen`}
            </Txt>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
