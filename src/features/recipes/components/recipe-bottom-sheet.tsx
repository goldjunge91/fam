import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';

type RecipeBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Zusaetzliche Klassen fuer die Sheet-Flaeche, z. B. eine Hoehenbegrenzung. */
  sheetClassName?: string;
  /** Fuer Sheets mit Texteingabe, damit die Tastatur sie nicht verdeckt. */
  avoidKeyboard?: boolean;
  children: ReactNode;
};

export function RecipeBottomSheet({
  visible,
  onClose,
  title,
  sheetClassName = '',
  avoidKeyboard = false,
  children,
}: RecipeBottomSheetProps) {
  if (!visible) return null;

  const body = (
    <Pressable className="flex-1 justify-end bg-[#261f27]/30" onPress={onClose}>
      <Pressable
        className={`recipe-sheet-surface ${sheetClassName}`.trim()}
        onPress={(event) => event.stopPropagation()}>
        <View className="modal-handle" />
        <View className="min-h-[58px] pt-[13px] flex-row items-center justify-between gap-three">
          <ThemedText type="headingSmall" className="flex-1">
            {title}
          </ThemedText>
          <Pressable
            onPress={onClose}
            role="button"
            aria-label="Schließen"
            className="btn-modal-close">
            <ThemedText themeColor="accent" className="text-[18px] leading-[20px] font-medium">
              ×
            </ThemedText>
          </Pressable>
        </View>
        {children}
      </Pressable>
    </Pressable>
  );

  if (process.env.NODE_ENV === 'test') {
    return body;
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          className="flex-1">
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}
