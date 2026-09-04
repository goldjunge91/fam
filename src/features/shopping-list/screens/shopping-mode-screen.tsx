import { memo, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Txt } from '@/constants/ui';
import { formatEuro } from '@/lib/format-currency';
import { formatAmount } from '@/lib/package-size';
import { colorForCategory, parseCategoryOrder } from '../domain-logik/shopping-categories';
import { groupByCategory, type LocalShoppingItem } from '../hooks/use-shopping-list';
import type { Store } from '../hooks/use-stores';

type ShoppingModeRowProps = {
  item: LocalShoppingItem;
  onToggle: (item: LocalShoppingItem) => void;
};

export const ShoppingModeRow = memo(function ShoppingModeRow({
  item,
  onToggle,
}: ShoppingModeRowProps) {
  const isChecked = item.checked_at !== null;
  const handlePress = useCallback(() => {
    onToggle(item);
  }, [item, onToggle]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      accessibilityLabel={item.name}
      className="shopping-mode-row">
      <View className={`checkbox-base ${isChecked ? 'checkbox-checked' : 'checkbox-unchecked'}`}>
        {isChecked ? (
          <Txt variant="caption" tone="onAccent">
            ✓
          </Txt>
        ) : null}
      </View>
      <Txt
        variant="body"
        className={`flex-1 ${isChecked ? 'line-through opacity-50' : ''}`}
        numberOfLines={1}>
        {item.name}
      </Txt>
      <Txt variant="body" tone="secondary" className="w-[84px] text-right" numberOfLines={1}>
        {formatAmount(item.quantity, item.unit)}
      </Txt>
      <Txt variant="caption" tone="secondary" className="w-[52px] text-right" numberOfLines={1}>
        {item.price_estimate != null ? formatEuro(item.price_estimate) : ''}
      </Txt>
    </Pressable>
  );
});

type ShoppingModeScreenProps = {
  visible: boolean;
  store: Store;
  items: LocalShoppingItem[];
  onToggle: (item: LocalShoppingItem) => void;
  onClose: () => void;
  /** Schliesst den Einkaufsmodus und oeffnet direkt den Abschluss-Dialog. */
  onFinish: () => void;
};

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

  const toggleCollapse = useCallback((categoryId: string, isComplete: boolean) => {
    setCollapsedOverrides((prev) => ({
      ...prev,
      [categoryId]: !(prev[categoryId] ?? isComplete),
    }));
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen">
      {}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
          <View className="row-between px-three pt-two pb-two">
            <View className="flex-row items-center gap-two">
              <View
                className="w-[9px] h-[9px] rounded-full"
                style={{ backgroundColor: store.color }}
              />
              <Txt variant="body" weight="700">
                {store.name}
              </Txt>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Einkaufsmodus schließen"
              hitSlop={8}
              className="btn-header-icon">
              <Txt>✕</Txt>
            </Pressable>
          </View>

          <View className="px-three pb-three gap-[6px]">
            <ProgressBar value={totalCount > 0 ? checkedCount / totalCount : 0} />
            <View className="row-between">
              <Txt variant="caption" tone="secondary">
                {checkedCount} / {totalCount} abgehakt
              </Txt>
              <Txt variant="caption" tone="secondary">
                {formatEuro(totalEstimate)}
              </Txt>
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
                    {/* Kategorie-Farbe an Punkt, Name und Zähler — nur der
                        getönte Hintergrund/Rand ist raus (passte nicht). */}
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <Txt
                      variant="caption"
                      className="flex-1 uppercase tracking-wider"
                      weight="700"
                      style={{ color }}>
                      {group.category}
                    </Txt>
                    <Txt variant="caption" style={{ color }}>
                      {catChecked}/{catItems.length}
                      {isComplete ? ' ✓' : ''}
                    </Txt>
                    <Txt style={{ color, transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] }}>
                      ⌄
                    </Txt>
                  </Pressable>

                  {!collapsed &&
                    catItems.map((item) => (
                      <ShoppingModeRow key={item.id} item={item} onToggle={onToggle} />
                    ))}
                </View>
              );
            })}
          </ScrollView>

          {/* Abschließen geht mit jeder Anzahl abgehakter Artikel — im Laden
              findet man selten wirklich alles, das darf kein Blocker sein. */}
          {checkedCount > 0 ? (
            <View className="px-three pb-two">
              <Pressable
                onPress={onFinish}
                accessibilityRole="button"
                accessibilityLabel={`Einkauf abschließen, ${checkedCount} von ${totalCount} abgehakt`}
                className="btn-success"
                style={{ backgroundColor: store.color }}>
                <Txt variant="body" weight="700" tone="onAccent">
                  🛒 Einkauf abschließen ({checkedCount})
                </Txt>
              </Pressable>
            </View>
          ) : null}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
