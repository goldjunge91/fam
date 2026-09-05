import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Button, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount } from '@/lib/package-size';

import { calculateOpenedExpiryDate } from '../opened-expiry';
import type { LocalInventoryItem } from '../use-inventory-items';

type OpenInventoryItemSheetProps = {
  visible: boolean;
  item: LocalInventoryItem | null;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  loading?: boolean;
};

export function OpenInventoryItemSheet({
  visible,
  item,
  onClose,
  onConfirm,
  loading = false,
}: OpenInventoryItemSheetProps) {
  const { colors } = useTheme();
  const sheetStyle = useSheetShadowStyle();
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (visible && item?.id) setQuantity(1);
  }, [visible, item?.id]);

  if (!item) return null;

  const openedAt = new Date();
  const nextExpiry = calculateOpenedExpiryDate({
    name: item.name,
    locationKind: item.location_kind,
    openedAt,
    currentExpiryDate: item.expiry_date,
    expiryUserSet: item.expiry_user_set,
    vacuumSealed: item.vacuum_sealed,
  });
  const amount = formatAmount(quantity, item.unit);
  const total = formatAmount(item.quantity, item.unit);
  const remaining = formatAmount(Math.max(0, item.quantity - quantity), item.unit);
  const expiryDate = new Date(`${nextExpiry}T00:00:00`);
  const openedDay = new Date(openedAt);
  openedDay.setHours(0, 0, 0, 0);
  const openedDays = Number.isNaN(expiryDate.getTime())
    ? null
    : Math.max(0, Math.round((expiryDate.getTime() - openedDay.getTime()) / 86400000));
  const formattedNextExpiry = Number.isNaN(expiryDate.getTime())
    ? nextExpiry
    : expiryDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Öffnen schließen"
        />
        <View className="fridge-actions-sheet" style={sheetStyle}>
          <View className="fridge-actions-handle" />
          <View className="gap-one">
            <Txt variant="title">{item.name} öffnen</Txt>
            <Txt variant="caption" tone="secondary">
              {item.location_name ?? 'Kein Lagerort'} · {total} versiegelt
            </Txt>
          </View>

          <View className="gap-two py-three">
            <View className="flex-row items-center justify-between">
              <Txt variant="body" tone="secondary" weight="700">
                Geöffnete Menge
              </Txt>
              <QuantityStepper
                value={quantity}
                max={item.quantity}
                onChange={setQuantity}
                label="Öffnungsmenge"
                size="large"
              />
            </View>
          </View>

          <View className="inventory-compare-block">
            <View className="inventory-compare-card inventory-compare-before">
              <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
                Versiegelt bleibt
              </Txt>
              <Txt variant="body" weight="700">
                {remaining}
              </Txt>
              <Txt variant="caption" tone="secondary">
                unverändert haltbar
              </Txt>
            </View>
            <Txt variant="body" tone="secondary">
              →
            </Txt>
            <View
              className="inventory-compare-card inventory-compare-after"
              style={{
                backgroundColor: withAlpha(colors.warning, 0.16),
                borderColor: withAlpha(colors.warning, 0.4),
              }}>
              <Txt variant="caption" tone="secondary" weight="700" className="uppercase">
                Neu: geöffnet
              </Txt>
              <Txt variant="body" weight="700">
                {formattedNextExpiry}
              </Txt>
              <Txt variant="caption" tone="secondary">
                {amount} ·{' '}
                {openedDays === null
                  ? 'berechnet'
                  : `${openedDays} ${openedDays === 1 ? 'Tag' : 'Tage'} ab heute`}
              </Txt>
            </View>
          </View>

          <Txt variant="caption" tone="secondary">
            Automatisch berechnet. Du kannst das Datum danach bearbeiten.
          </Txt>

          <Button
            title={`${amount} öffnen`}
            size="sm"
            onPress={() => onConfirm(quantity)}
            loading={loading}
          />
        </View>
      </View>
    </Modal>
  );
}
