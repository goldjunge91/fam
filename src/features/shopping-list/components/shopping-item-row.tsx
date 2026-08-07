import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { LocalShoppingItem } from '../use-shopping-list';

interface ShoppingItemRowProps {
  item: LocalShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
}

export function ShoppingItemRow({ item, onToggle, onDelete }: ShoppingItemRowProps) {
  const theme = useTheme();
  const isChecked = item.checked_at !== null;

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onDelete}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      accessibilityLabel={item.name}
      accessibilityHint="Antippen zum Abhaken, lang drücken zum Löschen"
      style={[styles.itemRow, { borderBottomColor: theme.border }]}>
      {/* Checkbox */}
      <View
        style={[
          styles.checkbox,
          {
            borderColor: isChecked ? theme.accent : theme.border,
            backgroundColor: isChecked ? theme.accent : 'transparent',
          },
        ]}>
        {isChecked ? <ThemedText style={{ color: '#fff', fontSize: 12 }}>✓</ThemedText> : null}
      </View>

      <View style={styles.itemContent}>
        <ThemedText
          type="small"
          style={isChecked ? { textDecorationLine: 'line-through', opacity: 0.5 } : undefined}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.quantity} {item.unit}
        </ThemedText>
      </View>
    </Pressable>
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
