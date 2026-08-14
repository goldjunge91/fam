import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { QuantityStepper } from '@/components/quantity-stepper';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { getExpiryInfo } from '../expiry';
import type { LocalFridgeItem } from '../use-fridge-items';

type FridgeItemActionsSheetProps = {
  visible: boolean;
  item: LocalFridgeItem | null;
  onClose: () => void;
  onQuantityChange: (value: number) => void;
  onEdit: () => void;
  onConsume: () => void;
  onRemove: () => void;
  onProductInformation: () => void;
};

export function FridgeItemActionsSheet({
  visible,
  item,
  onClose,
  onQuantityChange,
  onEdit,
  onConsume,
  onRemove,
  onProductInformation,
}: FridgeItemActionsSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!item) return null;

  const expiry = getExpiryInfo(item.expiry_date, new Date());
  const amount = formatAmount(item.quantity, item.unit);
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Artikelaktionen schließen"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundElement,
              paddingBottom: Math.max(insets.bottom, Spacing.three),
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={[styles.itemHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.expiryBar, { backgroundColor: theme[expiry.themeColor] }]} />
            <View style={styles.itemCopy}>
              <ThemedText type="subtitle">{item.name}</ThemedText>
              <ThemedText type="small" style={{ color: theme[expiry.themeColor] }}>
                {expiry.label}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={styles.quantityInline}>
              {amount}
            </ThemedText>
          </View>

          <View style={styles.quantityRow}>
            <View style={styles.quantityCopy}>
              <QuantityStepper
                value={item.quantity}
                onChange={onQuantityChange}
                label="Aktuelle Menge"
                size="large"
              />
              <ThemedText type="small" themeColor="textSecondary">
                {packageHint ?? `${amount} aktuelle Menge`}
              </ThemedText>
            </View>
          </View>

          <View style={styles.actionRow}>
            <SheetAction
              label="Bearbeiten"
              onPress={onEdit}
              backgroundColor={theme.backgroundSelected}
              color={theme.text}
            />
            <SheetAction
              label="Verbraucht"
              onPress={onConsume}
              backgroundColor={`${theme.success}24`}
              color={theme.success}
            />
            <SheetAction
              label="Entfernen"
              onPress={onRemove}
              backgroundColor={`${theme.danger}20`}
              color={theme.danger}
            />
          </View>

          <Pressable
            onPress={onProductInformation}
            accessibilityRole="button"
            accessibilityLabel="Produktinformationen"
            style={({ pressed }) => [styles.informationAction, pressed && styles.pressed]}>
            <View
              style={[
                styles.informationIcon,
                { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
              ]}>
              <ThemedText type="smallBold">i</ThemedText>
            </View>
            <ThemedText type="small">Produktinformationen</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SheetAction({
  label,
  onPress,
  backgroundColor,
  color,
}: {
  label: string;
  onPress: () => void;
  backgroundColor: string;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { backgroundColor }, pressed && styles.pressed]}>
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(31, 26, 33, 0.32)',
  },
  sheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 28,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingTop: 11,
    gap: 14,
    boxShadow: '0 -16px 48px rgba(42, 32, 44, 0.2)',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  itemHeader: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expiryBar: {
    width: 6,
    height: 52,
    borderRadius: 4,
  },
  itemCopy: {
    flex: 1,
    gap: 3,
  },
  quantityInline: {
    fontVariant: ['tabular-nums'],
  },
  quantityRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityCopy: {
    flex: 1,
    alignItems: 'stretch',
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    height: 62,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  informationAction: {
    minHeight: 36,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  informationIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
