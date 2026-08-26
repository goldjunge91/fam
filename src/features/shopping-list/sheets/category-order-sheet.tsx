import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';

import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';
import {
  parseCategoryOrder,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
} from '../domain-logik/shopping-categories';
import { type Store, useSetStoreCategoryOrderMutation } from '../hooks/use-stores';

function resolveOrder(store: Store | null): ShoppingCategory[] {
  const customIds = parseCategoryOrder(store?.category_order);
  if (customIds.length === 0) return [...SHOPPING_CATEGORIES];

  const byId = new Map(SHOPPING_CATEGORIES.map((category) => [category.id, category]));
  const ordered = customIds
    .map((id) => byId.get(id))
    .filter((category): category is ShoppingCategory => !!category);
  const remaining = SHOPPING_CATEGORIES.filter((category) => !customIds.includes(category.id));
  return [...ordered, ...remaining];
}

interface RowProps {
  category: ShoppingCategory;
}

function Row({ category }: RowProps) {
  const theme = useTheme();
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  return (
    <View
      className="category-order-row"
      style={isActive ? { backgroundColor: theme.backgroundElement } : undefined}>
      <ThemedText type="default">{category.label}</ThemedText>
      <Pressable
        onPressIn={drag}
        className="category-order-handle"
        accessibilityRole="adjustable"
        accessibilityLabel={`${category.label} verschieben`}>
        <ThemedText type="subtitle" className="opacity-50">
          ⠿
        </ThemedText>
      </Pressable>
    </View>
  );
}

interface Props {
  isOpen: boolean;
  store: Store | null;
  onClose: () => void;
}

export function CategoryOrderSheet({ isOpen, store, onClose }: Props) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheet>(null);

  const [order, setOrder] = useState<ShoppingCategory[]>(() => resolveOrder(store));

  const saveMutation = useSetStoreCategoryOrderMutation();

  // store bewusst nicht in den deps: nur beim Oeffnen neu initialisieren,
  // sonst wuerde ein Sync-Pull mitten im Draggen die Liste zuruecksetzen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: siehe Kommentar oben.
  useEffect(() => {
    if (isOpen) {
      setOrder(resolveOrder(store));
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  function handleReorder({ from, to }: ReorderableListReorderEvent) {
    setOrder((current) => reorderItems(current, from, to));
  }

  async function handleSave() {
    if (!store) return;
    await saveMutation.mutateAsync({
      id: store.id,
      household_id: store.household_id,
      categoryOrder: order.map((category) => category.id),
    });
    onClose();
  }

  function handleReset() {
    setOrder([...SHOPPING_CATEGORIES]);
  }

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['70%', '90%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: theme.background }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}>
      {}
      <BottomSheetView style={{ flex: 1 }}>
        <ReorderableList
          data={order}
          keyExtractor={(category) => category.id}
          renderItem={({ item }) => <Row category={item} />}
          onReorder={handleReorder}
          shouldUpdateActiveItem
          autoscrollThreshold={0.2}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
          ListHeaderComponent={
            <View className="pt-two pb-three gap-[2px]">
              <ThemedText type="subtitle">Reihenfolge bearbeiten</ThemedText>
              <ThemedText type="smallMuted">{store?.name ?? ''} — am Griff ⠿ ziehen</ThemedText>
            </View>
          }
          ListFooterComponent={
            <View className="row-between py-four">
              <Pressable onPress={handleReset} accessibilityRole="button" className="py-two">
                <ThemedText type="smallMuted">Auf Standard zurücksetzen</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saveMutation.isPending}
                accessibilityRole="button"
                className="px-four py-three rounded-card"
                // Dynamische Markt-Farbe aus der Datenbank
                style={{ backgroundColor: store?.color ?? theme.accent }}>
                <ThemedText type="default" className="text-white font-bold">
                  Speichern
                </ThemedText>
              </Pressable>
            </View>
          }
        />
      </BottomSheetView>
    </BottomSheet>
  );
}
