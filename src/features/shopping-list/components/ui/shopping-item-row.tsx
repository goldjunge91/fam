import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { formatEuro } from '@/lib/format-currency';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import type { LocalShoppingItem } from '../../hooks/use-shopping-list';

interface ShoppingItemRowProps {
  item: LocalShoppingItem;
  onDelete: () => void;
  onEdit: () => void;
}

export const ShoppingItemRow = memo(function ShoppingItemRow({
  item,
  onDelete,
  onEdit,
}: ShoppingItemRowProps) {
  const isChecked = item.checked_at !== null;
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <View className="shopping-item-row">
      <Pressable
        onPress={onEdit}
        onLongPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} bearbeiten`}
        accessibilityHint="Antippen zum Bearbeiten, lang drücken zum Löschen"
        className="shopping-item-main">
        <View className="flex-1 gap-[2px]">
          {/* Produkt · Menge · Preis als drei Spalten (Mockup
              docs/mockups/einkaufsmodus/), nicht Menge+Preis gestapelt. */}
          <View className="flex-row items-baseline gap-two">
            <ThemedText
              type="small"
              className={`flex-1 ${isChecked ? 'line-through opacity-50' : ''}`}
              numberOfLines={1}>
              {item.name}
            </ThemedText>
            <ThemedText type="smallMuted" className="w-[84px] text-right" numberOfLines={1}>
              {formatAmount(item.quantity, item.unit)}
            </ThemedText>
            <ThemedText type="captionMuted" className="w-[52px] text-right" numberOfLines={1}>
              {item.price_estimate != null ? formatEuro(item.price_estimate) : ''}
            </ThemedText>
          </View>
          {packageHint ? (
            <ThemedText type="smallMuted" numberOfLines={1}>
              {packageHint}
            </ThemedText>
          ) : null}
          {item.recipe_names.length > 0 ? (
            <ThemedText type="smallMuted" numberOfLines={1} className="opacity-75">
              🍽️ {item.recipe_names.join(', ')}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});
