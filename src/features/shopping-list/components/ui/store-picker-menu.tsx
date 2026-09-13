import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius, space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { Txt } from '@/constants/ui';
import type { Store } from '../../hooks/use-stores';

export const ALL_FILTER = 'all';
export const UNASSIGNED_FILTER = 'unassigned';

// Gleiche Vertikal-/Horizontal-Skala wie der kompakte "+ Artikel
// hinzufügen"-Button (size="compact" -> py-two px-three), damit beide
// Buttons in der Kopfzeile dieselbe Hoehe haben.
const GLASS_STYLE = {
  borderRadius: 999,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  paddingHorizontal: 16,
  paddingVertical: 8,
};

const styles = StyleSheet.create((theme) => ({
  activeDot: {
    width: 8,
    height: 8,
    flexShrink: 0,
    borderRadius: 4,
  },
  activeLabel: {
    maxWidth: 130,
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    width: 200,
    gap: 2,
    padding: theme.space.xs,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.background,
    overflow: 'hidden',
    ...theme.shadow.lg,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  rowActive: {
    backgroundColor: theme.backgroundSoft,
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
        ? theme.textMuted
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
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={t('shoppingList.storePickerMenu.filterAccessibility', {
            current: activeLabel,
          })}
          fallbackStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.backgroundElement,
          }}
          glassStyle={GLASS_STYLE}
          outerStyle={{ borderRadius: 999 }}>
          <View style={[styles.activeDot, { backgroundColor: activeDotColor }]} />
          <Txt variant="body" weight="700" numberOfLines={1} style={styles.activeLabel}>
            {activeLabel}
          </Txt>
        </GlassCard>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          {anchor && (
            <View
              style={[
                styles.panel,
                { position: 'absolute', top: anchor.y + anchor.height + 6, left: anchor.x },
              ]}>
              <Pressable
                onPress={() => select(ALL_FILTER)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: activeFilter === ALL_FILTER }}
                style={[styles.row, activeFilter === ALL_FILTER && styles.rowActive]}>
                <View style={[styles.activeDot, { backgroundColor: theme.text }]} />
                <Txt variant="body" weight="600" style={styles.rowLabel}>
                  {t('shoppingList.storePickerMenu.allLists')}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {totalCount}
                </Txt>
              </Pressable>

              {stores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() => select(store.id)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: activeFilter === store.id }}
                  style={[styles.row, activeFilter === store.id && styles.rowActive]}>
                  <View style={[styles.activeDot, { backgroundColor: store.color }]} />
                  <Txt variant="body" weight="600" numberOfLines={1} style={styles.rowLabel}>
                    {store.name}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    {countForStore(store.id)}
                  </Txt>
                </Pressable>
              ))}

              <Pressable
                onPress={() => select(UNASSIGNED_FILTER)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: activeFilter === UNASSIGNED_FILTER }}
                style={[styles.row, activeFilter === UNASSIGNED_FILTER && styles.rowActive]}>
                <View style={[styles.activeDot, { backgroundColor: theme.textMuted }]} />
                <Txt variant="body" weight="600" style={styles.rowLabel}>
                  {t('shoppingList.storePickerMenu.unassigned')}
                </Txt>
                <Txt variant="caption" tone="secondary">
                  {unassignedCount}
                </Txt>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
