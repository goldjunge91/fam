import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useThemedStyles } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import type { CatalogProduct } from '@/features/product-search/types';
import { makeShoppingListStyles } from '../components/ui/shopping-list-styles';
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
const PRODUCT_SUGGESTION_UNITS = ['piece', 'g', 'kg', 'ml', 'l', 'package', 'portion'] as const;
type ProductSuggestionUnit = (typeof PRODUCT_SUGGESTION_UNITS)[number];

const styles = StyleSheet.create((theme) => ({
  suggestions: {
    gap: theme.space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 75,
    justifyContent: 'center',
    padding: theme.space.sm,
  },
  cardContainer: {
    flex: 1,
    minWidth: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  gridItem: {
    width: '31.5%',
  },
}));

function isProductSuggestionUnit(value: string): value is ProductSuggestionUnit {
  return PRODUCT_SUGGESTION_UNITS.some((candidate) => candidate === value);
}

function unitLabel(unit: string | null, t: TFunction): string {
  const key = unit && isProductSuggestionUnit(unit) ? unit : 'piece';
  return t(`shoppingList.productSuggestions.units.${key}`);
}

export function formatPackageSize(
  quantity: number | null,
  unit: string | null,
  t: TFunction,
): string {
  const amount = quantity ?? 1;
  const label = unitLabel(unit, t);
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
  const { t } = useTranslation();
  const size = formatPackageSize(suggestion.quantity, suggestion.unit, t);

  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t('shoppingList.productSuggestions.cardAccessibility', {
        name: suggestion.name,
        size,
      })}
      haptic="selection"
      selected={selected}
      containerStyle={styles.cardContainer}
      style={styles.card}>
      <Txt variant="label" weight="700" numberOfLines={1}>
        {suggestion.name}
      </Txt>
      <Txt variant="caption" tone="primary">
        {size}
      </Txt>
      <Txt variant="caption" tone="primary" numberOfLines={1}>
        {suggestion.last_store_name
          ? t('shoppingList.productSuggestions.lastStore', { store: suggestion.last_store_name })
          : t('shoppingList.productSuggestions.noStore')}
      </Txt>
    </Press>
  );
}

export function ShoppingProductSuggestions({
  userId,
  householdId,
  mode,
  selectedName,
  onSelect,
}: ShoppingProductSuggestionsProps) {
  const { t } = useTranslation();
  const shoppingStyles = useThemedStyles(makeShoppingListStyles);
  const [expanded, setExpanded] = useState(false);
  const { data: suggestions = [] } = useShoppingProductSuggestions({ userId, householdId, mode });

  if (suggestions.length === 0) return null;

  const firstRow = suggestions.slice(0, COLLAPSED_COUNT);
  const rest = suggestions.slice(COLLAPSED_COUNT);
  const isSelected = (suggestion: ShoppingProductSuggestion) =>
    selectedName.trim().toLowerCase() === suggestion.name.toLowerCase();

  return (
    <View style={styles.suggestions}>
      <View style={styles.row}>
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
            <View style={styles.grid}>
              {rest.map((suggestion) => (
                <View key={suggestion.name.toLowerCase()} style={styles.gridItem}>
                  <SuggestionCard
                    suggestion={suggestion}
                    selected={isSelected(suggestion)}
                    onPress={() => onSelect(toProduct(suggestion), suggestion)}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <Press
            onPress={() => setExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={
              expanded
                ? t('shoppingList.productSuggestions.showLessAccessibility')
                : t('shoppingList.productSuggestions.showMoreAccessibility')
            }
            style={shoppingStyles.detailsSummary}>
            <Txt variant="body" tone="secondary" weight="500">
              {expanded ? '▾' : '›'}
            </Txt>
            <Txt variant="body" tone="primary" weight="500">
              {expanded
                ? t('shoppingList.productSuggestions.showLess')
                : t('shoppingList.productSuggestions.showMore', { count: rest.length })}
            </Txt>
          </Press>
        </>
      ) : null}
    </View>
  );
}
