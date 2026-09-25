import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { Card, Press, Txt } from '@/constants/ui';
import type { Store } from '../../hooks/use-stores';

export const ALL_FILTER = 'all';
export const UNASSIGNED_FILTER = 'unassigned';

const styles = StyleSheet.create((theme) => ({
  pickerLayout: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xs + theme.space.xs,
  },
  activeDot: {
    width: theme.space.sm,
    height: theme.space.sm,
    flexShrink: 0,
    borderRadius: theme.radius.pill,
  },
  activeLabel: {
    maxWidth: 130,
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    width: 200,
    gap: theme.space.xs / 2,
    padding: theme.space.xs,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
}));

type Anchor = { x: number; y: number; height: number };

type StorePickerMenuProps = {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  stores: Store[];
  totalCount: number;
  unassignedCount: number;
  countForStore: (storeId: string) => number;
};

export function StorePickerMenu({
  activeFilter,
  onFilterChange,
  stores,
  totalCount,
  unassignedCount,
  countForStore,
}: StorePickerMenuProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anchorRef = useRef<View>(null);
  const { colors: theme } = useTheme();
  const open = anchor !== null;

  const activeStore = stores.find((store) => store.id === activeFilter) ?? null;
  const activeLabel =
    activeFilter === ALL_FILTER
      ? t('shoppingList.storePickerMenu.allLists')
      : activeFilter === UNASSIGNED_FILTER
        ? t('shoppingList.storePickerMenu.unassigned')
        : (activeStore?.name ?? t('shoppingList.storePickerMenu.allLists'));
  const activeDotColor =
    activeFilter === ALL_FILTER
      ? theme.text
      : activeFilter === UNASSIGNED_FILTER
        ? theme.textSecondary
        : (activeStore?.color ?? theme.text);

  function openMenu() {
    anchorRef.current?.measureInWindow((x, y, _width, height) => setAnchor({ x, y, height }));
  }

  function closeMenu() {
    setAnchor(null);
  }

  function select(filter: string) {
    onFilterChange(filter);
    closeMenu();
  }

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <GlassCard
          shape="pill"
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={t('shoppingList.storePickerMenu.filterAccessibility', {
            current: activeLabel,
          })}
          fallbackStyle={styles.pickerLayout}
          glassStyle={styles.pickerLayout}>
          <View style={[styles.activeDot, { backgroundColor: activeDotColor }]} />
          <Txt variant="body" weight="700" numberOfLines={1} style={styles.activeLabel}>
            {activeLabel}
          </Txt>
        </GlassCard>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          {anchor && (
            <Card
              padded={false}
              style={[
                styles.panel,
                {
                  position: 'absolute',
                  top: anchor.y + anchor.height + space.sm - space.xs / 2,
                  left: anchor.x,
                },
              ]}>
              <Press
                onPress={() => select(ALL_FILTER)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: activeFilter === ALL_FILTER }}
                haptic="selection"
                selected={activeFilter === ALL_FILTER}
                style={styles.row}>
                <View style={[styles.activeDot, { backgroundColor: theme.text }]} />
                <Txt variant="body" weight="600" style={styles.rowLabel}>
                  {t('shoppingList.storePickerMenu.allLists')}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {totalCount}
                </Txt>
              </Press>

              {stores.map((store) => (
                <Press
                  key={store.id}
                  onPress={() => select(store.id)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: activeFilter === store.id }}
                  haptic="selection"
                  selected={activeFilter === store.id}
                  style={styles.row}>
                  <View style={[styles.activeDot, { backgroundColor: store.color }]} />
                  <Txt variant="body" weight="600" numberOfLines={1} style={styles.rowLabel}>
                    {store.name}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    {countForStore(store.id)}
                  </Txt>
                </Press>
              ))}

              <Press
                onPress={() => select(UNASSIGNED_FILTER)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: activeFilter === UNASSIGNED_FILTER }}
                haptic="selection"
                selected={activeFilter === UNASSIGNED_FILTER}
                style={styles.row}>
                <View style={[styles.activeDot, { backgroundColor: theme.textSecondary }]} />
                <Txt variant="body" weight="600" style={styles.rowLabel}>
                  {t('shoppingList.storePickerMenu.unassigned')}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {unassignedCount}
                </Txt>
              </Press>
            </Card>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
