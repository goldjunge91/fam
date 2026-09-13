import { Image } from 'expo-image';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import type { CatalogProduct } from '@/features/product-search/types';
import { AddItemForm, type AddItemFormHandle } from '../forms/add-item-form';
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

interface AddItemModalProps {
  visible: boolean;
  householdId: string;
  initialStoreId?: string | null;
  initialProduct?: CatalogProduct | null;
  onDismiss: () => void;
  onItemAdded?: () => void;
  onDismissFinished?: () => void;
}

/** Eigene Seite statt Inline-Formular ueber der Einkaufsliste. */
export function AddItemModal({
  visible,
  householdId,
  initialStoreId = null,
  initialProduct = null,
  onDismiss,
  onItemAdded,
  onDismissFinished,
}: AddItemModalProps) {
  const { t } = useTranslation();
  const { colors: theme } = useTheme();
  const formRef = useRef<AddItemFormHandle>(null);

  return (
    <ItemModalShell
      visible={visible}
      onDismiss={onDismiss}
      onDismissFinished={onDismissFinished}
      contentInsetAdjustmentBehavior="automatic"
      showHandle
      // Tap auf den Header schliesst Tastatur UND eine offene Trefferliste
      // (#UI-Feedback) — die Suche lebt in AddItemForm, nicht hier.
      onHeaderPress={() => formRef.current?.closeSearch()}
      header={
        <View style={styles.header}>
          <Txt variant="heading">{t('shoppingList.addItem')}</Txt>
          <HeaderIconButton
            label={t('shoppingList.close')}
            onPress={onDismiss}
            variant="modal-close">
            <Image
              source="sf:xmark"
              contentFit="contain"
              tintColor={theme.textMuted}
              // expo-image unterstützt kein cssInterop; statische Abmessungen als style
              style={{ width: space.md, height: space.md }}
            />
          </HeaderIconButton>
        </View>
      }>
      {visible ? (
        <AddItemForm
          ref={formRef}
          householdId={householdId}
          initialStoreId={initialStoreId}
          initialProduct={initialProduct}
          onDismiss={onDismiss}
          onItemAdded={onItemAdded}
        />
      ) : null}
    </ItemModalShell>
  );
}
