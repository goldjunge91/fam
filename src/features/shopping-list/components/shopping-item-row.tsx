import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText, Typography } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import type { LocalShoppingItem } from '../use-shopping-list';

interface ShoppingItemRowProps {
  item: LocalShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function ShoppingItemRow({ item, onToggle, onDelete, onEdit }: ShoppingItemRowProps) {
  const theme = useTheme();
  const isChecked = item.checked_at !== null;
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <View style={[styles.itemRow, { borderBottomColor: theme.border }]}>
      <Pressable
        onPress={onToggle}
        onLongPress={onDelete}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked }}
        accessibilityLabel={item.name}
        accessibilityHint="Antippen zum Abhaken, lang drücken zum Löschen"
        style={styles.itemMain}>
        {/* Checkbox */}
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isChecked ? theme.accent : theme.border,
              backgroundColor: isChecked ? theme.accent : 'transparent',
            },
          ]}>
          {isChecked ? (
            <ThemedText type="detail" style={[styles.checkmark, { color: '#fff' }]}>
              ✓
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemContentTop}>
            <ThemedText
              type="small"
              style={isChecked ? { textDecorationLine: 'line-through', opacity: 0.5 } : undefined}>
              {item.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatAmount(item.quantity, item.unit)}
            </ThemedText>
          </View>
          {packageHint ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {packageHint}
            </ThemedText>
          ) : null}
          {item.recipe_names.length > 0 ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              style={styles.recipeBadge}>
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
        style={styles.editButton}>
        <ThemedText type="controlValue" style={styles.editIcon}>
          ✏️
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.control,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  itemContentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeBadge: {
    opacity: 0.75,
  },
  editButton: {
    padding: Spacing.one,
  },
  editIcon: {
    ...Typography.controlValue,
    opacity: 0.6,
  },
  checkmark: {
    ...Typography.detail,
  },
});
