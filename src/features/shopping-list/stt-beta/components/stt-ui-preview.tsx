import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';

import {
  NaturalLanguageAdditionSwiftUIPreviewContent,
  type NaturalLanguageAdditionSwiftUIPreviewProps,
} from './stt-preview-content';

/** Presents the preview content in the non-iOS bottom-sheet host. */
export function NaturalLanguageAdditionSwiftUIPreview({
  visible,
  preview,
  onRequestClose,
  onDismiss,
  onEditText,
  onConfirm,
}: NaturalLanguageAdditionSwiftUIPreviewProps) {
  return (
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={['50%', '90%']}
      enablePanDownToClose
      onClose={onRequestClose}
      onDismiss={onDismiss}
      backgroundStyle={styles.previewBackground}>
      <BottomSheetView style={styles.previewSheet}>
        <NaturalLanguageAdditionSwiftUIPreviewContent
          preview={preview}
          onRequestClose={onRequestClose}
          onEditText={onEditText}
          onConfirm={onConfirm}
        />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  previewBackground: {
    backgroundColor: theme.backgroundElement,
  },
  previewSheet: {
    flex: 1,
  },
}));
