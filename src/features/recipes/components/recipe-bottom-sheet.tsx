import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

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
  const { colors } = useTheme();
  if (!visible) return null;

  const body = (
    <Pressable className="flex-1 justify-end bg-[#261f27]/30" onPress={onClose}>
      <Pressable
        className={`recipe-sheet-surface ${sheetClassName}`.trim()}
        style={{ backgroundColor: colors.surface }}
        onPress={(event) => event.stopPropagation()}>
        <View className="modal-handle" />
        <View className="min-h-[58px] pt-[13px] flex-row items-center justify-between gap-three">
          <Txt variant="heading" className="flex-1">
            {title}
          </Txt>
          <Pressable
            onPress={onClose}
            role="button"
            aria-label="Schließen"
            className="btn-modal-close"
            style={{ backgroundColor: colors.surfaceSoft }}>
            <Txt variant="body" tone="secondary" style={{ fontSize: 18, lineHeight: 20, fontWeight: '500' }}>
              ×
            </Txt>
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
