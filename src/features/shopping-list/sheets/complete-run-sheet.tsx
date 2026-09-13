import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { DateWheelField } from '@/components/forms/date-wheel-field';
import { withAlpha } from '@/components/theme/index';
import { Txt } from '@/constants/ui';
import { formatAmount, formatPackageHint } from '@/lib/package-size';
import { type StorageKind, storageKindForCategory } from '../domain-logik/shopping-categories';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';

export type { StorageKind };

export type TransferItem = {
  shoppingItemId: string;
  productId: string | null;
  name: string;
  quantity: number;
  unit: string;
  packageSize: number | null;
  packageSizeUnit: string | null;
  locationKind: StorageKind;
  expiryDate: string | null;
};

const KIND_ICONS: Record<StorageKind, string> = {
  fridge: '🧊',
  freezer: '❄️',
  pantry: '🗄',
};

const KINDS: StorageKind[] = ['fridge', 'freezer', 'pantry'];

const styles = StyleSheet.create((theme) => ({
  sheetBackground: {
    backgroundColor: theme.background,
  },
  sheetIndicator: {
    backgroundColor: theme.border,
  },
  bottomSheet: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  transferRow: {
    paddingHorizontal: theme.space.xl + theme.space.xs,
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    gap: theme.space.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  itemName: {
    flex: 1,
    minWidth: 0,
  },
  quantityBadge: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.success,
  },
  quantityEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs / 2,
    flexShrink: 0,
  },
  quantityInput: {
    minWidth: theme.space.xxl + theme.space.xs,
    padding: 0,
    fontVariant: ['tabular-nums'],
    color: theme.onAccent,
    fontSize: theme.font.sizes.base,
    lineHeight: theme.font.lineHeights.body,
    fontWeight: theme.font.weight.semibold,
  },
  quantityButton: {
    flexShrink: 0,
  },
  locationGroup: {
    gap: theme.space.sm,
  },
  kindRow: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  kindButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    paddingVertical: theme.space.xs,
    paddingHorizontal: theme.space.xs,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth.base,
  },
  kindButtonSelected: {
    borderColor: theme.accent,
    backgroundColor: withAlpha(theme.accent, 0.1),
  },
  kindButtonIdle: {
    borderColor: theme.border,
    backgroundColor: 'transparent',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiryLabel: {
    flex: 1,
  },
  expiryField: {
    width: 140,
    marginLeft: 'auto',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.xl + theme.space.xs,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.lg,
  },
  closeButton: {
    width: theme.space.xxl + theme.space.xs,
    height: theme.space.xxl + theme.space.xs,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundElement,
  },
  scroll: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.xl + theme.space.xs,
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.xl + theme.space.xs,
  },
  confirmButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.success,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    paddingVertical: theme.space.sm,
  },
}));

function defaultKind(item: LocalShoppingItem): StorageKind {
  return storageKindForCategory(item.category);
}

// ---------------------------------------------------------------------------
// Einzel-Zeile im Transfer-Sheet
// ---------------------------------------------------------------------------

interface TransferRowProps {
  item: LocalShoppingItem;
  transfer: TransferItem;
  onUpdateKind: (kind: StorageKind) => void;
  onUpdateExpiry: (isoDate: string) => void;
  onUpdateQuantity: (quantity: number) => void;
}

function TransferRow({
  item,
  transfer,
  onUpdateKind,
  onUpdateExpiry,
  onUpdateQuantity,
}: TransferRowProps) {
  const { t } = useTranslation();
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(String(transfer.quantity));

  function startEditingQty() {
    setQtyDraft(String(transfer.quantity));
    setIsEditingQty(true);
  }

  function commitQtyDraft() {
    setIsEditingQty(false);
    // deutsches Komma zulassen, sonst bleibt "1,5" als NaN haengen
    const parsed = Number.parseFloat(qtyDraft.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) onUpdateQuantity(parsed);
  }

  return (
    <View style={styles.transferRow}>
      {/* Artikel-Header */}
      <View style={styles.itemHeader}>
        <Txt variant="subheading" weight="700" numberOfLines={2} style={styles.itemName}>
          {item.name}
        </Txt>

        {/* Menge — grüner Pill-Badge, per Antippen als Zahl editierbar
            (Feedback: "im Laden nur 5 statt 6 Brötchen bekommen") */}
        {isEditingQty ? (
          <View style={[styles.quantityBadge, styles.quantityEditRow]}>
            <TextInput
              value={qtyDraft}
              onChangeText={setQtyDraft}
              onBlur={commitQtyDraft}
              autoFocus
              selectTextOnFocus
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={commitQtyDraft}
              accessibilityLabel={t('shoppingList.completeRun.quantityAccessibility', {
                item: item.name,
              })}
              style={styles.quantityInput}
            />
            <Txt variant="body" tone="onAccent" weight="600">
              {item.unit}
            </Txt>
          </View>
        ) : (
          <Pressable
            onPress={startEditingQty}
            accessibilityRole="button"
            accessibilityLabel={t('shoppingList.completeRun.quantityEditAccessibility', {
              item: item.name,
              amount: formatAmount(transfer.quantity, item.unit),
            })}
            style={[styles.quantityBadge, styles.quantityButton]}>
            <Txt variant="body" tone="onAccent" weight="600">
              {formatAmount(transfer.quantity, item.unit)}
            </Txt>
          </Pressable>
        )}
      </View>
      {packageHint ? (
        <Txt variant="body" tone="secondary">
          {packageHint}
        </Txt>
      ) : null}

      {/* Location-Picker + MHD */}
      <View style={styles.locationGroup}>
        <View style={styles.kindRow}>
          {KINDS.map((kind) => {
            const label = t(`shoppingList.completeRun.storageKind.${kind}`);
            const isActive = transfer.locationKind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => onUpdateKind(kind)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={label}
                style={[
                  styles.kindButton,
                  isActive ? styles.kindButtonSelected : styles.kindButtonIdle,
                ]}>
                <Txt variant="caption">{KIND_ICONS[kind]}</Txt>
                <Txt variant="caption" tone="primary">
                  {label}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {/* MHD */}
        <View style={styles.expiryRow}>
          <Txt variant="body" tone="secondary" numberOfLines={1} style={styles.expiryLabel}>
            {t('shoppingList.completeRun.expiryLabel')}
          </Txt>
          <View style={styles.expiryField}>
            <DateWheelField value={transfer.expiryDate ?? ''} onChange={onUpdateExpiry} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

interface Props {
  isOpen: boolean;
  checkedItems: LocalShoppingItem[];
  onConfirm: (transfers: TransferItem[]) => void;
  onClose: () => void;
}

export function CompleteRunSheet({ isOpen, checkedItems, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const sheetRef = useRef<BottomSheet>(null);

  const [transfers, setTransfers] = useState<Map<string, TransferItem>>(new Map());

  // Sync transfers wenn checkedItems sich ändern
  useEffect(() => {
    const map = new Map<string, TransferItem>();
    for (const item of checkedItems) {
      map.set(item.id, {
        shoppingItemId: item.id,
        productId: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        packageSize: item.package_size,
        packageSizeUnit: item.package_size_unit,
        locationKind: defaultKind(item),
        expiryDate: null,
      });
    }
    setTransfers(map);
  }, [checkedItems]);

  // Sheet öffnen/schließen via ref
  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  function updateKind(itemId: string, kind: StorageKind) {
    setTransfers((prev) => {
      const next = new Map(prev);
      const entry = next.get(itemId);
      if (entry) next.set(itemId, { ...entry, locationKind: kind });
      return next;
    });
  }

  function setExpiryDate(itemId: string, isoDate: string | null) {
    setTransfers((prev) => {
      const next = new Map(prev);
      const entry = next.get(itemId);
      if (entry) next.set(itemId, { ...entry, expiryDate: isoDate });
      return next;
    });
  }

  /** Korrektur, wenn im Laden mehr/weniger mitgenommen wurde als geplant. */
  function updateQuantity(itemId: string, quantity: number) {
    setTransfers((prev) => {
      const next = new Map(prev);
      const entry = next.get(itemId);
      if (entry) next.set(itemId, { ...entry, quantity });
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(Array.from(transfers.values()));
  }

  const count = checkedItems.length;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['60%', '90%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetIndicator}>
      {}
      <BottomSheetView style={styles.bottomSheet}>
        <View style={styles.root}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Txt variant="heading" weight="700">
                {t('shoppingList.completeRun.title')}
              </Txt>
              <Txt variant="body" tone="secondary">
                {t('shoppingList.completeRun.subtitle', { count })}
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('shoppingList.close')}
              style={styles.closeButton}>
              <Txt>✕</Txt>
            </Pressable>
          </View>

          {/* Artikel-Liste */}
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {checkedItems.map((item) => {
              const transfer = transfers.get(item.id);
              if (!transfer) return null;
              return (
                <TransferRow
                  key={item.id}
                  item={item}
                  transfer={transfer}
                  onUpdateKind={(kind) => updateKind(item.id, kind)}
                  onUpdateExpiry={(isoDate) => setExpiryDate(item.id, isoDate)}
                  onUpdateQuantity={(quantity) => updateQuantity(item.id, quantity)}
                />
              );
            })}
          </ScrollView>

          {/* Confirm-Button — volle Breite, grün, wie im Screenshot */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleConfirm}
              disabled={count === 0}
              accessibilityRole="button"
              accessibilityLabel={t('shoppingList.completeRun.confirmAccessibility', { count })}
              style={[styles.confirmButton, count === 0 && styles.confirmButtonDisabled]}>
              <Txt variant="body" weight="700" tone="onAccent">
                {t('shoppingList.completeRun.confirm', { count })}
              </Txt>
            </Pressable>

            <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancelButton}>
              <Txt variant="body" tone="secondary">
                {t('shoppingList.completeRun.cancel')}
              </Txt>
            </Pressable>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}
