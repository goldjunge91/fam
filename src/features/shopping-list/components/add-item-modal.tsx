import { Image } from 'expo-image';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { IconSize } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { AddItemForm } from './add-item-form';
import { ItemModalShell } from './item-modal-shell';

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
    <ItemModalShell
      visible={visible}
      onDismiss={onDismiss}
      rootClassName="flex-1 bg-background"
      scrollContentClassName="pb-four"
      contentInsetAdjustmentBehavior="automatic"
      showHandle
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
          householdId={householdId}
          initialStoreId={initialStoreId}
          onDismiss={onDismiss}
        />
      ) : null}
    </ItemModalShell>
  );
}
