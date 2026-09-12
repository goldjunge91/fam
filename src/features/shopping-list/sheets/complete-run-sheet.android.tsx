import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { DateWheelField } from '@/components/forms/date-wheel-field';
import { font } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { debugLogEvent } from '@/lib/debug-log';
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

debugLogEvent('shopping-list.complete-run-sheet.module-loaded', { variant: 'android' });

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
  const { colors } = useTheme();
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
    <View className="transfer-row">
      {/* Artikel-Header */}
      <View className="row-between">
        <Txt variant="subheading" weight="700" numberOfLines={2} className="flex-1 min-w-0">
          {item.name}
        </Txt>

        {/* Menge — grüner Pill-Badge, per Antippen als Zahl editierbar
            (Feedback: "im Laden nur 5 statt 6 Brötchen bekommen") */}
        {isEditingQty ? (
          <View className="quantity-badge flex-row items-center gap-half" style={{ flexShrink: 0 }}>
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
              className="min-w-[32px] p-0 [font-variant:tabular-nums]"
              style={{
                color: colors.onAccent,
                fontSize: font.sizes.base,
                lineHeight: font.lineHeights.body,
                fontWeight: '600',
              }}
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
            className="quantity-badge"
            style={{ flexShrink: 0 }}>
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
      <View className="col-gap">
        <View className="input-row">
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
                className={`kind-button ${
                  isActive ? 'border-accent bg-accent/10' : 'border-border bg-transparent'
                }`}>
                <Txt variant="caption">{KIND_ICONS[kind]}</Txt>
                <Txt variant="caption" tone="primary">
                  {label}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {/* MHD */}
        <View className="flex-row items-center">
          <Txt variant="body" tone="secondary" numberOfLines={1} className="flex-1">
            {t('shoppingList.completeRun.expiryLabel')}
          </Txt>
          <View className="mhd-field-width ml-auto">
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
  const { colors: theme } = useTheme();
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
    debugLogEvent('shopping-list.complete-run-sheet.visibility', {
      variant: 'android',
      isOpen,
    });
    if (isOpen) {
      debugLogEvent('shopping-list.complete-run-sheet.native-action', {
        variant: 'android',
        action: 'expand',
      });
      sheetRef.current?.expand();
    } else {
      debugLogEvent('shopping-list.complete-run-sheet.native-action', {
        variant: 'android',
        action: 'close',
      });
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
      index={-1}
      // Android unterstützt nur einen partiellen und einen vollständig
      // expandierten Zustand. Ein einzelner großer Snap-Punkt überspringt
      // den partiellen Zustand beim Öffnen.
      snapPoints={['90%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}>
      {}
      <BottomSheetView style={{ flex: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <View className="row-between items-start px-four pt-two pb-three">
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
              className="modal-close-btn">
              <Txt>✕</Txt>
            </Pressable>
          </View>

          {/* Artikel-Liste */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
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
          <View className="px-four pt-three pb-four gap-two items-center">
            <Pressable
              onPress={handleConfirm}
              disabled={count === 0}
              accessibilityRole="button"
              accessibilityLabel={t('shoppingList.completeRun.confirmAccessibility', { count })}
              className={`btn-success ${count === 0 ? 'opacity-50' : 'opacity-100'}`}>
              <Txt variant="body" weight="700" tone="onAccent">
                {t('shoppingList.completeRun.confirm', { count })}
              </Txt>
            </Pressable>

            <Pressable onPress={onClose} accessibilityRole="button" className="py-two">
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
