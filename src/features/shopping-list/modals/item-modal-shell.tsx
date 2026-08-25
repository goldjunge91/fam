import type { ReactNode } from 'react';
import { Keyboard, Modal, Pressable, type ScrollViewProps, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/theme/themed-view';

type ItemModalShellProps = {
  visible: boolean;
  onDismiss: () => void;
  /**
   * Wird auf iOS aufgerufen, sobald die Schließ-Animation des Modals vollständig
   * beendet ist (natives `onDismiss` auf React Native's `<Modal>`).
   */
  onDismissFinished?: () => void;
  /**
   * Komplette Kopfzeile inkl. `modal-header`-Klasse, Titel und
   * Schließen-Aktion — bleibt Sache des Aufrufers, da sich Layout und
   * Schließen-Control zwischen den Sheets bereits unterscheiden.
   */
  header: ReactNode;
  /**
   * Tap auf Ziehgriff/Kopfzeile — Default schliesst nur die Tastatur. Sheets
   * mit eigener Suche (add-item-modal.tsx) uebergeben stattdessen eine
   * Funktion, die zusaetzlich eine offene Trefferliste schliesst; die Suche
   * lebt im Kind-Formular, nicht in diesem geteilten Geruest.
   */
  onHeaderPress?: () => void;
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
 *
 * `KeyboardAwareScrollView` statt einer normalen `ScrollView` (#UI-Feedback:
 * "Artikel halb von der Tastatur verdeckt", "kein Button zum Zuklappen") —
 * offizieller Expo-Doku-Weg fuer mehrfeldrige Formulare in einer ScrollView,
 * haelt das fokussierte Feld automatisch ueber der Tastatur sichtbar, statt
 * dass jede Stelle die Tastaturhoehe selbst gegen `measureInWindow` rechnet.
 * `KeyboardToolbar` gibt einen echten "Fertig"-Button oberhalb der Tastatur —
 * schliesst bewusst nur die Tastatur, nie automatisch eine offene
 * Trefferliste (die schliesst primaer die tatsaechliche Auswahl, siehe
 * `product-search-dropdown.tsx`). Ziehgriff + Kopfzeile schliessen per Tap
 * per Default ebenfalls nur die Tastatur, siehe `onHeaderPress` fuer den
 * Ausnahmefall (#UI-Feedback).
 */
export function ItemModalShell({
  visible,
  onDismiss,
  onDismissFinished,
  header,
  onHeaderPress,
  showHandle = false,
  rootClassName = 'flex-1',
  scrollContentClassName,
  contentInsetAdjustmentBehavior,
  children,
}: ItemModalShellProps) {
  if (!visible && process.env.NODE_ENV === 'test') return null;

  const content = (
    <ThemedView className={rootClassName}>
      <SafeAreaView className="modal-safe-area" edges={['top', 'left', 'right', 'bottom']}>
        {/* Schliesst per Default nur die Tastatur; Sheets mit eigener Suche
            schliessen darueber zusaetzlich eine offene Trefferliste (siehe
            `onHeaderPress`-Kommentar, #UI-Feedback: "oberhalb der Suche
            klicken schliesst auch die Liste"). */}
        <Pressable onPress={onHeaderPress ?? (() => Keyboard.dismiss())} accessible={false}>
          {showHandle ? <View className="modal-handle" /> : null}
          {header}
        </Pressable>

        <KeyboardAwareScrollView
          className="flex-1"
          bottomOffset={24}
          contentContainerClassName={scrollContentClassName}
          contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
          keyboardShouldPersistTaps="handled">
          {children}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </ThemedView>
  );

  if (process.env.NODE_ENV === 'test') {
    return (
      <>
        {content}
        <KeyboardToolbar />
      </>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={process.env.EXPO_OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onDismiss}
      onDismiss={onDismissFinished}>
      {content}
      <KeyboardToolbar />
    </Modal>
  );
}
