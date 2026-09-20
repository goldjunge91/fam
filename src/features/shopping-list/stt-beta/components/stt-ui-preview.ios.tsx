import { Host } from '@expo/ui';
import { BottomSheet, Group, RNHostView } from '@expo/ui/swift-ui';
import {
  frame,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import {
  NaturalLanguageAdditionSwiftUIPreviewContent,
  type NaturalLanguageAdditionSwiftUIPreviewProps,
} from './stt-preview-content';

/** Presents the preview content in the native iOS SwiftUI sheet host. */
export function NaturalLanguageAdditionSwiftUIPreview({
  visible,
  preview,
  onRequestClose,
  onDismiss,
  onEditText,
  onConfirm,
  nameCorrections,
  correctionBusy,
  onCorrectName,
  onForgetCorrection,
}: NaturalLanguageAdditionSwiftUIPreviewProps) {
  const { colors } = useTheme();

  return (
    <Host style={styles.nativeHost} seedColor={colors.accent} pointerEvents="box-none">
      <BottomSheet
        isPresented={visible}
        onIsPresentedChange={(isPresented) => {
          if (!isPresented) onRequestClose();
        }}
        onDismiss={onDismiss}>
        <Group
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'topLeading' }),
            presentationDetents([{ fraction: 0.5 }, { fraction: 0.9 }]),
            presentationDragIndicator('visible'),
            presentationBackground(colors.backgroundElement),
          ]}>
          <RNHostView>
            <View style={styles.hostedContent}>
              <NaturalLanguageAdditionSwiftUIPreviewContent
                preview={preview}
                onRequestClose={onRequestClose}
                onEditText={onEditText}
                onConfirm={onConfirm}
                nameCorrections={nameCorrections}
                correctionBusy={correctionBusy}
                onCorrectName={onCorrectName}
                onForgetCorrection={onForgetCorrection}
              />
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  hostedContent: {
    flexGrow: 1,
    height: 0,
    width: '100%',
  },
  nativeHost: {
    width: '100%',
  },
});
