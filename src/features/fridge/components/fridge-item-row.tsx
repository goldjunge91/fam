import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { type ExpiryBucket, getExpiryInfo } from '../expiry';
import type { LocalFridgeItem } from '../use-fridge-items';

// MHD-Ampel als linker Streifen an der Zeile — Farbe kommt aus dem Theme,
// damit sie mit dem Rest der Statusfarben (Badge, Dark Mode) mitzieht.
const EXPIRY_LEFT_BORDER_KEY: Record<ExpiryBucket, ThemeColor | 'transparent'> = {
  expired: 'danger',
  critical: 'danger',
  soon: 'warning',
  ok: 'success',
  none: 'transparent',
};

interface FridgeItemRowProps {
  item: LocalFridgeItem;
  onPress: () => void;
  onLongPress: () => void;
  onRemove: () => void;
}

export function FridgeItemRow({ item, onPress, onLongPress, onRemove }: FridgeItemRowProps) {
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
  const meta = [expiryLabel, item.location_name, packageHint].filter(Boolean).join(' · ');
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
        style={({ pressed }) => [
          styles.removeAction,
          { backgroundColor: theme.danger },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={styles.removeLabel}>
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
      containerStyle={styles.swipeContainer}
      childrenContainerStyle={{ backgroundColor: theme.backgroundElement }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${amount}${packageHint ? `, ${packageHint}` : ''}`}
        accessibilityHint="Tippen für Aktionen, lang drücken für Produktinformationen, nach links wischen zum Entfernen"
        style={[styles.itemRow, { borderBottomColor: theme.border }]}>
        {/* MHD-Ampel — linker farbiger Streifen */}
        <View style={[styles.expiryBar, { backgroundColor: borderColor }]} />

        {/* Inhalt */}
        <View style={styles.itemMain}>
          <ThemedText type="smallBold">{item.name}</ThemedText>
          {meta ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {meta}
            </ThemedText>
          ) : null}
        </View>

        <ThemedText type="smallBold" style={styles.quantity}>
          {amount}
        </ThemedText>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  expiryBar: {
    width: 5,
    height: '100%',
    minHeight: 48,
    borderRadius: 5,
  },
  itemMain: {
    flex: 1,
    gap: Spacing.half,
  },
  quantity: {
    minWidth: 58,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  removeAction: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLabel: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.78,
  },
});
