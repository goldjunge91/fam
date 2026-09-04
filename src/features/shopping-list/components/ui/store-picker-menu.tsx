import { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
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
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anchorRef = useRef<View>(null);
  const { colors: theme } = useTheme();
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
          accessibilityLabel={`Markt filtern, aktuell: ${activeLabel}`}
          fallbackClassName="store-picker-btn"
          glassStyle={GLASS_STYLE}
          outerStyle={{ borderRadius: 999 }}>
          <View className="store-picker-dot" style={{ backgroundColor: activeDotColor }} />
          <Txt variant="body" weight="700" numberOfLines={1} className="max-w-[130px]">
            {activeLabel}
          </Txt>
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
                <Txt variant="body" weight="600" className="flex-1">
                  Alle Listen
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
                  className={`store-picker-row ${
                    activeFilter === store.id ? 'store-picker-row-active' : ''
                  }`}>
                  <View className="store-picker-dot" style={{ backgroundColor: store.color }} />
                  <Txt variant="body" weight="600" numberOfLines={1} className="flex-1">
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
                className={`store-picker-row ${
                  activeFilter === UNASSIGNED_FILTER ? 'store-picker-row-active' : ''
                }`}>
                <View className="store-picker-dot" style={{ backgroundColor: theme.textMuted }} />
                <Txt variant="body" weight="600" className="flex-1">
                  Ohne Markt
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
