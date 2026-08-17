import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { LocalShoppingItem } from '../use-shopping-list';
import { EditItemForm } from './edit-item-form';

interface EditItemModalProps {
  item: LocalShoppingItem | null;
  onDismiss: () => void;
}

/** Eigene Seite statt Inline-Formular — analog zu AddItemModal. */
export function EditItemModal({ item, onDismiss }: EditItemModalProps) {
  return (
    <Modal
      visible={item !== null}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onDismiss}>
      <ThemedView className="flex-1">
        <SafeAreaView className="modal-safe-area" edges={['top', 'left', 'right', 'bottom']}>
          <View className="modal-header">
            <ThemedText type="subtitle">Artikel bearbeiten</ThemedText>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              className="modal-close-btn">
              <ThemedText>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-six"
            keyboardShouldPersistTaps="handled">
            {item && <EditItemForm item={item} onDismiss={onDismiss} />}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}
