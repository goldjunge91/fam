import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { CloseButton, Press, Surface, TextField, Txt } from '@/constants/ui';
import type { DraggableRecipe } from './week-grid';

type RecipePickerModalProps = {
  visible: boolean;
  recipes: readonly DraggableRecipe[];
  onDismiss: () => void;
  onSelect: (recipe: DraggableRecipe) => void;
};

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: theme.space.xl + theme.space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.lg,
  },
  empty: {
    marginTop: theme.space.xxl + theme.space.xs,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: theme.space.sm,
  },
  recipeRow: {
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
}));

export function RecipePickerModal({
  visible,
  recipes,
  onDismiss,
  onSelect,
}: RecipePickerModalProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onDismiss}>
      <Surface tone="page" style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <Txt variant="title">Rezept auswählen</Txt>
            <CloseButton onPress={onDismiss} accessibilityLabel="Schließen" />
          </View>

          <TextField
            label="Suche"
            value={query}
            onChangeText={setQuery}
            placeholder="Rezept suchen…"
          />

          {filtered.length === 0 ? (
            <Txt variant="body" tone="secondary" style={styles.empty}>
              {recipes.length === 0
                ? 'Noch keine Rezepte vorhanden. Lege zuerst ein Rezept an.'
                : 'Kein Rezept gefunden.'}
            </Txt>
          ) : (
            <FlashList
              data={filtered}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Press
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} eintragen`}
                  onPress={() => onSelect(item)}
                  style={styles.recipeRow}>
                  <Txt variant="body">{item.title}</Txt>
                </Press>
              )}
            />
          )}
        </SafeAreaView>
      </Surface>
    </Modal>
  );
}
