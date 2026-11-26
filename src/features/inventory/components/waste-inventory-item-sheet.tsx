import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { radius, withAlpha } from '@/components/theme/index';
import { Button, Press, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { formatAmount } from '@/lib/format/package-size';

import { debugLog } from '@/lib/observability/debug-log';
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

export function WasteInventoryItemSheet({
  visible,
  item,
  onClose,
  onConfirm,
  loading = false,
}: WasteInventoryItemSheetProps) {
  const { t, i18n } = useTranslation();
  const sheetStyle = useSheetShadowStyle();
  const [reason, setReason] = useState<WasteReason>('expired');
  const itemId = item?.id ?? null;
  const hasItem = Boolean(item);

  useEffect(() => {
    if (__DEV__ && visible) {
      debugLog('[InventorySheet] inventory.waste-sheet.open', {
        sheetId: 'inventory.waste-sheet',
        itemId,
        hasItem,
      });
    }

    if (visible && itemId) setReason('expired');
  }, [hasItem, itemId, visible]);

  if (!item) return null;
  const amount = formatAmount(item.quantity, item.unit, t, i18n.language);
  const reasons: readonly { value: WasteReason; label: string; icon: string }[] = [
    { value: 'expired', label: t('inventory.waste.expired'), icon: '📅' },
    { value: 'spoiled', label: t('inventory.waste.spoiled'), icon: '🤢' },
    { value: 'other', label: t('inventory.waste.other'), icon: '•••' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        {/* Keep the shared press feedback neutral for a full-screen dismissal target. */}
        <Press
          haptic="none"
          scaleTo={1}
          containerStyle={StyleSheet.absoluteFill}
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('inventory.waste.close')}
        />
        <View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />
          <View style={styles.titleCopy}>
            <Txt variant="title">{t('inventory.waste.title', { name: item.name })}</Txt>
            <Txt variant="caption" tone="secondary">
              {amount} · {item.location_name ?? t('inventory.actions.noLocation')}
            </Txt>
          </View>

          <View style={styles.reasonSection}>
            <Txt variant="body" weight="700">
              {t('inventory.waste.reasonQuestion')}
            </Txt>
            <View style={styles.reasonList}>
              {reasons.map((option) => {
                const selected = reason === option.value;
                return (
                  <Press
                    key={option.value}
                    haptic="selection"
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
                  </Press>
                );
              })}
            </View>
          </View>

          <Button
            title={t('inventory.waste.submit')}
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
