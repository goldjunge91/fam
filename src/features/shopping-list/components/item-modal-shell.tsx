import type { ReactNode } from 'react';
import { Modal, ScrollView, type ScrollViewProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';

type ItemModalShellProps = {
  visible: boolean;
  onDismiss: () => void;
  /**
   * Komplette Kopfzeile inkl. `modal-header`-Klasse, Titel und
   * Schließen-Aktion — bleibt Sache des Aufrufers, da sich Layout und
   * Schließen-Control zwischen den Sheets bereits unterscheiden.
   */
  header: ReactNode;
  /** Ziehgriff oberhalb der Kopfzeile, aktuell nur im Add-Sheet sichtbar. */
  showHandle?: boolean;
  rootClassName?: string;
  scrollContentClassName?: string;
  contentInsetAdjustmentBehavior?: ScrollViewProps['contentInsetAdjustmentBehavior'];
  children: ReactNode;
};

/**
 * Gemeinsames Geruest der Einkaufslisten-Sheets (Artikel hinzufuegen /
 * bearbeiten): `Modal` als Page-Sheet auf iOS, Safe Area und Scroll-
 * Container. Kopfzeile, Ziehgriff, Hintergrund und unterer Abstand bleiben
 * Props statt erzwungener Angleichung — die beiden Sheets sahen vorher schon
 * unterschiedlich aus (#155), das ist eine Design-Entscheidung und keine, die
 * ein Refactor stillschweigend treffen sollte.
 */
export function ItemModalShell({
  visible,
  onDismiss,
  header,
  showHandle = false,
  rootClassName = 'flex-1',
  scrollContentClassName,
  contentInsetAdjustmentBehavior,
  children,
}: ItemModalShellProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={process.env.EXPO_OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onDismiss}>
      <ThemedView className={rootClassName}>
        <SafeAreaView className="modal-safe-area" edges={['top', 'left', 'right', 'bottom']}>
          {showHandle ? <View className="modal-handle" /> : null}
          {header}

          <ScrollView
            className="flex-1"
            contentContainerClassName={scrollContentClassName}
            contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}
