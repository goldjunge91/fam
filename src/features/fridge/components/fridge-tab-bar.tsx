import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CompactActionButton } from '@/components/ui/buttons/compact-action-button';
import { withAlpha } from '@/constants/theme';
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
    if (id !== activeTab) onTabChange(id);
    setIsOpen(false);
  }

  return (
    <View className="fridge-tab-bar-container">
      <CompactActionButton
        label={activeLocation?.name ?? 'Lagerort auswählen'}
        accessibilityLabel={`Lagerort auswählen, aktuell ${activeLocation?.name ?? 'keiner'}`}
        expanded={isOpen}
        onPress={() => setIsOpen((current) => !current)}
      />

      {isOpen ? (
        <View
          accessibilityRole="menu"
          className="fridge-tab-bar-menu"
          // boxShadow (dynamische Opazitaet), borderCurve (kein Tailwind-
          // Aequivalent) und elevation (Android-Schatten) sind echte
          // Laufzeit-/Plattform-Werte.
          style={{
            boxShadow: `0 10px 28px ${withAlpha(theme.shadowSheet, 0.18)}`,
            borderCurve: 'continuous',
            elevation: 8,
          }}>
          {options.map((location, index) => {
            const selected = location.id === activeTab;
            return (
              <Pressable
                key={location.id}
                accessibilityRole="menuitem"
                accessibilityLabel={location.name}
                accessibilityState={{ selected }}
                onPress={() => selectLocation(location.id)}
                className={`fridge-tab-bar-option ${index > 0 ? 'fridge-tab-bar-option-bordered' : ''} ${
                  selected ? 'bg-background-selected' : ''
                }`}>
                <ThemedText type="default" className={selected ? 'font-bold' : ''}>
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
