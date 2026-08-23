import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { DateWheelField } from '@/components/forms/date-wheel-field';
import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';
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

const KIND_CONFIG: Record<StorageKind, { label: string; icon: string }> = {
  fridge: { label: 'Kühl', icon: '🧊' },
  freezer: { label: 'Frost', icon: '❄️' },
  pantry: { label: 'Kammer', icon: '🗄' },
};

const KINDS: StorageKind[] = ['fridge', 'freezer', 'pantry'];

function defaultKind(item: LocalShoppingItem): StorageKind {
  return storageKindForCategory(item.category);
}

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
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(String(transfer.quantity));

  function startEditingQty() {
    setQtyDraft(String(transfer.quantity));
    setIsEditingQty(true);
  }

  function commitQtyDraft() {
    setIsEditingQty(false);
    // Dezimalkommas muessen vor dem Parsen normalisiert werden.
    const parsed = Number.parseFloat(qtyDraft.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) onUpdateQuantity(parsed);
  }

  return (
    <View className="transfer-row">
      <View className="row-between">
        <ThemedText type="bodyLarge" className="font-bold">
          {item.name}
        </ThemedText>

        {isEditingQty ? (
          <View className="quantity-badge flex-row items-center gap-half">
            <TextInput
              value={qtyDraft}
              onChangeText={setQtyDraft}
              onBlur={commitQtyDraft}
              autoFocus
              selectTextOnFocus
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={commitQtyDraft}
              accessibilityLabel={`Menge für ${item.name} eingeben`}
              className="min-w-[32px] p-0 text-body-relaxed font-semibold text-white [font-variant:tabular-nums]"
            />
            <ThemedText type="small" className="text-white font-semibold">
              {item.unit}
            </ThemedText>
          </View>
        ) : (
          <Pressable
            onPress={startEditingQty}
            accessibilityRole="button"
            accessibilityLabel={`Menge für ${item.name}, ${formatAmount(transfer.quantity, item.unit)}, zum Ändern antippen`}
            className="quantity-badge">
            <ThemedText type="small" className="text-white font-semibold">
              {formatAmount(transfer.quantity, item.unit)}
            </ThemedText>
          </Pressable>
        )}
      </View>
      {packageHint ? <ThemedText type="smallMuted">{packageHint}</ThemedText> : null}

      <View className="col-gap">
        <View className="input-row">
          {KINDS.map((kind) => {
            const cfg = KIND_CONFIG[kind];
            const isActive = transfer.locationKind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => onUpdateKind(kind)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={cfg.label}
                className={`kind-button ${
                  isActive ? 'border-accent bg-accent/10' : 'border-border bg-transparent'
                }`}>
                <ThemedText type="detail">{cfg.icon}</ThemedText>
                <ThemedText type="caption" themeColor={isActive ? 'accent' : 'textSecondary'}>
                  {cfg.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View className="row-center">
          <ThemedText type="smallMuted" className="w-8">
            MHD
          </ThemedText>
          <View className="mhd-field-width">
            <DateWheelField value={transfer.expiryDate ?? ''} onChange={onUpdateExpiry} />
          </View>
        </View>
      </View>
    </View>
  );
}

interface Props {
  isOpen: boolean;
  checkedItems: LocalShoppingItem[];
  onConfirm: (transfers: TransferItem[]) => void;
  onClose: () => void;
}

export function CompleteRunSheet({ isOpen, checkedItems, onConfirm, onClose }: Props) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheet>(null);

  const [transfers, setTransfers] = useState<Map<string, TransferItem>>(new Map());

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
      const t = next.get(itemId);
      if (t) next.set(itemId, { ...t, locationKind: kind });
      return next;
    });
  }

  function setExpiryDate(itemId: string, isoDate: string | null) {
    setTransfers((prev) => {
      const next = new Map(prev);
      const t = next.get(itemId);
      if (t) next.set(itemId, { ...t, expiryDate: isoDate });
      return next;
    });
  }

  function updateQuantity(itemId: string, quantity: number) {
    setTransfers((prev) => {
      const next = new Map(prev);
      const t = next.get(itemId);
      if (t) next.set(itemId, { ...t, quantity });
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
      backgroundStyle={{ backgroundColor: theme.background }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}>
      {/* BottomSheetView setzt kein eigenes flex: 1; sonst bleibt die ScrollView leer. */}
      <BottomSheetView style={{ flex: 1 }}>
        <View className="flex-1">
          <View className="row-between items-start px-four pt-two pb-three">
            <View>
              <ThemedText type="subtitle">In Vorrat übernehmen</ThemedText>
              <ThemedText type="smallMuted">
                {count} {count === 1 ? 'Artikel' : 'Artikel'} abgehakt
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              className="modal-close-btn">
              <ThemedText>✕</ThemedText>
            </Pressable>
          </View>

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

          <View className="px-four pt-three pb-four gap-two items-center">
            <Pressable
              onPress={handleConfirm}
              disabled={count === 0}
              accessibilityRole="button"
              accessibilityLabel={`${count} Artikel in Vorrat übernehmen`}
              className={`btn-success ${count === 0 ? 'opacity-50' : 'opacity-100'}`}>
              <ThemedText type="bodyBold" className="text-white">
                ✓ {count} {count === 1 ? 'Artikel' : 'Artikel'} in Vorrat übernehmen
              </ThemedText>
            </Pressable>

            <Pressable onPress={onClose} accessibilityRole="button" className="py-two">
              <ThemedText type="smallMuted">Abbrechen</ThemedText>
            </Pressable>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}
