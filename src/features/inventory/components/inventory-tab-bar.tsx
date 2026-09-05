import { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { radius, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { GlassCard } from '@/components/ui/glass-card';
import { Txt } from '@/constants/ui';
import type { StorageLocation } from '@/features/inventory/use-storage-locations';

interface InventoryTabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  locations: StorageLocation[];
}

type MenuPosition = { top: number; left: number; width: number };

const FALLBACK_MENU_POSITION: MenuPosition = { top: 0, left: 0, width: 220 };

// `GlassView` hat kein cssInterop (s. glass-card.tsx), deshalb hier als
// RN-Style statt Tailwind-Klasse — muss in Radius/Padding mit
// `.inventory-tab-bar-trigger` in global.css in Sync bleiben. Die
// Vorrats-Referenz verwendet eine kompakte rechteckige Glass-Fläche mit
// weichen Ecken, keine Kapsel.
const TRIGGER_GLASS_STYLE = {
  borderRadius: radius.lg,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  gap: 8,
  paddingHorizontal: 14,
  paddingVertical: 15,
};

export function InventoryTabBar({ activeTab, onTabChange, locations }: InventoryTabBarProps) {
  const { colors } = useTheme();
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
    <View ref={triggerRef} className="inventory-tab-bar-container flex-1">
      {/* Liquid Glass auf iOS 26+ (expo-glass-effect), sonst solide Karte
          wie vor der Umstellung — s. glass-card.tsx. */}
      <GlassCard
        outerStyle={{ borderRadius: radius.lg, flex: 1 }}
        glassStyle={TRIGGER_GLASS_STYLE}
        fallbackClassName="inventory-tab-bar-trigger"
        onPress={toggleMenu}
        accessibilityRole="button"
        accessibilityLabel={`Lagerort auswählen, aktuell ${activeLocation?.name ?? 'keiner'}`}>
        <Txt variant="body" weight="700">
          {activeLocation?.name ?? 'Lagerort auswählen'}
        </Txt>
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
                boxShadow: `0 10px 28px ${withAlpha(colors.text, 0.18)}`,
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
                    className={`inventory-tab-bar-option ${index > 0 ? 'inventory-tab-bar-option-bordered' : ''}`}
                    style={selected ? { backgroundColor: colors.backgroundSoft } : undefined}>
                    <Txt variant="body" weight={selected ? '700' : '400'}>
                      {location.name}
                    </Txt>
                    {selected ? <Txt tone="success">✓</Txt> : null}
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
