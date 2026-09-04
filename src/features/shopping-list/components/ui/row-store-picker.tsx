import { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { useStores } from '../../hooks/use-stores';

type Anchor = { x: number; y: number; height: number };

type RowStorePickerProps = {
  householdId: string;
  storeId: string | null;
  onChange: (storeId: string | null) => void;
  /**
   * Ueberschreibt den berechneten Trigger-Text (Store-Name/"Ohne Markt").
   * Fuer den Bulk-Einsatz ("Allen einen Markt zuweisen", #342) statt einer
   * Zeilen-Anzeige — derselbe Dropdown-Mechanismus, aber ohne eigenen
   * "aktuellen" Zustand.
   */
  label?: string;
  /** Nur fuer Tests: mehrere Zeilen-Instanzen sonst ueber dasselbe Label nicht unterscheidbar. */
  testID?: string;
};

/**
 * Kompakter Markt-Picker fuer eine einzelne Zeile (z. B. eine Zutat in der
 * "Fehlende Zutaten"-Vorschlagsliste), Einzelauswahl statt Filter — Ableitung
 * aus dem anchored-Dropdown-Mechanismus von `StorePickerMenu`. Kein
 * "+ Neuer Markt"-Flow, das deckt `StorePickerField` an anderer Stelle ab.
 */
export function RowStorePicker({
  householdId,
  storeId,
  onChange,
  label: labelOverride,
  testID,
}: RowStorePickerProps) {
  const { data: stores = [] } = useStores(householdId);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anchorRef = useRef<View>(null);
  const { colors: theme } = useTheme();
  const open = anchor !== null;

  const activeStore = stores.find((store) => store.id === storeId) ?? null;
  const computedLabel = storeId === null ? 'Ohne Markt' : (activeStore?.name ?? 'Markt wählen');
  const label = labelOverride ?? computedLabel;
  const dotColor = storeId === null ? theme.textMuted : (activeStore?.color ?? theme.textMuted);

  function openMenu() {
    anchorRef.current?.measureInWindow((x, y, _width, height) => setAnchor({ x, y, height }));
  }

  function closeMenu() {
    setAnchor(null);
  }

  function select(next: string | null) {
    onChange(next);
    closeMenu();
  }

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`Markt wählen, aktuell: ${label}`}
          testID={testID}
          className="row-store-picker-btn">
          <View className="store-picker-dot" style={{ backgroundColor: dotColor }} />
          <Txt variant="body" numberOfLines={1} className="max-w-[110px]">
            {label}
          </Txt>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable className="store-picker-backdrop" onPress={closeMenu}>
          {anchor && (
            <View
              className="store-picker-panel"
              style={{ position: 'absolute', top: anchor.y + anchor.height + 6, left: anchor.x }}>
              <Pressable
                onPress={() => select(null)}
                accessibilityRole="menuitem"
                accessibilityLabel="Ohne Markt"
                accessibilityState={{ selected: storeId === null }}
                className={`store-picker-row ${storeId === null ? 'store-picker-row-active' : ''}`}>
                <View className="store-picker-dot" style={{ backgroundColor: theme.textMuted }} />
                <Txt variant="body" weight="600" className="flex-1">
                  Ohne Markt
                </Txt>
              </Pressable>

              {stores.map((store) => (
                <Pressable
                  key={store.id}
                  onPress={() => select(store.id)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={store.name}
                  accessibilityState={{ selected: storeId === store.id }}
                  className={`store-picker-row ${
                    storeId === store.id ? 'store-picker-row-active' : ''
                  }`}>
                  <View className="store-picker-dot" style={{ backgroundColor: store.color }} />
                  <Txt variant="body" weight="600" numberOfLines={1} className="flex-1">
                    {store.name}
                  </Txt>
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
