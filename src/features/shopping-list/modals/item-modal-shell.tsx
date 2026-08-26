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

  header: ReactNode;

  onHeaderPress?: () => void;
  /** Ziehgriff oberhalb der Kopfzeile, aktuell nur im Add-Sheet sichtbar. */
  showHandle?: boolean;
  rootClassName?: string;
  scrollContentClassName?: string;
  contentInsetAdjustmentBehavior?: ScrollViewProps['contentInsetAdjustmentBehavior'];
  children: ReactNode;
};

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
        {}
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
