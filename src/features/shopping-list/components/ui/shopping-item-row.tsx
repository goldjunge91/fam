import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { useThemedStyles } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { formatEuro } from '@/lib/format-currency';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import type { LocalShoppingItem } from '../../hooks/use-shopping-list';
import { makeShoppingListStyles } from './shopping-list-styles';

interface ShoppingItemRowProps {
  item: LocalShoppingItem;
  onDelete: () => void;
  onEdit: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  showPrice?: boolean;
}

export const ShoppingItemRow = memo(function ShoppingItemRow({
  item,
  onDelete,
  onEdit,
  selectionMode = false,
  selected = false,
  onSelect,
  showPrice = false,
}: ShoppingItemRowProps) {
  const styles = useThemedStyles(makeShoppingListStyles);
  const isChecked = item.checked_at !== null;
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <View style={styles.itemRow}>
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
        style={styles.itemMain}>
        {selectionMode ? (
          <View
            style={[
              styles.checkbox,
              selected ? styles.checkboxSelected : styles.checkboxUnselected,
            ]}
            accessibilityElementsHidden>
            {selected ? (
              <Txt tone="onAccent" weight="700">
                ✓
              </Txt>
            ) : null}
          </View>
        ) : null}
        <View style={styles.details}>
          <View style={styles.columns}>
            <Txt
              variant="body"
              weight="500"
              style={[styles.name, isChecked && styles.checkedName]}
              numberOfLines={1}>
              {item.name}
            </Txt>
            <View style={styles.trailingMeta}>
              <Txt
                variant="body"
                tone="primary"
                weight="600"
                style={styles.quantity}
                numberOfLines={1}>
                {formatAmount(item.quantity, item.unit)}
              </Txt>
              {showPrice && item.price_estimate != null ? (
                <Txt variant="caption" tone="secondary" style={styles.price} numberOfLines={1}>
                  {formatEuro(item.price_estimate)}
                </Txt>
              ) : null}
            </View>
          </View>
          {packageHint ? (
            <Txt variant="body" tone="secondary" numberOfLines={1}>
              {packageHint}
            </Txt>
          ) : null}
          {item.recipe_names.length > 0 ? (
            <Txt variant="body" tone="secondary" numberOfLines={1} style={styles.recipeHint}>
              🍽️ {item.recipe_names.join(', ')}
            </Txt>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});
