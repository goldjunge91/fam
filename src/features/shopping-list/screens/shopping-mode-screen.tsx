import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Press, Row, Surface, Txt } from '@/constants/ui';
import { formatEuro } from '@/lib/format/format-currency';
import { formatAmount } from '@/lib/format/package-size';
import { shoppingListStyles } from '../components/ui/shopping-list-styles';
import { colorForCategory, parseCategoryOrder } from '../domain-logik/shopping-categories';
import { groupByCategory, type LocalShoppingItem } from '../hooks/use-shopping-list';
import type { Store } from '../hooks/use-stores';

const screenStyles = StyleSheet.create((theme) => ({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.sm,
  },
  storeName: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeDot: {
    width: 9,
    height: 9,
    borderRadius: radius.xs,
  },
  progress: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.lg,
    gap: space.md,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 64,
  },
  finishFooter: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.sm,
  },
  finishButton: {
    width: '100%',
    minHeight: 44,
    paddingVertical: theme.space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
}));

type ShoppingModeRowProps = {
  item: LocalShoppingItem;
  onToggle: (item: LocalShoppingItem) => void;
};

export const ShoppingModeRow = memo(function ShoppingModeRow({
  item,
  onToggle,
}: ShoppingModeRowProps) {
  const styles = shoppingListStyles;
  const isChecked = item.checked_at !== null;
  const handlePress = useCallback(() => {
    onToggle(item);
  }, [item, onToggle]);

  return (
    <Press
      onPress={handlePress}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isChecked }}
      accessibilityLabel={item.name}
      style={styles.modeRow}>
      <View
        style={[styles.checkbox, isChecked ? styles.checkboxSelected : styles.checkboxUnselected]}>
        {isChecked ? (
          <Txt variant="caption" tone="onAccent">
            ✓
          </Txt>
        ) : null}
      </View>
      <Txt
        variant="body"
        weight="500"
        style={[styles.name, isChecked && styles.checkedName]}
        numberOfLines={1}>
        {item.name}
      </Txt>
      <View style={styles.trailingMeta}>
        <Txt variant="body" tone="primary" weight="600" style={styles.quantity} numberOfLines={1}>
          {formatAmount(item.quantity, item.unit)}
        </Txt>
        {item.price_estimate != null ? (
          <Txt variant="caption" tone="secondary" style={styles.price} numberOfLines={1}>
            {formatEuro(item.price_estimate)}
          </Txt>
        ) : null}
      </View>
    </Press>
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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = shoppingListStyles;
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
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Surface tone="page" style={screenStyles.safeArea}>
          <SafeAreaView style={screenStyles.safeArea} edges={['top', 'bottom']}>
            <Row justify="space-between" style={screenStyles.header}>
              <Row gap={space.sm} style={screenStyles.storeName}>
                <View style={[screenStyles.storeDot, { backgroundColor: store.color }]} />
                <Txt variant="body" weight="700">
                  {store.name}
                </Txt>
              </Row>
              <HeaderIconButton
                onPress={onClose}
                hitSlop={8}
                label={t('shoppingList.shoppingMode.close')}>
                <Txt>✕</Txt>
              </HeaderIconButton>
            </Row>

            <View style={screenStyles.progress}>
              <ProgressBar value={totalCount > 0 ? checkedCount / totalCount : 0} />
              <Row justify="space-between" style={screenStyles.progressMeta}>
                <Txt variant="caption" tone="secondary">
                  {t('shoppingList.shoppingMode.checkedOfTotal', {
                    checked: checkedCount,
                    total: totalCount,
                  })}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {formatEuro(totalEstimate)}
                </Txt>
              </Row>
            </View>

            <ScrollView
              style={screenStyles.list}
              contentContainerStyle={screenStyles.listContent}
              showsVerticalScrollIndicator={false}>
              {groups.map((group) => {
                const catItems = group.items;
                const catChecked = catItems.filter((i) => i.checked_at !== null).length;
                const isComplete = catItems.length > 0 && catChecked === catItems.length;
                const collapsed = collapsedOverrides[group.category] ?? isComplete;
                const color = colorForCategory(group.category) ?? colors.textSecondary;

                return (
                  <View key={group.category}>
                    <Press
                      onPress={() => toggleCollapse(group.category, isComplete)}
                      haptic="selection"
                      accessibilityRole="button"
                      accessibilityState={{ expanded: !collapsed }}
                      accessibilityLabel={t('shoppingList.shoppingMode.categoryAccessibility', {
                        category: group.category,
                        checked: catChecked,
                        total: catItems.length,
                        state: collapsed
                          ? t('shoppingList.shoppingMode.categoryCollapsed')
                          : t('shoppingList.shoppingMode.categoryExpanded'),
                      })}
                      style={styles.modeCategoryHeader}>
                      {/* Kategorie-Farbe an Punkt, Name und Zähler — nur der
                        getönte Hintergrund/Rand ist raus (passte nicht). */}
                      <View style={[styles.modeCategoryDot, { backgroundColor: color }]} />
                      <Txt variant="label" weight="700" tone="primary" style={styles.categoryName}>
                        {group.category}
                      </Txt>
                      <Txt variant="label" tone="primary" weight="600">
                        {catChecked}/{catItems.length}
                        {isComplete ? ' ✓' : ''}
                      </Txt>
                      <Txt
                        variant="subheading"
                        tone="primary"
                        style={[
                          styles.categoryChevron,
                          { transform: [{ rotate: collapsed ? '-90deg' : '0deg' }] },
                        ]}>
                        ⌄
                      </Txt>
                    </Press>

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
              <View style={screenStyles.finishFooter}>
                <Press
                  onPress={onFinish}
                  haptic="success"
                  accessibilityRole="button"
                  accessibilityLabel={t('shoppingList.shoppingMode.finishAccessibility', {
                    checked: checkedCount,
                    total: totalCount,
                  })}
                  style={[screenStyles.finishButton, { backgroundColor: store.color }]}>
                  <Txt variant="body" weight="700" tone="onAccent">
                    {t('shoppingList.shoppingMode.finish', { count: checkedCount })}
                  </Txt>
                </Press>
              </View>
            ) : null}
          </SafeAreaView>
        </Surface>
      </SafeAreaProvider>
    </Modal>
  );
}
