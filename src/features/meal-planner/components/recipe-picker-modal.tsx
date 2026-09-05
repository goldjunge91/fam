import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space } from '@/components/theme/index';
import { Surface, TextField, Txt } from '@/constants/ui';
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
      <Surface tone="page" className="rpm-root">
        <SafeAreaView className="rpm-safe-area" edges={['top', 'left', 'right', 'bottom']}>
          <View className="rpm-header">
            <Txt variant="title">Rezept auswählen</Txt>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              className="rpm-close-button">
              <Txt variant="body">✕</Txt>
            </Pressable>
          </View>

          <TextField
            label="Suche"
            value={query}
            onChangeText={setQuery}
            placeholder="Rezept suchen…"
          />

          {filtered.length === 0 ? (
            <Txt variant="body" tone="secondary" className="rpm-empty">
              {recipes.length === 0
                ? 'Noch keine Rezepte vorhanden. Lege zuerst ein Rezept an.'
                : 'Kein Rezept gefunden.'}
            </Txt>
          ) : (
            <FlashList
              data={filtered}
              keyExtractor={(item) => item.id}
              // FlashList hat kein cssInterop, deshalb RN-Styles statt
              // Tailwind-Klassen — s. glass-card.tsx (#139).
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingVertical: space.sm }}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} eintragen`}
                  onPress={() => onSelect(item)}
                  className="rpm-recipe-row">
                  <Txt variant="body">{item.title}</Txt>
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </Surface>
    </Modal>
  );
}
