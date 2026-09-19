import { Host } from '@expo/ui';
import { BottomSheet, Group, RNHostView } from '@expo/ui/swift-ui';
import {
  frame,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/constants/ui';
import {
  ModalComparisonHostedContent,
  type ModalComparisonMode,
} from '@/features/settings/dev/design-system/showcase-modal-content';
import {
  NaturalLanguageAdditionSwiftUIPreviewContent,
  type NaturalLanguageAdditionSwiftUIPreviewProps,
} from './natural-language-addition-swift-ui-preview-content';

export function NaturalLanguageAdditionSwiftUIPreview({
  visible,
  preview,
  onRequestClose,
  onDismiss,
  onEditText,
  onConfirm,
  storage,
  variant,
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
                storage={storage}
                variant={variant}
              />
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}

export function SwiftUIBottomSheetDemo() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<ModalComparisonMode | null>(null);
  const dismiss = () => setMode(null);

  return (
    <View style={styles.example}>
      <View style={styles.actionRow}>
        <Button
          title="Voice"
          variant="secondary"
          size="sm"
          icon="mic"
          onPress={() => setMode('input')}
        />
        <Button
          title="Modal öffnen"
          variant="secondary"
          size="sm"
          onPress={() => setMode('preview')}
        />
      </View>
      <Host style={styles.nativeHost} seedColor={colors.accent} pointerEvents="box-none">
        <BottomSheet
          isPresented={mode !== null}
          onIsPresentedChange={(isPresented) => {
            if (!isPresented) dismiss();
          }}
          onDismiss={dismiss}>
          <Group
            modifiers={[
              frame({ maxWidth: Infinity, alignment: 'topLeading' }),
              presentationDetents([{ fraction: 0.5 }, { fraction: 0.9 }]),
              presentationDragIndicator('visible'),
              presentationBackground(colors.backgroundElement),
            ]}>
            <RNHostView>
              <ModalComparisonHostedContent
                mode={mode ?? 'preview'}
                onDismiss={dismiss}
                onOpenPreview={() => setMode('preview')}
              />
            </RNHostView>
          </Group>
        </BottomSheet>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  hostedContent: {
    flexGrow: 1,
    height: 0,
    width: '100%',
  },
  example: {
    alignItems: 'flex-start',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  nativeHost: {
    width: '100%',
  },
}));
