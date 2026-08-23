import { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { useTheme } from '@/hooks/use-theme';
import type { Store } from '../../hooks/use-stores';

export const ALL_FILTER = 'all';
export const UNASSIGNED_FILTER = 'unassigned';

// Entspricht der Hoehe des kompakten Hinzufuegen-Buttons im Header.
const GLASS_STYLE = {
  borderRadius: 999,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  paddingHorizontal: 16,
  paddingVertical: 8,
};

type Anchor = { x: number; y: number; height: number };

type StorePickerMenuProps = {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  stores: Store[];
  totalCount: number;
  unassignedCount: number;
  countForStore: (storeId: string) => number;
};

/**
 * Das Modal stellt das Menue ueber den Listeneintraegen dar; ein absolut
 * positioniertes View kann plattformabhaengig darunter liegen.
 */
export function StorePickerMenu({
  activeFilter,
  onFilterChange,
  stores,
  totalCount,
  unassignedCount,
  countForStore,
}: StorePickerMenuProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anchorRef = useRef<View>(null);
  const theme = useTheme();
  const open = anchor !== null;

  const activeStore = stores.find((store) => store.id === activeFilter) ?? null;
  const activeLabel =
    activeFilter === ALL_FILTER
      ? 'Alle Listen'
      : activeFilter === UNASSIGNED_FILTER
        ? 'Ohne Markt'
        : (activeStore?.name ?? 'Alle Listen');
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
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`Markt filtern, aktuell: ${activeLabel}`}
          fallbackClassName="store-picker-btn"
          glassStyle={GLASS_STYLE}
          outerStyle={{ borderRadius: 999 }}>
          <View className="store-picker-dot" style={{ backgroundColor: activeDotColor }} />
          <ThemedText type="smallBold" numberOfLines={1} className="max-w-[130px]">
            {activeLabel}
          </ThemedText>
        </GlassCard>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable className="store-picker-backdrop" onPress={closeMenu}>
          {anchor && (
            <View
              className="store-picker-panel"
              style={{ position: 'absolute', top: anchor.y + anchor.height + 6, left: anchor.x }}>
              <Pressable
                onPress={() => select(ALL_FILTER)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: activeFilter === ALL_FILTER }}
                className={`store-picker-row ${
                  activeFilter === ALL_FILTER ? 'store-picker-row-active' : ''
                }`}>
                <View className="store-picker-dot" style={{ backgroundColor: theme.text }} />
                <ThemedText type="small" className="flex-1 font-semibold">
                  Alle Listen
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {totalCount}
                </ThemedText>
              </Pressable>

              {stores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() => select(store.id)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: activeFilter === store.id }}
                  className={`store-picker-row ${
                    activeFilter === store.id ? 'store-picker-row-active' : ''
                  }`}>
                  <View className="store-picker-dot" style={{ backgroundColor: store.color }} />
                  <ThemedText type="small" numberOfLines={1} className="flex-1 font-semibold">
                    {store.name}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {countForStore(store.id)}
                  </ThemedText>
                </Pressable>
              ))}

              {unassignedCount > 0 && (
                <Pressable
                  onPress={() => select(UNASSIGNED_FILTER)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: activeFilter === UNASSIGNED_FILTER }}
                  className={`store-picker-row ${
                    activeFilter === UNASSIGNED_FILTER ? 'store-picker-row-active' : ''
                  }`}>
                  <View
                    className="store-picker-dot"
                    style={{ backgroundColor: theme.textSecondary }}
                  />
                  <ThemedText type="small" className="flex-1 font-semibold">
                    Ohne Markt
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {unassignedCount}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
