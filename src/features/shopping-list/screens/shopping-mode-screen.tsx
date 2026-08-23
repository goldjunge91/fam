import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { ThemedText } from '@/components/theme/themed-text';
import { ProgressBar } from '@/components/ui/progress-bar';
import { formatEuro } from '@/lib/format-currency';
import { formatAmount } from '@/lib/package-size';
import { colorForCategory, parseCategoryOrder } from '../domain-logik/shopping-categories';
import { groupByCategory, type LocalShoppingItem } from '../hooks/use-shopping-list';
import type { Store } from '../hooks/use-stores';

type ShoppingModeScreenProps = {
  visible: boolean;
  store: Store;
  items: LocalShoppingItem[];
  onToggle: (item: LocalShoppingItem) => void;
  onClose: () => void;
  onFinish: () => void;
};

/**
 * Vollbildmodus ohne Bearbeiten-Aktionen. Vollstaendige Kategorien klappen
 * automatisch ein, manuelle Overrides bleiben erhalten. Ein Treffer genuegt zum Abschluss.
 */
export function ShoppingModeScreen({
  visible,
  store,
  items,
  onToggle,
  onClose,
  onFinish,
}: ShoppingModeScreenProps) {
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => groupByCategory(items, parseCategoryOrder(store.category_order)),
    [items, store.category_order],
  );

  const totalCount = items.length;
  const checkedCount = items.filter((i) => i.checked_at !== null).length;
  const totalEstimate = items.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0);

  function toggleCollapse(categoryId: string, isComplete: boolean) {
    setCollapsedOverrides((prev) => ({
      ...prev,
      [categoryId]: !(prev[categoryId] ?? isComplete),
    }));
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen">
      {/* Native iOS-Modals erben die Insets des app-weiten Providers nicht. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
          <View className="row-between px-three pt-two pb-two">
            <View className="flex-row items-center gap-two">
              <View
                className="w-[9px] h-[9px] rounded-full"
                style={{ backgroundColor: store.color }}
              />
              <ThemedText type="smallBold">{store.name}</ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Einkaufsmodus schließen"
              hitSlop={8}
              className="btn-header-icon">
              <ThemedText>✕</ThemedText>
            </Pressable>
          </View>

          <View className="px-three pb-three gap-[6px]">
            <ProgressBar value={totalCount > 0 ? checkedCount / totalCount : 0} />
            <View className="row-between">
              <ThemedText type="captionMuted">
                {checkedCount} / {totalCount} abgehakt
              </ThemedText>
              <ThemedText type="captionMuted">{formatEuro(totalEstimate)}</ThemedText>
            </View>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-six"
            showsVerticalScrollIndicator={false}>
            {groups.map((group) => {
              const catItems = group.items;
              const catChecked = catItems.filter((i) => i.checked_at !== null).length;
              const isComplete = catItems.length > 0 && catChecked === catItems.length;
              const collapsed = collapsedOverrides[group.category] ?? isComplete;
              const color = colorForCategory(group.category) ?? '#786F79';

              return (
                <View key={group.category}>
                  <Pressable
                    onPress={() => toggleCollapse(group.category, isComplete)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !collapsed }}
                    accessibilityLabel={`${group.category}, ${catChecked} von ${catItems.length}${
                      collapsed ? ', eingeklappt' : ', aufgeklappt'
                    }`}
                    className="shopping-mode-cat-head">
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <ThemedText
                      type="captionCompact"
                      className="flex-1 font-bold uppercase tracking-wider"
                      style={{ color }}>
                      {group.category}
                    </ThemedText>
                    <ThemedText type="captionCompact" style={{ color }}>
                      {catChecked}/{catItems.length}
                      {isComplete ? ' ✓' : ''}
                    </ThemedText>
                    <ThemedText
                      style={{ color, transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
                      ⌄
                    </ThemedText>
                  </Pressable>

                  {!collapsed &&
                    catItems.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => onToggle(item)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: item.checked_at !== null }}
                        accessibilityLabel={item.name}
                        className="shopping-mode-row">
                        <View
                          className={`checkbox-base ${
                            item.checked_at ? 'checkbox-checked' : 'checkbox-unchecked'
                          }`}>
                          {item.checked_at ? (
                            <ThemedText type="detail" themeColor="onAccent">
                              ✓
                            </ThemedText>
                          ) : null}
                        </View>
                        <ThemedText
                          type="small"
                          className={`flex-1 ${item.checked_at ? 'line-through opacity-50' : ''}`}
                          numberOfLines={1}>
                          {item.name}
                        </ThemedText>
                        <ThemedText
                          type="smallMuted"
                          className="w-[84px] text-right"
                          numberOfLines={1}>
                          {formatAmount(item.quantity, item.unit)}
                        </ThemedText>
                        <ThemedText
                          type="captionMuted"
                          className="w-[52px] text-right"
                          numberOfLines={1}>
                          {item.price_estimate != null ? formatEuro(item.price_estimate) : ''}
                        </ThemedText>
                      </Pressable>
                    ))}
                </View>
              );
            })}
          </ScrollView>

          {checkedCount > 0 ? (
            <View className="px-three pb-two">
              <Pressable
                onPress={onFinish}
                accessibilityRole="button"
                accessibilityLabel={`Einkauf abschließen, ${checkedCount} von ${totalCount} abgehakt`}
                className="btn-success"
                style={{ backgroundColor: store.color }}>
                <ThemedText type="bodyBold" className="text-white">
                  🛒 Einkauf abschließen ({checkedCount})
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
