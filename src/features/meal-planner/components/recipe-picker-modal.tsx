import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DraggableRecipe } from './week-grid';

type RecipePickerModalProps = {
  visible: boolean;
  recipes: readonly DraggableRecipe[];
  onDismiss: () => void;
  onSelect: (recipe: DraggableRecipe) => void;
};

/**
 * Rezept-Auswahl beim Tippen auf eine leere Grid-Zelle (#129-Nachtrag).
 *
 * Der zuverlaessige Hauptweg, ein Gericht in den Wochenplan einzutragen —
 * anders als Drag & Drop braucht Tippen keine Koordinatenmessung und
 * funktioniert unabhaengig von Scroll-Position oder Geraet.
 */
export function RecipePickerModal({
  visible,
  recipes,
  onDismiss,
  onSelect,
}: RecipePickerModalProps) {
  const theme = useTheme();
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
      <ThemedView style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Rezept auswählen</ThemedText>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText>✕</ThemedText>
            </Pressable>
          </View>

          <TextField
            label="Suche"
            value={query}
            onChangeText={setQuery}
            placeholder="Rezept suchen…"
          />

          {filtered.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {recipes.length === 0
                ? 'Noch keine Rezepte vorhanden. Lege zuerst ein Rezept an.'
                : 'Kein Rezept gefunden.'}
            </ThemedText>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} eintragen`}
                  onPress={() => onSelect(item)}
                  style={[styles.recipeRow, { borderBottomColor: theme.border }]}>
                  <ThemedText>{item.title}</ThemedText>
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  list: { paddingVertical: Spacing.two },
  recipeRow: {
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
