import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  parseCategoryOrder,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
} from '../shopping-categories';
import { type Store, useSetStoreCategoryOrderMutation } from '../use-stores';

const ROW_HEIGHT = 52;

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
  index: number;
  isDragging: boolean;
  translateY: Animated.Value;
  onDragStart: (index: number) => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
}

function Row({
  category,
  index,
  isDragging,
  translateY,
  onDragStart,
  onDragMove,
  onDragEnd,
}: RowProps) {
  const theme = useTheme();
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => onDragStart(index),
      onPanResponderMove: (_evt, gesture) => onDragMove(gesture.dy),
      onPanResponderRelease: onDragEnd,
      onPanResponderTerminate: onDragEnd,
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          borderBottomColor: theme.border,
          backgroundColor: isDragging ? theme.backgroundElement : 'transparent',
          transform: [{ translateY: isDragging ? translateY : 0 }],
          zIndex: isDragging ? 10 : 0,
        },
      ]}>
      <ThemedText style={styles.rowLabel}>{category.label}</ThemedText>
      <View
        {...pan.panHandlers}
        style={styles.handle}
        accessibilityRole="adjustable"
        accessibilityLabel={`${category.label} verschieben`}>
        <ThemedText style={styles.handleIcon}>⠿</ThemedText>
      </View>
    </Animated.View>
  );
}

interface Props {
  isOpen: boolean;
  store: Store | null;
  onClose: () => void;
}

/**
 * Marktspezifische Laufstrecke per Drag&Drop bearbeiten (ersetzt die
 * fruehere binaere "Reihenfolge umkehren"). Gespeichert auf
 * `stores.category_order`, damit die Reihenfolge — wie der Markt selbst —
 * automatisch haushaltsweit synchron ist.
 *
 * Handgebaute Drag-Liste statt einer Zusatz-Library: Nur 12 Zeilen, dafuer
 * reicht react-native's eigener PanResponder + Animated.
 */
export function CategoryOrderSheet({ isOpen, store, onClose }: Props) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheet>(null);

  const [order, setOrder] = useState<ShoppingCategory[]>(() => resolveOrder(store));
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const startIndexRef = useRef(0);
  const orderRef = useRef(order);
  orderRef.current = order;
  const translateY = useRef(new Animated.Value(0)).current;

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

  function handleDragStart(index: number) {
    draggingIndexRef.current = index;
    startIndexRef.current = index;
    setDraggingIndex(index);
    translateY.setValue(0);
  }

  function handleDragMove(dy: number) {
    const currentIndex = draggingIndexRef.current;
    if (currentIndex === null) return;

    const shift = Math.round(dy / ROW_HEIGHT);
    const targetIndex = Math.min(
      Math.max(startIndexRef.current + shift, 0),
      orderRef.current.length - 1,
    );

    if (targetIndex !== currentIndex) {
      setOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
      draggingIndexRef.current = targetIndex;
      setDraggingIndex(targetIndex);
    }

    translateY.setValue(dy - (targetIndex - startIndexRef.current) * ROW_HEIGHT);
  }

  function handleDragEnd() {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    draggingIndexRef.current = null;
    setDraggingIndex(null);
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
      <BottomSheetView style={styles.sheetContent}>
        <View style={styles.header}>
          <ThemedText type="title">Reihenfolge bearbeiten</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {store?.name ?? ''} — am Griff ⠿ ziehen
          </ThemedText>
        </View>

        <View style={styles.list}>
          {order.map((category, index) => (
            <Row
              key={category.id}
              category={category}
              index={index}
              isDragging={draggingIndex === index}
              translateY={translateY}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={handleReset} accessibilityRole="button" style={styles.resetLink}>
            <ThemedText type="small" themeColor="textSecondary">
              Auf Standard zurücksetzen
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={saveMutation.isPending}
            accessibilityRole="button"
            style={[styles.saveButton, { backgroundColor: store?.color ?? theme.accent }]}>
            <ThemedText style={styles.saveButtonText}>Speichern</ThemedText>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  header: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: 2,
  },
  list: {
    gap: 0,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    ...FontSize[15],
  },
  handle: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  handleIcon: {
    ...FontSize[20],
    opacity: 0.5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  resetLink: {
    paddingVertical: Spacing.two,
  },
  saveButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.card,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    ...FontSize[15],
  },
});
