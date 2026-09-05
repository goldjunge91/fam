import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount } from '@/lib/package-size';

import type { LocalInventoryItem } from '../use-inventory-items';

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
  const { colors } = useTheme();
  const sheetStyle = useSheetShadowStyle();
  const [reason, setReason] = useState<WasteReason>('expired');

  useEffect(() => {
    if (visible && item?.id) setReason('expired');
  }, [visible, item?.id]);

  if (!item) return null;
  const amount = formatAmount(item.quantity, item.unit);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          className="fridge-actions-backdrop"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Verschwendung schließen"
        />
        <View className="fridge-actions-sheet" style={sheetStyle}>
          <View className="fridge-actions-handle" />
          <View className="gap-one">
            <Txt variant="title">{item.name} wegwerfen</Txt>
            <Txt variant="caption" tone="secondary">
              {amount} · {item.location_name ?? 'Kein Lagerort'}
            </Txt>
          </View>

          <View className="gap-two py-three">
            <Txt variant="body" weight="700">
              Warum wird es weggeworfen?
            </Txt>
            <View className="inventory-reason-list">
              {REASONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setReason(option.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                    className={`inventory-reason-item ${option.value !== 'other' ? 'border-b border-border' : ''}`}>
                    <View
                      className="h-[18px] w-[18px] items-center justify-center rounded-full border-2"
                      style={{ borderColor: selected ? colors.danger : colors.border }}>
                      {selected ? (
                        <View
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: colors.danger }}
                        />
                      ) : null}
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
