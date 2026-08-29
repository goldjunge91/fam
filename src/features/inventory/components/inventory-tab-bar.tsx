import { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ThemedText } from '@/components/theme/themed-text';
import { GlassCard } from '@/components/ui/glass-card';
import { withAlpha } from '@/constants/theme';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';
import { useTheme } from '@/hooks/use-theme';

interface InventoryTabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  locations: StorageLocation[];
}

type MenuPosition = { top: number; left: number; width: number };

const FALLBACK_MENU_POSITION: MenuPosition = { top: 0, left: 0, width: 220 };

// `GlassView` hat kein cssInterop (s. glass-card.tsx), deshalb hier als
// RN-Style statt Tailwind-Klasse — muss in Radius/Padding mit
// `.inventory-tab-bar-trigger` in global.css in Sync bleiben. Kapselform
// (999px) statt festem Radius: iOS 26+ rundet kompakte Liquid-Glass-Buttons
// ohnehin automatisch zur Kapsel — damit Fallback und echtes Glas gleich
// aussehen, uebernimmt der Fallback dieselbe Form (s. .inventory-search-field
// daneben, die aus demselben Grund ebenfalls rounded-full ist).
const TRIGGER_GLASS_STYLE = {
  borderRadius: 999,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  gap: 8,
  paddingHorizontal: 14,
  paddingVertical: 11,
};

export function InventoryTabBar({ activeTab, onTabChange, locations }: InventoryTabBarProps) {
  const theme = useTheme();
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
    <View ref={triggerRef} className="inventory-tab-bar-container">
      {/* Liquid Glass auf iOS 26+ (expo-glass-effect), sonst solide Karte
          wie vor der Umstellung — s. glass-card.tsx. */}
      <GlassCard
        outerStyle={{ borderRadius: 999 }}
        glassStyle={TRIGGER_GLASS_STYLE}
        fallbackClassName="inventory-tab-bar-trigger"
        onPress={toggleMenu}
        accessibilityRole="button"
        accessibilityLabel={`Lagerort auswählen, aktuell ${activeLocation?.name ?? 'keiner'}`}>
        <ThemedText type="small" className="font-semibold">
          {activeLocation?.name ?? 'Lagerort auswählen'}
        </ThemedText>
        {}
        <View
          className="w-[10px] h-[6px]"
          style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>
          <View className="absolute top-[2px] left-0 w-[6px] h-[1.5px] rounded-hairline bg-text-secondary rotate-[38deg]" />
          <View className="absolute top-[2px] right-0 w-[6px] h-[1.5px] rounded-hairline bg-text-secondary -rotate-[38deg]" />
        </View>
      </GlassCard>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <Pressable
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel="Menü schließen"
          onPress={() => setIsOpen(false)}>
          {isOpen ? (
            <View
              accessibilityRole="menu"
              className="inventory-tab-bar-menu"
              // Position kommt aus der Fenstermessung, boxShadow (dynamische
              // Opazitaet), borderCurve und elevation sind echte Laufzeit-/
              // Plattform-Werte — alles ohne Tailwind-Entsprechung.
              style={{
                position: 'absolute',
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
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
                    className={`inventory-tab-bar-option ${index > 0 ? 'inventory-tab-bar-option-bordered' : ''} ${
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
        </Pressable>
      </Modal>
    </View>
  );
}
