import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LocalShoppingItem } from '../use-shopping-list';
import { EditItemForm } from './edit-item-form';
import { ItemSheet } from './item-sheet';

interface EditItemModalProps {
  item: LocalShoppingItem | null;
  onDismiss: () => void;
}

/** Eigene Seite statt Inline-Formular — analog zu AddItemModal. */
export function EditItemModal({ item, onDismiss }: EditItemModalProps) {
  const theme = useTheme();

  return (
    <ItemSheet
      visible={item !== null}
      onDismiss={onDismiss}
      safeAreaStyle={styles.safeArea}
      scrollContentStyle={styles.scrollContent}
      header={
        <View style={styles.header}>
          <ThemedText type="subtitle">Artikel bearbeiten</ThemedText>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
            style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText>✕</ThemedText>
          </Pressable>
        </View>
      }>
      {item && <EditItemForm item={item} onDismiss={onDismiss} />}
    </ItemSheet>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
});
