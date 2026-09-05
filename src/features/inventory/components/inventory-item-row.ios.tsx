import { memo } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import type { ExpiryBucket } from '../expiry';
import { groupInventoryItems, type InventoryItemGroup } from '../grouped-items';
import type { LocalInventoryItem } from '../use-inventory-items';

const EXPIRY_COLOR_KEY: Record<ExpiryBucket, 'danger' | 'warning' | 'success' | null> = {
  expired: 'danger',
  critical: 'danger',
  soon: 'warning',
  ok: 'success',
  none: null,
};

interface InventoryItemRowProps {
  item: LocalInventoryItem | InventoryItemGroup;
  onPress: () => void;
  onLongPress: () => void;
  onRemove: () => void;
}

function toGroup(item: LocalInventoryItem | InventoryItemGroup): InventoryItemGroup {
  return 'lots' in item ? item : groupInventoryItems([item])[0];
}

export const InventoryItemRow = memo(function InventoryItemRow({
  item,
  onPress,
  onLongPress,
  onRemove,
}: InventoryItemRowProps) {
  const { colors } = useTheme();
  const group = toGroup(item);
  const expiry = group.expiry;
  const expiryColorKey = EXPIRY_COLOR_KEY[expiry.bucket];
  const expiryColor = expiryColorKey ? colors[expiryColorKey] : 'transparent';
  const expiryLabel =
    expiry.daysLeft === null
      ? null
      : expiry.daysLeft < 0
        ? expiry.label
        : expiry.daysLeft === 0
          ? 'heute'
          : expiry.daysLeft === 1
            ? 'morgen'
            : `in ${expiry.daysLeft} Tagen`;
  const groupMeta =
    group.lots.length > 1
      ? [expiryLabel ?? 'Kein Datum hinterlegt', `${group.lots.length} MHD-Einträge`].join(' · ')
      : (expiryLabel ?? 'Kein Datum hinterlegt');
  const packageHint = formatPackageHint(group.package_size, group.package_size_unit);
  const amount = formatAmount(group.quantity, group.unit);
  const removeLabel = group.lots.length > 1 ? 'MHDs anzeigen' : 'Entfernen';

  function renderRemoveAction(
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) {
    return (
      <Pressable
        className="fridge-item-remove-action"
        accessibilityRole="button"
        accessibilityLabel={`${group.name} ${removeLabel.toLocaleLowerCase('de-DE')}`}
        onPress={() => {
          swipeable.close();
          onRemove();
        }}>
        <Txt variant="body" tone="onAccent" weight="700">
          {removeLabel}
        </Txt>
      </Pressable>
    );
  }

  return (
    <ReanimatedSwipeable
      testID={`swipeable-${item.id}`}
      friction={1.5}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={renderRemoveAction}
      containerStyle={{ overflow: 'hidden' }}>
      <Pressable
        className="inventory-item-row"
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}, ${amount}${group.lots.length > 1 ? `, ${group.lots.length} MHD-Einträge` : packageHint ? `, ${packageHint}` : ''}`}
        accessibilityHint="Tippen für Aktionen, lang drücken für Produktinformationen, nach links wischen zum Entfernen">
        <View className="fridge-item-expiry-bar" style={{ backgroundColor: expiryColor }} />

        <View className="fridge-item-main">
          <Txt variant="body" weight="800" numberOfLines={1}>
            {group.name}
          </Txt>
          {groupMeta ? (
            <Txt variant="label" tone="secondary" weight="600" numberOfLines={1}>
              {groupMeta}
            </Txt>
          ) : null}
        </View>

        <Txt
          variant="subheading"
          weight="800"
          className="fridge-item-quantity"
          style={{ fontVariant: ['tabular-nums'] }}>
          {amount}
        </Txt>
      </Pressable>
    </ReanimatedSwipeable>
  );
});
