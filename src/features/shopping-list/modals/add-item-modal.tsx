import { Image } from 'expo-image';
import { useRef } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { IconSize } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { AddItemForm, type AddItemFormHandle } from '../forms/add-item-form';
import { ItemModalShell } from './item-modal-shell';

interface AddItemModalProps {
  visible: boolean;
  householdId: string;
  initialStoreId?: string | null;
  onDismiss: () => void;
}

export function AddItemModal({
  visible,
  householdId,
  initialStoreId = null,
  onDismiss,
}: AddItemModalProps) {
  const theme = useTheme();
  const formRef = useRef<AddItemFormHandle>(null);

  return (
    <ItemModalShell
      visible={visible}
      onDismiss={onDismiss}
      rootClassName="flex-1 bg-background"
      scrollContentClassName="pb-four"
      contentInsetAdjustmentBehavior="automatic"
      showHandle
      // Die Suche lebt im Kind und muss zusammen mit der Tastatur geschlossen werden.
      onHeaderPress={() => formRef.current?.closeSearch()}
      header={
        <View className="modal-header min-h-[54px]">
          <ThemedText type="headingSmall">Artikel hinzufügen</ThemedText>
          <HeaderIconButton label="Schließen" onPress={onDismiss} className="btn-modal-close">
            <Image
              source="sf:xmark"
              contentFit="contain"
              tintColor={theme.textSecondary}
              // expo-image unterstützt kein cssInterop; statische Abmessungen als style
              style={{ width: IconSize.xs, height: IconSize.xs }}
            />
          </HeaderIconButton>
        </View>
      }>
      {visible ? (
        <AddItemForm
          ref={formRef}
          householdId={householdId}
          initialStoreId={initialStoreId}
          onDismiss={onDismiss}
        />
      ) : null}
    </ItemModalShell>
  );
}
