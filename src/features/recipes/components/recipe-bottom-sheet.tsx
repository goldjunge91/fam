import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, type StyleProp, View, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { radius, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { MIN_TOUCH_SIZE, Press, Txt } from '@/constants/ui';

type RecipeBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Lokale Erweiterung der Sheet-Flaeche, z. B. eine Hoehenbegrenzung. */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Fuer Sheets mit Texteingabe, damit die Tastatur sie nicht verdeckt. */
  avoidKeyboard?: boolean;
  children: ReactNode;
};

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: theme.radius.famLarge,
    borderTopRightRadius: theme.radius.famLarge,
    paddingHorizontal: theme.space.xxl,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xl,
    backgroundColor: theme.backgroundElement,
  },
  sheetContainer: { flexShrink: 1 },
  handle: {
    width: rs(36),
    height: rs(4),
    alignSelf: 'center',
    borderRadius: radius.s,
    marginTop: theme.space.md,
  },
  header: {
    minHeight: rs(58),
    paddingTop: theme.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.lg,
  },
  title: {
    flex: 1,
  },
  // Der 32-Punkt-Kreis ist die sichtbare Flaeche, der 44-Punkt-Container der
  // Trefferbereich. Beide sind noetig, damit Close tastbar gross bleibt ohne
  // das Sheet-Design zu vergroessern.
  closeFace: {
    width: rs(32),
    height: rs(32),
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboard: {
    flex: 1,
  },
}));

export function RecipeBottomSheet({
  visible,
  onClose,
  title,
  sheetStyle,
  avoidKeyboard = false,
  children,
}: RecipeBottomSheetProps) {
  const { colors } = useTheme();
  if (!visible) return null;

  const body = (
    <Press
      haptic="none"
      scaleTo={1}
      containerStyle={styles.backdrop}
      style={[styles.backdrop, { backgroundColor: colors.scrim }]}
      onPress={onClose}>
      <Press
        haptic="none"
        scaleTo={1}
        containerStyle={styles.sheetContainer}
        style={[styles.sheet, { backgroundColor: colors.backgroundElement }, sheetStyle]}
        onPress={(event) => event.stopPropagation()}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Txt variant="heading" style={styles.title}>
            {title}
          </Txt>
          <Press
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
            style={styles.close}>
            <View style={[styles.closeFace, { backgroundColor: colors.backgroundSoft }]}>
              <Txt variant="subheading" tone="secondary" weight="500">
                ×
              </Txt>
            </View>
          </Press>
        </View>
        {children}
      </Press>
    </Press>
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
          style={styles.keyboard}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}
