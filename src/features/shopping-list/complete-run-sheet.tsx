import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { DateWheelField } from '@/components/date-wheel-field';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, formatPackageHint } from '@/lib/package-size';

import { type StorageKind, storageKindForCategory } from './shopping-categories';
import type { LocalShoppingItem } from './use-shopping-list';

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

// ---------------------------------------------------------------------------
// Einzel-Zeile im Transfer-Sheet
// ---------------------------------------------------------------------------

interface TransferRowProps {
  item: LocalShoppingItem;
  transfer: TransferItem;
  onUpdateKind: (kind: StorageKind) => void;
  onUpdateExpiry: (isoDate: string) => void;
}

function TransferRow({ item, transfer, onUpdateKind, onUpdateExpiry }: TransferRowProps) {
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <View className="transfer-row">
      {/* Artikel-Header */}
      <View className="row-between">
        <ThemedText type="smallBold">{item.name}</ThemedText>

        {/* Menge — grüner Pill-Badge */}
        <View className="quantity-badge">
          <ThemedText type="label" className="text-white font-semibold">
            {formatAmount(item.quantity, item.unit)}
          </ThemedText>
        </View>
      </View>
      {packageHint ? <ThemedText type="smallMuted">{packageHint}</ThemedText> : null}

      {/* Location-Picker + MHD */}
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
                <ThemedText type="label">{cfg.icon}</ThemedText>
                <ThemedText type="small" themeColor={isActive ? 'accent' : 'textSecondary'}>
                  {cfg.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* MHD */}
        <View className="row-center">
          <ThemedText type="smallMuted" className="w-8">
            MHD
          </ThemedText>
          <View className="flex-1">
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

/**
 * Bottom-Sheet zum Abschluss eines Einkaufs (#85/#86).
 *
 * Titel: "In Vorrat übernehmen" — genau wie im Screenshot.
 * Pro Artikel: Pill-Badge Menge + 3 Location-Buttons + MHD-Feld.
 * Confirm: "N Artikel in Vorrat übernehmen".
 *
 * Gecheckte Items werden beim Bestätigen per `onConfirm` übergeben.
 * Der Aufrufer (ShoppingListScreen) ruft useCompleteShoppingRun auf,
 * der die Items soft-deletet und in fridge_items insertet.
 *
 * Implementiert mit @expo/ui/community/bottom-sheet (nativer SwiftUI/Compose Sheet).
 */
export function CompleteRunSheet({ isOpen, checkedItems, onConfirm, onClose }: Props) {
  const theme = useTheme();
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
      <BottomSheetView>
        <View className="flex-1">
          {/* Header */}
          <View className="row-between items-start px-four pt-two pb-three">
            <View>
              <ThemedText type="title">In Vorrat übernehmen</ThemedText>
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
