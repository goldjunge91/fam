import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { radius, withAlpha } from '@/components/theme/index';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { Button, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount } from '@/lib/format/package-size';
import { subtractInventoryQuantities } from '@/lib/inventory-quantity';
import { debugLog } from '@/lib/observability/debug-log';

import { calculateOpenedExpiryDate } from '../opened-expiry';
import type { LocalInventoryItem } from '../use-inventory-items';

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: withAlpha(theme.text, 0.32),
  },
  sheet: {
    position: 'absolute',
    left: theme.space.md,
    right: theme.space.md,
    bottom: theme.space.md,
    gap: theme.space.md,
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.md,
    borderRadius: theme.radius.famLarge,
    backgroundColor: theme.backgroundElement,
  },
  handle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.s,
    backgroundColor: theme.border,
  },
  titleCopy: {
    gap: theme.space.xs,
  },
  quantitySection: {
    gap: theme.space.sm,
    paddingVertical: theme.space.lg,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compareBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    marginVertical: theme.space.sm,
  },
  compareCard: {
    flex: 1,
    gap: theme.space.xs,
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
  },
  compareBefore: {
    backgroundColor: theme.backgroundSoft,
  },
  compareAfter: {
    borderWidth: theme.borderWidth.base,
    borderColor: withAlpha(theme.warning, 0.4),
    backgroundColor: withAlpha(theme.warning, 0.16),
  },
  eyebrow: {
    textTransform: 'uppercase',
  },
}));

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
  const sheetStyle = useSheetShadowStyle();
  const [quantity, setQuantity] = useState(1);
  const itemId = item?.id ?? null;
  const hasItem = Boolean(item);

  useEffect(() => {
    if (__DEV__ && visible) {
      debugLog('[InventorySheet] inventory.open-sheet.open', {
        sheetId: 'inventory.open-sheet',
        itemId,
        hasItem,
      });
    }

    if (visible && itemId) setQuantity(1);
  }, [hasItem, itemId, visible]);

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
  const remaining = formatAmount(
    Math.max(0, subtractInventoryQuantities(item.quantity, quantity)),
    item.unit,
  );
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
        {/* The scrim stays a native Pressable so dismissal has no button haptics or scale. */}
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Öffnen schließen"
        />
        <View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />
          <View style={styles.titleCopy}>
            <Txt variant="title">{item.name} öffnen</Txt>
            <Txt variant="caption" tone="secondary">
              {item.location_name ?? 'Kein Lagerort'} · {total} versiegelt
            </Txt>
          </View>

          <View style={styles.quantitySection}>
            <View style={styles.quantityRow}>
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

          <View style={styles.compareBlock}>
            <View style={[styles.compareCard, styles.compareBefore]}>
              <Txt variant="caption" tone="secondary" weight="700" style={styles.eyebrow}>
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
            <View style={[styles.compareCard, styles.compareAfter]}>
              <Txt variant="caption" tone="secondary" weight="700" style={styles.eyebrow}>
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
