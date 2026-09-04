import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
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
  const { colors: theme } = useTheme();
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  return (
    <View
      className="category-order-row"
      style={isActive ? { backgroundColor: theme.surface } : undefined}>
      <Txt variant="body">{category.label}</Txt>
      <Pressable
        onPressIn={drag}
        className="category-order-handle"
        accessibilityRole="adjustable"
        accessibilityLabel={`${category.label} verschieben`}>
        <Txt variant="heading" weight="700" className="opacity-50">
          ⠿
        </Txt>
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
  const { colors: theme } = useTheme();
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
      backgroundStyle={{ backgroundColor: theme.bg }}
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
              <Txt variant="heading" weight="700">
                Reihenfolge bearbeiten
              </Txt>
              <Txt variant="body" tone="secondary">
                {store?.name ?? ''} — am Griff ⠿ ziehen
              </Txt>
            </View>
          }
          ListFooterComponent={
            <View className="row-between py-four">
              <Pressable onPress={handleReset} accessibilityRole="button" className="py-two">
                <Txt variant="body" tone="secondary">
                  Auf Standard zurücksetzen
                </Txt>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saveMutation.isPending}
                accessibilityRole="button"
                className="px-four py-three rounded-card"
                // Dynamische Markt-Farbe aus der Datenbank
                style={{ backgroundColor: store?.color ?? theme.basil }}>
                <Txt variant="body" tone="onAccent" weight="700">
                  Speichern
                </Txt>
              </Pressable>
            </View>
          }
        />
      </BottomSheetView>
    </BottomSheet>
  );
}
