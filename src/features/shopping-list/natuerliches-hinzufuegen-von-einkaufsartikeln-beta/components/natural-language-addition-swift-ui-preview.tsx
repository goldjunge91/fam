import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import {
  NaturalLanguageAdditionSwiftUIPreviewContent,
  type NaturalLanguageAdditionSwiftUIPreviewProps,
} from './natural-language-addition-swift-ui-preview-content';

export function NaturalLanguageAdditionSwiftUIPreview({
  visible,
  preview,
  onDismiss,
  onEditText,
  onConfirm,
}: NaturalLanguageAdditionSwiftUIPreviewProps) {
  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={['50%', '90%']}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={styles.previewBackground}>
      <BottomSheetView style={styles.previewSheet}>
        <NaturalLanguageAdditionSwiftUIPreviewContent
          preview={preview}
          onDismiss={onDismiss}
          onEditText={onEditText}
          onConfirm={onConfirm}
        />
      </BottomSheetView>
    </BottomSheet>
  );
}

/** SwiftUI ist auf Android und Web nicht verfügbar; die echte Variante liegt in `.ios.tsx`. */
export function SwiftUIBottomSheetDemo() {
  const { colors } = useTheme();

  return (
    <View style={[styles.unavailable, { backgroundColor: colors.backgroundSoft }]}>
      <Txt variant="caption" tone="secondary">
        SwiftUI-BottomSheet nur auf iOS verfügbar.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  previewBackground: {
    backgroundColor: theme.backgroundElement,
  },
  previewSheet: {
    flex: 1,
  },
  unavailable: {
    minHeight: theme.space.xxl,
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.base,
    borderColor: theme.border,
  },
}));
