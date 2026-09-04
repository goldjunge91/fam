import { Image } from 'expo-image';
import { View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { space } from '@/components/theme/index';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { EditItemForm } from '../forms/edit-item-form';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import { ItemModalShell } from './item-modal-shell';

interface EditItemModalProps {
  item: LocalShoppingItem | null;
  onDismiss: () => void;
}

/** Eigene Seite statt Inline-Formular — analog zu AddItemModal. */
export function EditItemModal({ item, onDismiss }: EditItemModalProps) {
  const { colors: theme } = useTheme();

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
          <Txt variant="heading">Artikel bearbeiten</Txt>
          <HeaderIconButton label="Schließen" onPress={onDismiss} className="btn-modal-close">
            <Image
              source="sf:xmark"
              contentFit="contain"
              tintColor={theme.textMuted}
              style={{ width: space.md, height: space.md }}
            />
          </HeaderIconButton>
        </View>
      }>
      {item && <EditItemForm item={item} onDismiss={onDismiss} />}
    </ItemModalShell>
  );
}
