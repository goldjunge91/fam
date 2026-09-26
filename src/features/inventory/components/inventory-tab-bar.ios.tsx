import { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { BUTTON_DEPTH, motion, space } from '@/components/theme/index';
import { PRESS_SPRING, Press, Txt } from '@/constants/ui';
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
    width: '50%',
    flexShrink: 0,
  },
  depth: {
    paddingBottom: BUTTON_DEPTH,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.border,
  },
  trigger: {
    minHeight: 54,
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
  },
  triggerOpen: {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.accent,
  },
  triggerPressed: {
    opacity: 0.9,
  },
  overlay: {
    flex: 1,
  },
  menu: {
    backgroundColor: theme.background,
    borderColor: theme.border,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
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
  const [triggerPressed, setTriggerPressed] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>(FALLBACK_MENU_POSITION);
  const triggerRef = useRef<View>(null);
  const depth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: depth.value }],
  }));
  const options = [{ id: 'all', name: 'Alle' }, ...locations];
  const activeLocation = options.find((location) => location.id === activeTab);

  function toggleMenu() {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPosition({ top: y + height + space.xs, left: x, width });
    });
    setIsOpen(true);
  }

  function selectLocation(id: string) {
    if (id !== activeTab) onTabChange(id);
    setIsOpen(false);
  }

  return (
    <View ref={triggerRef} style={styles.container}>
      <View style={styles.depth}>
        <Animated.View style={faceStyle}>
          <Press
            haptic="medium"
            scaleTo={1}
            style={[
              styles.trigger,
              isOpen && styles.triggerOpen,
              triggerPressed && styles.triggerPressed,
            ]}
            onPress={() => {
              toggleMenu();
            }}
            onPressIn={() => {
              setTriggerPressed(true);
              depth.value = withTiming(BUTTON_DEPTH, { duration: motion.pressIn });
            }}
            onPressOut={() => {
              setTriggerPressed(false);
              depth.value = withSpring(0, PRESS_SPRING);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Lagerort auswählen, aktuell ${activeLocation?.name ?? 'keiner'}`}
            accessibilityState={{ expanded: isOpen }}>
            <Txt variant="body" weight="700">
              {activeLocation?.name ?? 'Lagerort auswählen'}
            </Txt>
            <Txt tone="accent">{isOpen ? '⌃' : '⌄'}</Txt>
          </Press>
        </Animated.View>
      </View>
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
                {
                  position: 'absolute',
                  top: menuPosition.top,
                  left: menuPosition.left,
                  width: menuPosition.width,
                },
              ]}>
              {options.map((location, index) => {
                const selected = location.id === activeTab;

                return (
                  <Press
                    key={location.id}
                    haptic="selection"
                    style={[
                      styles.option,
                      index > 0 && styles.optionBorder,
                      selected && styles.optionSelected,
                    ]}
                    accessibilityRole="menuitem"
                    accessibilityLabel={location.name}
                    accessibilityState={{ selected }}
                    onPress={() => selectLocation(location.id)}>
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
