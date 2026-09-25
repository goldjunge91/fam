import { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radius } from '@/components/theme/index';
import { GlassCard } from '@/components/ui/glass-card';
import { Press, Txt } from '@/constants/ui';
import { uiShadowStyles } from '@/constants/ui-shadow';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';

interface InventoryTabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  locations: StorageLocation[];
}

type MenuPosition = { top: number; left: number; width: number };

const FALLBACK_MENU_POSITION: MenuPosition = { top: 0, left: 0, width: 220 };

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    position: 'relative',
    zIndex: 30,
  },
  triggerOuter: {
    flex: 1,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // GlassView has no CSS interop; keep the original 8/14/15pt geometry.
    gap: theme.space.sm,
    paddingHorizontal: theme.space.md + 2,
    paddingVertical: theme.space.lg - 1,
  },
  triggerFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.md + 2,
    paddingVertical: theme.space.lg - 1,
  },
  chevron: {
    width: 10,
    height: 6,
  },
  chevronLine: {
    position: 'absolute',
    top: 2,
    width: 6,
    height: 1.5,
    borderRadius: radius.micro,
    backgroundColor: theme.textSecondary,
  },
  chevronLeft: {
    left: 0,
    transform: [{ rotate: '38deg' }],
  },
  chevronRight: {
    right: 0,
    transform: [{ rotate: '-38deg' }],
  },
  overlay: {
    flex: 1,
  },
  menu: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: StyleSheet.hairlineWidth,
    // Keep the retired control-lg geometry (14pt) in the central radius scale.
    borderRadius: theme.radius.sm + 2,
    overflow: 'hidden',
  },
  option: {
    minHeight: 44,
    paddingHorizontal: theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionBorder: {
    borderTopColor: theme.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionSelected: {
    backgroundColor: theme.accent,
  },
}));

export function InventoryTabBar({ activeTab, onTabChange, locations }: InventoryTabBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>(FALLBACK_MENU_POSITION);
  const triggerRef = useRef<View>(null);
  const options = [{ id: 'all', name: 'Alle' }, ...locations];
  const activeLocation = options.find((location) => location.id === activeTab);

  function toggleMenu() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    // Absolute Fensterkoordinaten statt eines relativ positionierten Panels:
    // dieses Dropdown steckt seit dem Performance-Umbau (#71) in der
    // Kopfzeile der Vorratsliste, deren `z-index` nur innerhalb desselben Eltern-
    // Containers wirkt — gegen die separat gerenderten Listenzeilen darunter
    // setzt es sich sonst nicht durch. Das Modal rendert unabhaengig davon
    // immer zuoberst. Sichtbarkeit haengt bewusst nicht an der Messung —
    // die laeuft asynchron nach und schlaegt in Tests (kein natives Layout)
    // ganz aus.
    triggerRef.current?.measureInWindow((x, y, _width, height) => {
      setMenuPosition({ top: y + height + 4, left: x, width: 220 });
    });
    setIsOpen(true);
  }

  function selectLocation(id: string) {
    if (id !== activeTab) onTabChange(id);
    setIsOpen(false);
  }

  return (
    <View ref={triggerRef} style={styles.container}>
      <GlassCard
        shadow="floatingControl"
        shape="control"
        outerStyle={styles.triggerOuter}
        glassStyle={styles.trigger}
        fallbackStyle={styles.triggerFallback}
        onPress={toggleMenu}
        accessibilityRole="button"
        accessibilityLabel={`Lagerort auswählen, aktuell ${activeLocation?.name ?? 'keiner'}`}>
        <Txt variant="body" weight="700">
          {activeLocation?.name ?? 'Lagerort auswählen'}
        </Txt>
        {}
        <View style={[styles.chevron, { transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }]}>
          <View style={[styles.chevronLine, styles.chevronLeft]} />
          <View style={[styles.chevronLine, styles.chevronRight]} />
        </View>
      </GlassCard>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        {/* The full-screen scrim is a native dismiss target, not a visible action;
            Press would add haptics and scale feedback to the backdrop. */}
        <Pressable
          style={styles.overlay}
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
          onPress={() => setIsOpen(false)}>
          {isOpen ? (
            <View
              accessibilityRole="menu"
              style={[
                styles.menu,
                uiShadowStyles.floatingPanelBottom,
                {
                  position: 'absolute',
                  top: menuPosition.top,
                  left: menuPosition.left,
                  width: menuPosition.width,
                  borderCurve: 'continuous',
                },
              ]}>
              {options.map((location, index) => {
                const selected = location.id === activeTab;
                return (
                  <Press
                    key={location.id}
                    haptic="selection"
                    accessibilityRole="menuitem"
                    accessibilityLabel={location.name}
                    accessibilityState={{ selected }}
                    onPress={() => selectLocation(location.id)}
                    style={[
                      styles.option,
                      index > 0 && styles.optionBorder,
                      selected && styles.optionSelected,
                    ]}>
                    <Txt
                      variant="body"
                      weight={selected ? '700' : '400'}
                      tone={selected ? 'onAccent' : 'primary'}>
                      {location.name}
                    </Txt>
                    {selected ? <Txt tone="onAccent">✓</Txt> : null}
                  </Press>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
