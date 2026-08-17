import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import type { LocalShoppingItem } from '../use-shopping-list';

interface ShoppingItemRowProps {
  item: LocalShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function ShoppingItemRow({ item, onToggle, onDelete, onEdit }: ShoppingItemRowProps) {
  const isChecked = item.checked_at !== null;
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <View className="shopping-item-row">
      <Pressable
        onPress={onToggle}
        onLongPress={onDelete}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked }}
        accessibilityLabel={item.name}
        accessibilityHint="Antippen zum Abhaken, lang drücken zum Löschen"
        className="shopping-item-main">
        {/* Checkbox */}
        <View className={`checkbox-base ${isChecked ? 'checkbox-checked' : 'checkbox-unchecked'}`}>
          {isChecked ? (
            <ThemedText type="detail" themeColor="onAccent">
              ✓
            </ThemedText>
          ) : null}
        </View>

        <View className="flex-1 gap-[2px]">
          <View className="row-between">
            <ThemedText type="small" className={isChecked ? 'line-through opacity-50' : ''}>
              {item.name}
            </ThemedText>
            <ThemedText type="smallMuted">{formatAmount(item.quantity, item.unit)}</ThemedText>
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

      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} bearbeiten`}
        hitSlop={8}
        className="p-one">
        <ThemedText type="controlValue" className="opacity-60">
          ✏️
        </ThemedText>
      </Pressable>
    </View>
  );
}
