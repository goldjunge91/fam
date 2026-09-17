import { BottomSheet, Host } from '@expo/ui';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Surface, Txt } from '@/constants/ui';
import { nativeSpeechRecognitionAdapter } from '../services/native-speech-recognition';
import type { SpeechRecognitionAdapter } from '../services/speech-recognition-adapter';
import type {
  NaturalLanguageAdditionInput as NaturalLanguageAdditionInputContract,
  SpeechInputResult,
} from '../types';
import { NaturalLanguageAdditionInput } from './natural-language-addition-input';
import { NaturalLanguageAdditionSheetCloseButton } from './natural-language-addition-sheet-close-button';

export type NaturalLanguageAdditionInputSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (input: NaturalLanguageAdditionInputContract) => void;
  errorMessage?: string | null;
  speechAdapter?: SpeechRecognitionAdapter;
  networkRecognitionConsent?: boolean;
  onSpeechFallback?: (result: Exclude<SpeechInputResult, { status: 'transcript' }>) => void;
};

export function NaturalLanguageAdditionInputSheet({
  visible,
  onDismiss,
  onSubmit,
  errorMessage,
  speechAdapter = nativeSpeechRecognitionAdapter,
  networkRecognitionConsent = false,
  onSpeechFallback,
}: NaturalLanguageAdditionInputSheetProps) {
  const { colors } = useTheme();

  return (
    <Host style={styles.host} pointerEvents="box-none">
      <BottomSheet
        isPresented={visible}
        onDismiss={onDismiss}
        showDragIndicator
        snapPoints={['half', 'full']}
        contentPadding={0}
        containerColor={colors.backgroundElement}
        testID="natural-language-addition-input-sheet">
        <Surface tone="surface" style={styles.sheet}>
          <ScrollView
            testID="natural-language-addition-input-scroll"
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Txt variant="caption" tone="secondary">
                  Einkaufsliste
                </Txt>
                <Txt variant="title">Artikel sprechen</Txt>
              </View>
              <NaturalLanguageAdditionSheetCloseButton onPress={onDismiss} />
            </View>

            <Txt variant="body" tone="secondary">
              Nenne mehrere Artikel, zum Beispiel „3 Äpfel und Brot“.
            </Txt>

            {errorMessage ? (
              <Txt variant="caption" tone="warning" accessibilityRole="alert">
                {errorMessage}
              </Txt>
            ) : null}

            {visible ? (
              <NaturalLanguageAdditionInput
                speechAdapter={speechAdapter}
                networkRecognitionConsent={networkRecognitionConsent}
                onSubmit={onSubmit}
                onSpeechFallback={onSpeechFallback}
              />
            ) : null}

            <Button title="Später" variant="secondary" onPress={onDismiss} full />
          </ScrollView>
        </Surface>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create((theme) => ({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
  },
  sheet: {
    flex: 1,
    minHeight: 260,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.space.lg,
    padding: theme.space.xl,
    paddingBottom: theme.space.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  headerCopy: {
    gap: theme.space.xs,
  },
}));
