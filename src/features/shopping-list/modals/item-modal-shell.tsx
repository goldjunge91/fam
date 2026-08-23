import type { ReactNode } from 'react';
import { Keyboard, Modal, Pressable, type ScrollViewProps, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/theme/themed-view';

type ItemModalShellProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Vollstaendige Kopfzeile, da sich Layout und Schliessen-Control unterscheiden. */
  header: ReactNode;
  /** Ueberschreibbar, wenn neben der Tastatur auch Kindzustand geschlossen werden muss. */
  onHeaderPress?: () => void;
  /** Ziehgriff oberhalb der Kopfzeile, aktuell nur im Add-Sheet sichtbar. */
  showHandle?: boolean;
  rootClassName?: string;
  scrollContentClassName?: string;
  contentInsetAdjustmentBehavior?: ScrollViewProps['contentInsetAdjustmentBehavior'];
  children: ReactNode;
};

/**
 * Gemeinsames Page-Sheet fuer Artikel-Formulare. Der tastaturbewusste Scroll-
 * Container haelt fokussierte Felder sichtbar; die Toolbar schliesst nur die Tastatur.
 */
export function ItemModalShell({
  visible,
  onDismiss,
  header,
  onHeaderPress,
  showHandle = false,
  rootClassName = 'flex-1',
  scrollContentClassName,
  contentInsetAdjustmentBehavior,
  children,
}: ItemModalShellProps) {
  if (!visible) return null;

  const content = (
    <ThemedView className={rootClassName}>
      <SafeAreaView className="modal-safe-area" edges={['top', 'left', 'right', 'bottom']}>
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
      onRequestClose={onDismiss}>
      {content}
      <KeyboardToolbar />
    </Modal>
  );
}
