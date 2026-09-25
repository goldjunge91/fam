import type { ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  type ScrollViewProps,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { radius } from '@/components/theme/index';
import { Surface } from '@/constants/ui';

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
  rootStyle?: StyleProp<ViewStyle>;
  scrollContentStyle?: StyleProp<ViewStyle>;
  contentInsetAdjustmentBehavior?: ScrollViewProps['contentInsetAdjustmentBehavior'];
  children: ReactNode;
};

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: theme.space.xl + theme.space.xs,
  },
  headerPressable: {
    flexShrink: 0,
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    marginTop: theme.space.md,
    borderRadius: radius.micro,
    backgroundColor: theme.border,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.space.xl + theme.space.xs,
  },
}));

export function ItemModalShell({
  visible,
  onDismiss,
  onDismissFinished,
  header,
  onHeaderPress,
  showHandle = false,
  rootStyle,
  scrollContentStyle,
  contentInsetAdjustmentBehavior,
  children,
}: ItemModalShellProps) {
  if (!visible && process.env.NODE_ENV === 'test') return null;

  const content = (
    <Surface style={[styles.root, rootStyle]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {}
        <Pressable
          onPress={onHeaderPress ?? (() => Keyboard.dismiss())}
          accessible={false}
          style={styles.headerPressable}>
          {showHandle ? <View style={styles.handle} /> : null}
          {header}
        </Pressable>

        <KeyboardAwareScrollView
          style={styles.flex}
          bottomOffset={24}
          contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
          contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
          keyboardShouldPersistTaps="handled">
          {children}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Surface>
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
