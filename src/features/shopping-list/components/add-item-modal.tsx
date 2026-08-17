import { Image } from 'expo-image';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HeaderIconButton } from '@/components/ui/buttons';
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
      <ThemedView className="flex-1 bg-background">
        <SafeAreaView className="modal-safe-area" edges={['top', 'left', 'right', 'bottom']}>
          <View className="modal-handle" />
          <View className="modal-header min-h-[54px]">
            <ThemedText type="headingSmall">Artikel hinzufügen</ThemedText>
            <HeaderIconButton
              label="Schließen"
              onPress={onDismiss}
              className="w-8 h-8 rounded-card">
              <Image
                source="sf:xmark"
                contentFit="contain"
                tintColor={theme.textSecondary}
                // expo-image unterstützt kein cssInterop; statische Abmessungen als style
                style={{ width: 14, height: 14 }}
              />
            </HeaderIconButton>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-four"
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
