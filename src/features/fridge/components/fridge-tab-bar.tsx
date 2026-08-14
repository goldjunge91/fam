import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CompactActionButton } from '@/components/ui/buttons/compact-action-button';
import { Spacing } from '@/constants/theme';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';

interface FridgeTabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  locations: StorageLocation[];
}

export function FridgeTabBar({ activeTab, onTabChange, locations }: FridgeTabBarProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const options = [{ id: 'all', name: 'Alle' }, ...locations];
  const activeLocation = options.find((location) => location.id === activeTab);

  function selectLocation(id: string) {
    onTabChange(id);
    setIsOpen(false);
  }

  return (
    <View style={styles.container}>
      <CompactActionButton
        label={activeLocation?.name ?? 'Lagerort auswählen'}
        accessibilityLabel={`Lagerort auswählen, aktuell ${activeLocation?.name ?? 'keiner'}`}
        expanded={isOpen}
        onPress={() => setIsOpen((current) => !current)}
      />

      {isOpen ? (
        <View
          accessibilityRole="menu"
          style={[
            styles.menu,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          {options.map((location, index) => {
            const selected = location.id === activeTab;
            return (
              <Pressable
                key={location.id}
                accessibilityRole="menuitem"
                accessibilityLabel={location.name}
                accessibilityState={{ selected }}
                onPress={() => selectLocation(location.id)}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 && {
                    borderTopColor: theme.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                  selected && { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="default" style={selected ? styles.selectedLabel : undefined}>
                  {location.name}
                </ThemedText>
                {selected ? <ThemedText themeColor="accent">✓</ThemedText> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 30,
  },
  menu: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0 10px 28px rgba(42, 32, 44, 0.18)',
    elevation: 8,
  },
  option: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.72,
  },
  selectedLabel: {
    fontWeight: 700,
  },
});
