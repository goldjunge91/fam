import { Host } from '@expo/ui';
import { BottomSheet, Group, RNHostView } from '@expo/ui/swift-ui';
import { presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import ReorderableList, {
  type ReorderableListReorderEvent,
  reorderItems,
  useIsActive,
  useReorderableDrag,
} from 'react-native-reorderable-list';
import { StyleSheet } from 'react-native-unistyles';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Surface, Txt } from '@/constants/ui';
import { categorySurfaceColors } from '../components/category-surface-colors';
import {
  parseCategoryOrder,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
} from '../domain-logik/shopping-categories';
import { type Store, useSetStoreCategoryOrderMutation } from '../hooks/use-stores';

const styles = StyleSheet.create((theme) => ({
  sheetBackground: {
    backgroundColor: theme.background,
  },
  sheetIndicator: {
    backgroundColor: theme.border,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: theme.background,
  },
  nativeHost: {
    position: 'absolute',
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: theme.space.xxl,
  },
  row: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    borderRadius: theme.radius.md,
    marginVertical: theme.space.xs,
    paddingHorizontal: theme.space.md,
  },
  handle: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
  },
  header: {
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.lg,
    gap: theme.space.xs,
  },
  marketLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  marketDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    paddingVertical: theme.space.xxl,
  },
  resetButton: {
    minWidth: 44,
    minHeight: 44,
    paddingVertical: theme.space.sm,
  },
  saveButton: {
    minHeight: 44,
    paddingHorizontal: theme.space.xxl,
    paddingVertical: theme.space.lg,
    borderRadius: theme.radius.md,
  },
}));

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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  const categoryColors = categorySurfaceColors(category.color, colors);

  return (
    <Surface
      testID={`shopping-category-color-${category.id}`}
      tone={isActive ? 'surface' : 'page'}
      style={[styles.row, { backgroundColor: categoryColors.background }]}>
      <Txt variant="body" color={categoryColors.text} weight="600">
        {category.label}
      </Txt>
      <Press
        haptic="none"
        onPressIn={drag}
        style={styles.handle}
        accessibilityRole="adjustable"
        accessibilityLabel={t('shoppingList.categoryOrder.moveAccessibility', {
          category: category.label,
        })}>
        <Txt variant="heading" weight="700" color={categoryColors.text}>
          ⠿
        </Txt>
      </Press>
    </Surface>
  );
}

interface Props {
  isOpen: boolean;
  store: Store | null;
  onClose: () => void;
}

export function CategoryOrderSheet({ isOpen, store, onClose }: Props) {
  const { t } = useTranslation();
  const { colors: theme } = useTheme();

  const [order, setOrder] = useState<ShoppingCategory[]>(() => resolveOrder(store));

  const saveMutation = useSetStoreCategoryOrderMutation();

  // store bewusst nicht in den deps: nur beim Oeffnen neu initialisieren,
  // sonst wuerde ein Sync-Pull mitten im Draggen die Liste zuruecksetzen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: siehe Kommentar oben.
  useEffect(() => {
    if (isOpen) {
      setOrder(resolveOrder(store));
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

  if (!isOpen) return null;

  return (
    <Host
      testID="category-order-host"
      style={styles.nativeHost}
      seedColor={theme.accent}
      pointerEvents={isOpen ? 'auto' : 'none'}>
      <BottomSheet
        isPresented={isOpen}
        onIsPresentedChange={(presented) => {
          if (!presented && isOpen) onClose();
        }}>
        <Group
          modifiers={[
            presentationDetents([{ fraction: 0.7 }, { fraction: 0.9 }]),
            presentationDragIndicator('visible'),
          ]}>
          <RNHostView>
            <View style={styles.bottomSheet}>
              <ReorderableList
                data={order}
                keyExtractor={(category) => category.id}
                renderItem={({ item }) => <Row category={item} />}
                onReorder={handleReorder}
                shouldUpdateActiveItem
                autoscrollThreshold={0.2}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                  <View style={styles.header}>
                    <Txt variant="heading" weight="700">
                      {t('shoppingList.categoryOrder.title')}
                    </Txt>
                    <View style={styles.marketLabel}>
                      {store ? (
                        <View
                          testID="category-order-store-color"
                          style={[styles.marketDot, { backgroundColor: store.color }]}
                        />
                      ) : null}
                      <Txt variant="body" tone="secondary">
                        {t('shoppingList.categoryOrder.subtitle', { store: store?.name ?? '' })}
                      </Txt>
                    </View>
                  </View>
                }
                ListFooterComponent={
                  <View style={styles.footer}>
                    <Press
                      haptic="selection"
                      onPress={handleReset}
                      accessibilityRole="button"
                      style={styles.resetButton}>
                      <Txt variant="body" tone="secondary">
                        {t('shoppingList.categoryOrder.reset')}
                      </Txt>
                    </Press>
                    <Button
                      title={t('shoppingList.categoryOrder.save')}
                      haptic="success"
                      onPress={handleSave}
                      variant="primary"
                      flat
                      disabled={saveMutation.isPending}
                      style={styles.saveButton}
                    />
                  </View>
                }
              />
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}
