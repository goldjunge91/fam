import { memo } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/theme/themed-text';
import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { type ExpiryBucket, getExpiryInfo } from '../expiry';
import type { LocalInventoryItem } from '../use-inventory-items';

const EXPIRY_LEFT_BORDER_KEY: Record<ExpiryBucket, ThemeColor | 'transparent'> = {
  expired: 'danger',
  critical: 'danger',
  soon: 'warning',
  ok: 'success',
  none: 'transparent',
};

interface InventoryItemRowProps {
  item: LocalInventoryItem;
  onPress: () => void;
  onLongPress: () => void;
  onRemove: () => void;
}

export const InventoryItemRow = memo(function InventoryItemRow({
  item,
  onPress,
  onLongPress,
  onRemove,
}: InventoryItemRowProps) {
  const theme = useTheme();
  const expiry = getExpiryInfo(item.expiry_date, new Date());
  const borderColorKey = EXPIRY_LEFT_BORDER_KEY[expiry.bucket];
  const borderColor = borderColorKey === 'transparent' ? 'transparent' : theme[borderColorKey];
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
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);
  const meta = [expiryLabel, packageHint].filter(Boolean).join(' · ');
  const amount = formatAmount(item.quantity, item.unit);

  function renderRemoveAction(
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name} entfernen`}
        onPress={() => {
          swipeable.close();
          onRemove();
        }}
        className="fridge-item-remove-action">
        <ThemedText type="smallBold" className="text-white">
          Entfernen
        </ThemedText>
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
      // ReanimatedSwipeable unterstuetzt kein NativeWind-className.
      containerStyle={{ overflow: 'hidden' }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${amount}${packageHint ? `, ${packageHint}` : ''}`}
        accessibilityHint="Tippen für Aktionen, lang drücken für Produktinformationen, nach links wischen zum Entfernen"
        className="inventory-item-row">
        <View className="fridge-item-expiry-bar" style={{ backgroundColor: borderColor }} />

        <View className="fridge-item-main">
          <ThemedText type="smallBold">{item.name}</ThemedText>
          {meta ? (
            <ThemedText type="captionMuted" numberOfLines={1}>
              {meta}
            </ThemedText>
          ) : null}
        </View>

        {/* fontVariant hat kein Tailwind-Aequivalent. */}
        <ThemedText
          type="smallBold"
          className="fridge-item-quantity"
          style={{ fontVariant: ['tabular-nums'] }}>
          {amount}
        </ThemedText>
      </Pressable>
    </ReanimatedSwipeable>
  );
});
