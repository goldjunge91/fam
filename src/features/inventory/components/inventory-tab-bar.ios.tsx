import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BUTTON_DEPTH, type Palette, radius, shadow, space } from '@/components/theme/index';
import { useTheme, useThemedStyles } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';
import { medium as hapticMedium } from '@/lib/haptics';

interface InventoryTabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  locations: StorageLocation[];
}

type MenuPosition = { top: number; left: number; width: number };

const FALLBACK_MENU_POSITION: MenuPosition = { top: 0, left: 0, width: 220 };

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    trigger: {
      backgroundColor: colors.backgroundElement,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      borderCurve: 'continuous',
    },
    triggerOpen: {
      backgroundColor: colors.backgroundSoft,
      borderColor: colors.accent,
    },
    menu: {
      backgroundColor: colors.backgroundElement,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.md,
      borderCurve: 'continuous',
      overflow: 'hidden',
      ...shadow.lg,
    },
    optionBorder: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    optionSelected: {
      backgroundColor: colors.backgroundSoft,
    },
  });
}

export function InventoryTabBar({ activeTab, onTabChange, locations }: InventoryTabBarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [isOpen, setIsOpen] = useState(false);
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
    <View ref={triggerRef} className="w-1/2 shrink-0">
      <View
        style={{
          paddingBottom: BUTTON_DEPTH,
          borderRadius: radius.lg,
          backgroundColor: colors.backgroundSoft,
        }}>
        <Animated.View style={faceStyle}>
          <Pressable
            className="min-h-[54px] flex-row items-center justify-between px-three active:opacity-90"
            style={[styles.trigger, isOpen && styles.triggerOpen]}
            onPress={() => {
              hapticMedium();
              toggleMenu();
            }}
            onPressIn={() => {
              depth.value = withTiming(BUTTON_DEPTH, { duration: 60 });
            }}
            onPressOut={() => {
              depth.value = withSpring(0, { damping: 14, stiffness: 320, mass: 0.5 });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Lagerort auswählen, aktuell ${activeLocation?.name ?? 'keiner'}`}
            accessibilityState={{ expanded: isOpen }}>
            <Txt variant="body" weight="700">
              {activeLocation?.name ?? 'Lagerort auswählen'}
            </Txt>
            <Txt tone="accent">{isOpen ? '⌃' : '⌄'}</Txt>
          </Pressable>
        </Animated.View>
      </View>
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <Pressable
          style={{ flex: 1 }}
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
                  <Pressable
                    key={location.id}
                    className="min-h-[44px] flex-row items-center justify-between px-three"
                    style={[index > 0 && styles.optionBorder, selected && styles.optionSelected]}
                    accessibilityRole="menuitem"
                    accessibilityLabel={location.name}
                    accessibilityState={{ selected }}
                    onPress={() => selectLocation(location.id)}>
                    <Txt variant="body" weight={selected ? '700' : '400'}>
                      {location.name}
                    </Txt>
                    {selected ? <Txt tone="accent">✓</Txt> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
