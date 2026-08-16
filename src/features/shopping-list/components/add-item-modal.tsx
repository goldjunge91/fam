import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AddItemForm } from './add-item-form';
import { ItemSheet } from './item-sheet';

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
    <ItemSheet
      visible={visible}
      onDismiss={onDismiss}
      safeAreaStyle={styles.safeArea}
      scrollContentStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic"
      handle={<View style={[styles.handle, { backgroundColor: theme.border }]} />}
      header={
        <View style={styles.header}>
          <ThemedText type="headingSmall" style={styles.title}>
            Artikel hinzufügen
          </ThemedText>
          <HeaderIconButton label="Schließen" onPress={onDismiss} style={styles.closeButton}>
            <Image
              source="sf:xmark"
              contentFit="contain"
              tintColor={theme.textSecondary}
              style={styles.closeIcon}
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
    </ItemSheet>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    paddingHorizontal: 15,
  },
  handle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    borderRadius: Radius.hairline,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 54,
    paddingTop: Spacing.two,
  },
  title: {
    fontWeight: 600,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.card,
  },
  closeIcon: {
    width: 14,
    height: 14,
  },
  scrollContent: {
    paddingBottom: Spacing.four,
  },
});
