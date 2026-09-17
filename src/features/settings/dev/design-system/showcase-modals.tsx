import { BottomSheet, Host } from '@expo/ui';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Txt } from '@/constants/ui';
import { useSheetShadowStyle } from '@/hooks/use-sheet-shadow-style';
import { ModalComparisonContent, type ModalComparisonMode } from './showcase-modal-content';
import { SwiftUIBottomSheetDemo } from './showcase-modal-swift-ui';
import { ContractIntro, Subsection } from './showcase-shared';

export type ModalCategory = 'modal-comparison';

export function ModalsShowcase() {
  return (
    <View style={styles.page}>
      <ContractIntro
        title="Modalvergleich"
        contract="Drei Präsentationscontainer zeigen dieselben zwei Natural-Language-Flows: Eingabe und Preview."
        source="@expo/ui · @expo/ui/swift-ui · ui.tsx · theme/index.ts"
      />
      <Subsection title="Zwei Flows, drei Container">
        <View style={styles.comparisonGroup}>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Expo UI universal</Txt>
            <UniversalBottomSheetDemo />
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">SwiftUI direkt</Txt>
            <SwiftUIBottomSheetDemo />
          </View>
          <View style={styles.comparisonExample}>
            <Txt variant="label">Eigenbau</Txt>
            <CustomBottomSheetDemo />
          </View>
        </View>
      </Subsection>
    </View>
  );
}

function UniversalBottomSheetDemo() {
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
          onDismiss={dismiss}
          showDragIndicator
          snapPoints={['half', 'full']}
          contentPadding={0}
          containerColor={colors.backgroundElement}
          scrimColor={colors.scrim}
          testID="design-system-universal-bottom-sheet">
          {mode ? (
            <ModalComparisonContent
              mode={mode}
              onDismiss={dismiss}
              onOpenPreview={() => setMode('preview')}
            />
          ) : null}
        </BottomSheet>
      </Host>
    </View>
  );
}

function CustomBottomSheetDemo() {
  const { colors } = useTheme();
  const shadowStyle = useSheetShadowStyle();
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
      <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={dismiss}>
        <View style={styles.customBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Eigenbau-Modal schließen"
          />
          <View
            style={[
              styles.customSheet,
              shadowStyle,
              { backgroundColor: colors.backgroundElement },
            ]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {mode ? (
              <ModalComparisonContent
                mode={mode}
                onDismiss={dismiss}
                onOpenPreview={() => setMode('preview')}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: {
    gap: theme.space.xxl,
  },
  comparisonGroup: {
    gap: theme.space.xl,
  },
  comparisonExample: {
    gap: theme.space.sm,
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
  customBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: theme.space.lg,
    backgroundColor: theme.scrim,
  },
  customSheet: {
    height: '80%',
    minHeight: theme.space.xxxl * 6,
    maxHeight: '90%',
    overflow: 'hidden',
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: theme.space.xxxl,
    height: theme.space.xs,
    marginTop: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
}));
