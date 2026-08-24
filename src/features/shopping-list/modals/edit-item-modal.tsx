import { Image } from 'expo-image';
import { View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { IconSize } from '@/constants/layout';
import { useTheme } from '@/hooks/use-theme';
import { EditItemForm } from '../forms/edit-item-form';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import { ItemModalShell } from './item-modal-shell';

interface EditItemModalProps {
  item: LocalShoppingItem | null;
  onDismiss: () => void;
}

/** Eigene Seite statt Inline-Formular — analog zu AddItemModal. */
export function EditItemModal({ item, onDismiss }: EditItemModalProps) {
  const theme = useTheme();

  return (
    <ItemModalShell
      visible={item !== null}
      onDismiss={onDismiss}
      rootClassName="flex-1 bg-background"
      scrollContentClassName="pb-four"
      contentInsetAdjustmentBehavior="automatic"
      showHandle
      header={
        <View className="modal-header min-h-[54px]">
          <ThemedText type="headingSmall">Artikel bearbeiten</ThemedText>
          <HeaderIconButton label="Schließen" onPress={onDismiss} className="btn-modal-close">
            <Image
              source="sf:xmark"
              contentFit="contain"
              tintColor={theme.textSecondary}
              style={{ width: IconSize.xs, height: IconSize.xs }}
            />
          </HeaderIconButton>
        </View>
      }>
      {item && <EditItemForm item={item} onDismiss={onDismiss} />}
    </ItemModalShell>
  );
}
