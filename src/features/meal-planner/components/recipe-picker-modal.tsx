import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/forms/text-field';
import { ThemedText } from '@/components/theme/themed-text';
import { ThemedView } from '@/components/theme/themed-view';
import { Spacing } from '@/constants/layout';
import type { DraggableRecipe } from './week-grid';

type RecipePickerModalProps = {
  visible: boolean;
  recipes: readonly DraggableRecipe[];
  onDismiss: () => void;
  onSelect: (recipe: DraggableRecipe) => void;
};

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
      <ThemedView className="rpm-root">
        <SafeAreaView className="rpm-safe-area" edges={['top', 'left', 'right', 'bottom']}>
          <View className="rpm-header">
            <ThemedText type="subtitle">Rezept auswählen</ThemedText>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              className="rpm-close-button">
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
            <ThemedText type="small" themeColor="textSecondary" className="rpm-empty">
              {recipes.length === 0
                ? 'Noch keine Rezepte vorhanden. Lege zuerst ein Rezept an.'
                : 'Kein Rezept gefunden.'}
            </ThemedText>
          ) : (
            <FlashList
              data={filtered}
              keyExtractor={(item) => item.id}
              // FlashList hat kein cssInterop, deshalb RN-Styles statt
              // Tailwind-Klassen — s. glass-card.tsx (#139).
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingVertical: Spacing.two }}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} eintragen`}
                  onPress={() => onSelect(item)}
                  className="rpm-recipe-row">
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
