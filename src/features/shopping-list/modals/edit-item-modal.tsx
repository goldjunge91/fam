import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { EditItemForm } from '../forms/edit-item-form';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import { ItemModalShell } from './item-modal-shell';

const styles = StyleSheet.create((theme) => ({
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.lg,
  },
}));

interface EditItemModalProps {
  item: LocalShoppingItem | null;
  onDismiss: () => void;
}

/** Eigene Seite statt Inline-Formular — analog zu AddItemModal. */
export function EditItemModal({ item, onDismiss }: EditItemModalProps) {
  const { t } = useTranslation();
  const { colors: theme } = useTheme();

  return (
    <ItemModalShell
      visible={item !== null}
      onDismiss={onDismiss}
      contentInsetAdjustmentBehavior="automatic"
      showHandle
      header={
        <View style={styles.header}>
          <Txt variant="heading">{t('shoppingList.editItem')}</Txt>
          <HeaderIconButton
            label={t('shoppingList.close')}
            onPress={onDismiss}
            variant="modal-close">
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
