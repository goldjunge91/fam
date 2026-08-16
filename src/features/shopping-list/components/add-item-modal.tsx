import { Image } from 'expo-image';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText, Typography } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AddItemForm } from './add-item-form';

interface AddItemModalProps {
  visible: boolean;
  householdId: string;
  initialStoreId?: string | null;
  onDismiss: () => void;
}

/** Eigene Seite statt Inline-Formular ueber der Einkaufsliste. */
export function AddItemModal({
  visible,
  householdId,
  initialStoreId = null,
  onDismiss,
}: AddItemModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={process.env.EXPO_OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onDismiss}>
      <ThemedView style={[styles.root, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            <ThemedText type="headingSmall" style={styles.title}>
              Artikel hinzufügen
            </ThemedText>
            <HeaderIconButton label="Schließen" onPress={onDismiss} style={styles.closeButton}>
              <Image
                source="sf:xmark"
                contentFit="contain"
                tintColor={theme.textSecondary}
                style={styles.closeIcon}
              />
            </HeaderIconButton>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled">
            {visible ? (
              <AddItemForm
                householdId={householdId}
                initialStoreId={initialStoreId}
                onDismiss={onDismiss}
              />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 15,
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: Radius.hairline,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 54,
    paddingTop: Spacing.two,
  },
  title: {
    ...Typography.headingSmall,
    fontWeight: 600,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.card,
  },
  closeIcon: {
    width: 14,
    height: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
});
