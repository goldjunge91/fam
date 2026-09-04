import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Txt } from '@/constants/ui';
import { formatEuro } from '@/lib/format-currency';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import type { LocalShoppingItem } from '../../hooks/use-shopping-list';

interface ShoppingItemRowProps {
  item: LocalShoppingItem;
  onDelete: () => void;
  onEdit: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export const ShoppingItemRow = memo(function ShoppingItemRow({
  item,
  onDelete,
  onEdit,
  selectionMode = false,
  selected = false,
  onSelect,
}: ShoppingItemRowProps) {
  const isChecked = item.checked_at !== null;
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <View className="shopping-item-row">
      <Pressable
        onPress={selectionMode ? onSelect : onEdit}
        onLongPress={selectionMode ? undefined : onDelete}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} ${selectionMode ? 'auswählen' : 'bearbeiten'}`}
        accessibilityHint={
          selectionMode
            ? 'Antippen zum Auswählen oder Abwählen'
            : 'Antippen zum Bearbeiten, lang drücken zum Löschen'
        }
        accessibilityState={selectionMode ? { selected } : undefined}
        className="shopping-item-main">
        {selectionMode ? (
          <View
            className={`checkbox-base ${selected ? 'checkbox-checked' : 'checkbox-unchecked'}`}
            accessibilityElementsHidden>
            {selected ? (
              <Txt tone="onAccent" weight="700">
                ✓
              </Txt>
            ) : null}
          </View>
        ) : null}
        <View className="flex-1 gap-[2px]">
          {/* Produkt · Menge · Preis als drei Spalten (Mockup
              docs/mockups/einkaufsmodus/), nicht Menge+Preis gestapelt. */}
          <View className="flex-row items-baseline gap-two">
            <Txt
              variant="body"
              className={`flex-1 ${isChecked ? 'line-through opacity-50' : ''}`}
              numberOfLines={1}>
              {item.name}
            </Txt>
            <Txt variant="body" tone="secondary" className="w-[84px] text-right" numberOfLines={1}>
              {formatAmount(item.quantity, item.unit)}
            </Txt>
            <Txt
              variant="caption"
              tone="secondary"
              className="w-[52px] text-right"
              numberOfLines={1}>
              {item.price_estimate != null ? formatEuro(item.price_estimate) : ''}
            </Txt>
          </View>
          {packageHint ? (
            <Txt variant="body" tone="secondary" numberOfLines={1}>
              {packageHint}
            </Txt>
          ) : null}
          {item.recipe_names.length > 0 ? (
            <Txt variant="body" tone="secondary" numberOfLines={1} className="opacity-75">
              🍽️ {item.recipe_names.join(', ')}
            </Txt>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});
