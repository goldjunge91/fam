import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { useStores } from '../../hooks/use-stores';

const styles = StyleSheet.create((theme) => ({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    minHeight: 44,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  },
  dot: {
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
  triggerLabel: {
    maxWidth: 110,
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    width: 200,
    gap: theme.space.xs / 2,
    padding: theme.space.xs,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.background,
    overflow: 'hidden',
    ...theme.shadow.lg,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  rowActive: {
    backgroundColor: theme.backgroundSoft,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
}));

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
  const { t } = useTranslation();
  const { data: stores = [] } = useStores(householdId);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const anchorRef = useRef<View>(null);
  const { colors: theme } = useTheme();
  const open = anchor !== null;

  const activeStore = stores.find((store) => store.id === storeId) ?? null;
  const computedLabel =
    storeId === null
      ? t('shoppingList.rowStorePicker.unassigned')
      : (activeStore?.name ?? t('shoppingList.rowStorePicker.chooseStore'));
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
        <Press
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={t('shoppingList.rowStorePicker.chooseStoreAccessibility', {
            current: label,
          })}
          testID={testID}
          haptic="selection"
          style={styles.trigger}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Txt variant="body" numberOfLines={1} style={styles.triggerLabel}>
            {label}
          </Txt>
        </Press>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          {anchor && (
            <View
              style={[
                styles.panel,
                { position: 'absolute', top: anchor.y + anchor.height + 6, left: anchor.x },
              ]}>
              <Press
                onPress={() => select(null)}
                accessibilityRole="menuitem"
                accessibilityLabel={t('shoppingList.rowStorePicker.unassigned')}
                accessibilityState={{ selected: storeId === null }}
                haptic="selection"
                style={[styles.row, storeId === null && styles.rowActive]}>
                <View style={[styles.dot, { backgroundColor: theme.textMuted }]} />
                <Txt variant="body" weight="600" style={styles.rowLabel}>
                  {t('shoppingList.rowStorePicker.unassigned')}
                </Txt>
              </Press>

              {stores.map((store) => (
                <Press
                  key={store.id}
                  onPress={() => select(store.id)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={store.name}
                  accessibilityState={{ selected: storeId === store.id }}
                  haptic="selection"
                  style={[styles.row, storeId === store.id && styles.rowActive]}>
                  <View style={[styles.dot, { backgroundColor: store.color }]} />
                  <Txt variant="body" weight="600" numberOfLines={1} style={styles.rowLabel}>
                    {store.name}
                  </Txt>
                </Press>
              ))}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
