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
  onItemAdded?: () => void;
  onDismissFinished?: () => void;
}

/** Eigene Seite statt Inline-Formular ueber der Einkaufsliste. */
export function AddItemModal({
  visible,
  householdId,
  initialStoreId = null,
  onDismiss,
  onItemAdded,
  onDismissFinished,
}: AddItemModalProps) {
  const theme = useTheme();
  const formRef = useRef<AddItemFormHandle>(null);

  return (
    <ItemModalShell
      visible={visible}
      onDismiss={onDismiss}
      onDismissFinished={onDismissFinished}
      rootClassName="flex-1 bg-background"
      scrollContentClassName="pb-four"
      contentInsetAdjustmentBehavior="automatic"
      showHandle
      // Tap auf den Header schliesst Tastatur UND eine offene Trefferliste
      // (#UI-Feedback) — die Suche lebt in AddItemForm, nicht hier.
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
          onItemAdded={onItemAdded}
        />
      ) : null}
    </ItemModalShell>
  );
}
