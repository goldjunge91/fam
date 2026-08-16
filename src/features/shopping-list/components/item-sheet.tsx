import type { ReactNode } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

interface ItemSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Volle Kopfzeile (Titel + Schließen-Control) — bleibt Sache des Aufrufers, die beiden Nutzer weichen hier bewusst voneinander ab. */
  header: ReactNode;
  /** Ziehgriff oberhalb der Kopfzeile, nur AddItemModal hat einen. */
  handle?: ReactNode;
  safeAreaStyle?: StyleProp<ViewStyle>;
  scrollContentStyle?: StyleProp<ViewStyle>;
  contentInsetAdjustmentBehavior?: ScrollViewProps['contentInsetAdjustmentBehavior'];
  children: ReactNode;
}

/**
 * Gemeinsame Sheet-Shell von AddItemModal und EditItemModal: Modal, Safe
 * Area und Scroll-Container. Kopfzeile und Handle bleiben Slots statt
 * Props, weil sich Titel-Typografie und Close-Control zwischen beiden
 * Aufrufern unterscheiden (#155).
 */
export function ItemSheet({
  visible,
  onDismiss,
  header,
  handle,
  safeAreaStyle,
  scrollContentStyle,
  contentInsetAdjustmentBehavior,
  children,
}: ItemSheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onDismiss}>
      <ThemedView style={styles.root}>
        <SafeAreaView
          style={[styles.safeArea, safeAreaStyle]}
          edges={['top', 'left', 'right', 'bottom']}>
          {handle}
          {header}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
            contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.four },
});
