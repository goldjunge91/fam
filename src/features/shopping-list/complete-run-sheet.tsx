import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateWheelField } from '@/components/date-wheel-field';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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
  const theme = useTheme();
  const packageHint = formatPackageHint(item.package_size, item.package_size_unit);

  return (
    <View style={[styles.transferRow, { borderBottomColor: theme.border }]}>
      {/* Artikel-Header */}
      <View style={styles.itemHeader}>
        <ThemedText type="smallBold">{item.name}</ThemedText>

        {/* Menge — grüner Pill-Badge wie im Screenshot */}
        <View style={[styles.quantityBadge, { backgroundColor: theme.success }]}>
          <ThemedText style={styles.quantityBadgeText}>
            {formatAmount(item.quantity, item.unit)}
          </ThemedText>
        </View>
      </View>
      {packageHint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {packageHint}
        </ThemedText>
      ) : null}

      {/* Location-Picker + MHD */}
      <View style={styles.controls}>
        <View style={styles.kindPicker}>
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
                style={[
                  styles.kindButton,
                  {
                    borderColor: isActive ? theme.accent : theme.border,
                    backgroundColor: isActive ? `${theme.accent}18` : 'transparent',
                  },
                ]}>
                <ThemedText style={styles.kindIcon}>{cfg.icon}</ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: isActive ? theme.accent : theme.textSecondary }}>
                  {cfg.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* MHD */}
        <View style={styles.mhdRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.mhdLabel}>
            MHD
          </ThemedText>
          <View style={styles.mhdField}>
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
      <BottomSheetView style={styles.sheetContent}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <ThemedText type="title">In Vorrat übernehmen</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {count} {count === 1 ? 'Artikel' : 'Artikel'} abgehakt
            </ThemedText>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
            style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText>✕</ThemedText>
          </Pressable>
        </View>

        {/* Artikel-Liste */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
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
        <View style={styles.actions}>
          <Pressable
            onPress={handleConfirm}
            disabled={count === 0}
            accessibilityRole="button"
            accessibilityLabel={`${count} Artikel in Vorrat übernehmen`}
            style={[
              styles.confirmButton,
              { backgroundColor: theme.success, opacity: count === 0 ? 0.5 : 1 },
            ]}>
            <ThemedText style={styles.confirmButtonText}>
              ✓ {count} {count === 1 ? 'Artikel' : 'Artikel'} in Vorrat übernehmen
            </ThemedText>
          </Pressable>

          <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancelLink}>
            <ThemedText type="small" themeColor="textSecondary">
              Abbrechen
            </ThemedText>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  transferRow: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sheet,
  },
  quantityBadgeText: {
    color: '#fff',
    ...FontSize[13],
    fontWeight: '600',
  },
  controls: {
    gap: Spacing.two,
  },
  kindPicker: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  kindButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.sheet,
    borderWidth: 1.5,
  },
  kindIcon: {
    ...FontSize[14],
  },
  mhdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mhdLabel: {
    width: 32,
  },
  mhdField: {
    flex: 1,
  },
  actions: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  confirmButton: {
    width: '100%',
    paddingVertical: Spacing.three,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '700',
    ...FontSize[16],
  },
  cancelLink: {
    paddingVertical: Spacing.two,
  },
});
