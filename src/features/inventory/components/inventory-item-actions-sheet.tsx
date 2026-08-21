import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { getExpiryInfo } from '../expiry';
import type { LocalInventoryItem } from '../use-inventory-items';

type InventoryItemActionsSheetProps = {
  visible: boolean;
  item: LocalInventoryItem | null;
  onClose: () => void;
  onQuantityChange: (value: number) => void;
  onEdit: () => void;
  onConsume: () => void;
  onRemove: () => void;
  onProductInformation: () => void;
};

export function InventoryItemActionsSheet({
  visible,
  item,
  onClose,
  onQuantityChange,
  onEdit,
  onConsume,
  onRemove,
  onProductInformation,
}: InventoryItemActionsSheetProps) {
  const theme = useTheme();
  const sheetStyle = useSheetShadowStyle();

  if (!item) return null;

  const expiry = getExpiryInfo(item.expiry_date, new Date());
  const amount = formatAmount(item.quantity, item.unit);
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Artikelaktionen schließen"
        />
        <View className="fridge-actions-sheet" style={sheetStyle}>
          <View className="fridge-actions-handle" />

          <View className="fridge-actions-item-header">
            {/* Farbe pro Item dynamisch (Ablaufstatus). */}
            <View
              className="fridge-actions-expiry-bar"
              style={{ backgroundColor: theme[expiry.themeColor] }}
            />
            <View className="fridge-actions-item-copy">
              <ThemedText type="subtitle">{item.name}</ThemedText>
              <ThemedText type="small" style={{ color: theme[expiry.themeColor] }}>
                {expiry.label}
              </ThemedText>
            </View>
            {/* fontVariant hat keine Tailwind-Entsprechung. */}
            <ThemedText type="smallBold" style={{ fontVariant: ['tabular-nums'] }}>
              {amount}
            </ThemedText>
          </View>

          <View className="fridge-actions-quantity-row">
            <View className="fridge-actions-quantity-copy">
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

          <View className="fridge-actions-row">
            <SheetAction label="Bearbeiten" onPress={onEdit} variant="neutral" />
            <SheetAction label="Verbraucht" onPress={onConsume} variant="success" />
            <SheetAction label="Entfernen" onPress={onRemove} variant="danger" />
          </View>

          <Pressable
            onPress={onProductInformation}
            accessibilityRole="button"
            accessibilityLabel="Produktinformationen"
            className="fridge-actions-info-action">
            <View className="fridge-actions-info-icon">
              <ThemedText type="smallBold">i</ThemedText>
            </View>
            <ThemedText type="small">Produktinformationen</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const ACTION_VARIANT_CLASSES = {
  neutral: 'fridge-action-btn-neutral',
  success: 'fridge-action-btn-success',
  danger: 'fridge-action-btn-danger',
} as const;

const ACTION_VARIANT_TEXT_COLOR = {
  neutral: 'text',
  success: 'success',
  danger: 'danger',
} as const;

function SheetAction({
  label,
  onPress,
  variant,
}: {
  label: string;
  onPress: () => void;
  variant: keyof typeof ACTION_VARIANT_CLASSES;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`fridge-action-btn ${ACTION_VARIANT_CLASSES[variant]}`}>
      <ThemedText type="small" themeColor={ACTION_VARIANT_TEXT_COLOR[variant]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
