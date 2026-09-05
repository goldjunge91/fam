import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { DateWheelField } from '@/components/forms/date-wheel-field';
import { useTheme } from '@/components/theme/ThemeProvider';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { type ExpiryThemeColor, getExpiryInfo } from '../expiry';
import type { LocalInventoryItem } from '../use-inventory-items';

type InventoryItemActionsSheetProps = {
  visible: boolean;
  item: LocalInventoryItem | null;
  onClose: () => void;
  onQuantityChange: (value: number) => void;
  onEdit: () => void;
  onConsume: () => void;
  onRemove: () => void;
  onOpen: () => void;
  onWaste: () => void;
  onExpiryChange: (expiryDate: string) => void;
};

export function InventoryItemActionsSheet({
  visible,
  item,
  onClose,
  onQuantityChange,
  onEdit,
  onConsume,
  onRemove,
  onOpen,
  onWaste,
  onExpiryChange,
}: InventoryItemActionsSheetProps) {
  const { colors } = useTheme();
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
              style={{ backgroundColor: expiryColor(expiry.themeColor, colors, !!item.opened_at) }}
            />
            <View className="fridge-actions-item-copy">
              <Txt variant="title">{item.name}</Txt>
              <Txt variant="body" color={expiryColor(expiry.themeColor, colors, !!item.opened_at)}>
                {expiry.label}
              </Txt>
            </View>
            {/* fontVariant hat keine Tailwind-Entsprechung. */}
            <Txt variant="body" weight="700" style={{ fontVariant: ['tabular-nums'] }}>
              {amount}
            </Txt>
          </View>

          <View className="fridge-actions-quantity-row">
            <View className="fridge-actions-quantity-copy">
              <QuantityStepper
                value={item.quantity}
                onChange={onQuantityChange}
                label="Aktuelle Menge"
                size="large"
              />
              <Txt variant="body" tone="secondary">
                {packageHint ?? `${amount} aktuelle Menge`}
              </Txt>
            </View>
          </View>

          <View className="fridge-actions-row">
            <SheetAction label="Bearbeiten" onPress={onEdit} variant="neutral" />
            {!item.opened_at ? (
              <SheetAction label="Öffnen" onPress={onOpen} variant="neutral" />
            ) : null}
            <SheetAction label="Verbraucht" onPress={onConsume} variant="success" />
            <SheetAction label="Wegwerfen" onPress={onWaste} variant="danger" />
            <SheetAction label="Entfernen" onPress={onRemove} variant="danger" fullWidth />
          </View>

          <DateWheelField
            label="Mindesthaltbarkeitsdatum"
            value={item.expiry_date ?? ''}
            onChange={onExpiryChange}
          />
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
  neutral: 'primary',
  success: 'success',
  danger: 'danger',
} as const;

function SheetAction({
  label,
  onPress,
  variant,
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  variant: keyof typeof ACTION_VARIANT_CLASSES;
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`fridge-action-btn ${fullWidth ? 'fridge-action-btn-full' : ''} ${ACTION_VARIANT_CLASSES[variant]}`}>
      <Txt variant="body" tone={ACTION_VARIANT_TEXT_COLOR[variant]} weight="700">
        {label}
      </Txt>
    </Pressable>
  );
}

function expiryColor(
  themeColor: ExpiryThemeColor,
  colors: ReturnType<typeof useTheme>['colors'],
  opened: boolean,
): string {
  if (themeColor === 'danger') return colors.tomato;
  if (themeColor === 'warning') return colors.carrot;
  if (opened) return colors.carrot;
  return colors.textMuted;
}
