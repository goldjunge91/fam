import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { withAlpha } from '@/components/theme/index';
import { Button, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount } from '@/lib/package-size';

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
    left: 10,
    right: 10,
    bottom: 10,
    gap: theme.space.sm + theme.space.xs + 2,
    paddingHorizontal: theme.space.sm + theme.space.xs + 2,
    paddingTop: theme.space.sm + theme.space.xs - 1,
    borderRadius: theme.radius.famLarge,
    backgroundColor: theme.backgroundElement,
  },
  handle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: theme.border,
  },
  titleCopy: {
    gap: theme.space.xs,
  },
  reasonSection: {
    gap: theme.space.sm,
    paddingVertical: theme.space.lg,
  },
  reasonList: {
    flexDirection: 'column',
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
    paddingHorizontal: theme.space.xs,
    paddingVertical: theme.space.lg,
  },
  reasonItemBorder: {
    borderBottomWidth: theme.borderWidth.base,
    borderBottomColor: theme.border,
  },
  reasonRadio: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: theme.borderWidth.strong,
  },
  reasonRadioSelected: {
    borderColor: theme.danger,
  },
  reasonRadioIdle: {
    borderColor: theme.border,
  },
  reasonDot: {
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.danger,
  },
}));

export type WasteReason = 'expired' | 'spoiled' | 'other';

type WasteInventoryItemSheetProps = {
  visible: boolean;
  item: LocalInventoryItem | null;
  onClose: () => void;
  onConfirm: (reason: WasteReason) => void;
  loading?: boolean;
};

const REASONS: readonly { value: WasteReason; label: string; icon: string }[] = [
  { value: 'expired', label: 'Abgelaufen', icon: '📅' },
  { value: 'spoiled', label: 'Schlecht geworden', icon: '🤢' },
  { value: 'other', label: 'Sonstiges', icon: '•••' },
];

export function WasteInventoryItemSheet({
  visible,
  item,
  onClose,
  onConfirm,
  loading = false,
}: WasteInventoryItemSheetProps) {
  const sheetStyle = useSheetShadowStyle();
  const [reason, setReason] = useState<WasteReason>('expired');
  const itemId = item?.id ?? null;
  const hasItem = Boolean(item);

  useEffect(() => {
    if (__DEV__ && visible) {
      console.log('[InventorySheet] inventory.waste-sheet.open', {
        sheetId: 'inventory.waste-sheet',
        itemId,
        hasItem,
      });
    }

    if (visible && itemId) setReason('expired');
  }, [hasItem, itemId, visible]);

  if (!item) return null;
  const amount = formatAmount(item.quantity, item.unit);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Verschwendung schließen"
        />
        <View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />
          <View style={styles.titleCopy}>
            <Txt variant="title">{item.name} wegwerfen</Txt>
            <Txt variant="caption" tone="secondary">
              {amount} · {item.location_name ?? 'Kein Lagerort'}
            </Txt>
          </View>

          <View style={styles.reasonSection}>
            <Txt variant="body" weight="700">
              Warum wird es weggeworfen?
            </Txt>
            <View style={styles.reasonList}>
              {REASONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setReason(option.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                    style={[
                      styles.reasonItem,
                      option.value !== 'other' && styles.reasonItemBorder,
                    ]}>
                    <View
                      style={[
                        styles.reasonRadio,
                        selected ? styles.reasonRadioSelected : styles.reasonRadioIdle,
                      ]}>
                      {selected ? <View style={styles.reasonDot} /> : null}
                    </View>
                    <Txt variant="body" weight="700">
                      {option.icon}
                    </Txt>
                    <Txt variant="body" weight="700">
                      {option.label}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Button
            title="Als Verschwendung buchen"
            variant="danger"
            size="sm"
            onPress={() => onConfirm(reason)}
            loading={loading}
          />
        </View>
      </View>
    </Modal>
  );
}
