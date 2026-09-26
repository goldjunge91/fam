import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { CloseButton, Press, Surface, TextField, Txt } from '@/constants/ui';
import { RecipeArtwork } from '@/features/recipes/components/recipe-preview-card';
import { useRecipeCoverUrl } from '@/features/recipes/data/household-recipe-images';

export type RecipeOption = {
  id: string;
  title: string;
  coverImagePath?: string | null;
};

type RecipePickerModalProps = {
  visible: boolean;
  recipes: readonly RecipeOption[];
  onDismiss: () => void;
  onSelect: (recipe: RecipeOption) => void;
};

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: theme.space.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.space.lg,
  },
  empty: {
    marginTop: theme.space.xxl,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: theme.space.sm,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingVertical: theme.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  recipeArtwork: {
    width: 160,
    height: 120,
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
  },
  recipeTitle: {
    flex: 1,
    minWidth: 0,
  },
}));

function RecipePickerRow({
  recipe,
  onSelect,
}: {
  recipe: RecipeOption;
  onSelect: (recipe: RecipeOption) => void;
}) {
  const { data: coverUrl } = useRecipeCoverUrl(recipe.coverImagePath);

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title} eintragen`}
      onPress={() => onSelect(recipe)}
      style={styles.recipeRow}>
      <View style={styles.recipeArtwork}>
        <RecipeArtwork title={recipe.title} coverUrl={coverUrl} coverPath={recipe.coverImagePath} />
      </View>
      <Txt variant="body" weight="700" numberOfLines={2} style={styles.recipeTitle}>
        {recipe.title}
      </Txt>
    </Press>
  );
}

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
              renderItem={({ item }) => <RecipePickerRow recipe={item} onSelect={onSelect} />}
            />
          )}
        </SafeAreaView>
      </Surface>
    </Modal>
  );
}
