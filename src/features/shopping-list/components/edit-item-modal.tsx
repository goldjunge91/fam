import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { LocalShoppingItem } from '../use-shopping-list';
import { EditItemForm } from './edit-item-form';
import { ItemModalShell } from './item-modal-shell';

interface EditItemModalProps {
  item: LocalShoppingItem | null;
  onDismiss: () => void;
}

/** Eigene Seite statt Inline-Formular — analog zu AddItemModal. */
export function EditItemModal({ item, onDismiss }: EditItemModalProps) {
  return (
    <ItemModalShell
      visible={item !== null}
      onDismiss={onDismiss}
      scrollContentClassName="pb-six"
      header={
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
      }>
      {item && <EditItemForm item={item} onDismiss={onDismiss} />}
    </ItemModalShell>
  );
}
