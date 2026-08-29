import { memo } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/theme/themed-text';
import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import type { ExpiryBucket } from '../expiry';
import { groupInventoryItems, type InventoryItemGroup } from '../grouped-items';
import type { LocalInventoryItem } from '../use-inventory-items';

// MHD-Ampel als linker Streifen an der Zeile — Farbe kommt aus dem Theme,
// damit sie mit dem Rest der Statusfarben (Badge, Dark Mode) mitzieht.
const EXPIRY_LEFT_BORDER_KEY: Record<ExpiryBucket, ThemeColor | 'transparent'> = {
  expired: 'danger',
  critical: 'danger',
  soon: 'warning',
  ok: 'success',
  none: 'transparent',
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
  const theme = useTheme();
  const group = toGroup(item);
  const expiry = group.expiry;
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
  const packageHint = formatPackageHint(group.package_size, group.package_size_unit);
  const groupMeta =
    group.lots.length > 1
      ? `${group.lots.length} MHD-Einträge · nächstes: ${group.expiry_date ?? 'ohne MHD'}`
      : [expiryLabel, packageHint].filter(Boolean).join(' · ');
  const amount = formatAmount(group.quantity, group.unit);
  const removeLabel = group.lots.length > 1 ? 'MHDs anzeigen' : 'Entfernen';

  function renderRemoveAction(
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${group.name} ${removeLabel.toLocaleLowerCase('de-DE')}`}
        onPress={() => {
          swipeable.close();
          onRemove();
        }}
        className="fridge-item-remove-action">
        <ThemedText type="smallBold" className="text-white">
          {removeLabel}
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
      // ReanimatedSwipeable (react-native-gesture-handler) ist nicht
      // NativeWind-registriert — className wird ignoriert, style bleibt.
      // Kein backgroundColor hier: Zeilen liegen direkt auf dem Screen-
      // Gradient, nicht auf einer durchgehenden Kartenflaeche mit harten
      // Ecken (die vorher ueber alle Zeilen hinweg sichtbar war).
      containerStyle={{ overflow: 'hidden' }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}, ${amount}${group.lots.length > 1 ? `, ${group.lots.length} MHD-Einträge` : packageHint ? `, ${packageHint}` : ''}`}
        accessibilityHint="Tippen für Aktionen, lang drücken für Produktinformationen, nach links wischen zum Entfernen"
        className="inventory-item-row">
        {/* MHD-Ampel — linker farbiger Streifen, Farbe pro Item dynamisch. */}
        <View className="fridge-item-expiry-bar" style={{ backgroundColor: borderColor }} />

        {/* Inhalt */}
        <View className="fridge-item-main">
          <ThemedText type="smallBold">{group.name}</ThemedText>
          {}
          {groupMeta ? (
            <ThemedText type="captionMuted" numberOfLines={1}>
              {groupMeta}
            </ThemedText>
          ) : null}
        </View>

        {/* fontVariant hat keine Tailwind-Entsprechung. */}
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
