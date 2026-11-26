import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { Button, CloseButton, Press, Surface, TextField, Txt } from '@/constants/ui';
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
  onCreateCustom: () => void;
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
  customEntryButton: {
    marginTop: theme.space.md,
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
  const { t } = useTranslation();
  const { data: coverUrl } = useRecipeCoverUrl(recipe.coverImagePath);

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={t('mealPlanner.picker.entryAccessibility', { title: recipe.title })}
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
  onCreateCustom,
}: RecipePickerModalProps) {
  const { t } = useTranslation();
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
            <Txt variant="title">{t('mealPlanner.picker.title')}</Txt>
            <CloseButton onPress={onDismiss} accessibilityLabel={t('mealPlanner.picker.close')} />
          </View>

          <TextField
            label={t('mealPlanner.picker.search')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('mealPlanner.picker.placeholder')}
          />

          <Button
            title={t('mealPlanner.picker.custom')}
            variant="secondary"
            full
            style={styles.customEntryButton}
            onPress={onCreateCustom}
          />

          {filtered.length === 0 ? (
            <Txt variant="body" tone="secondary" style={styles.empty}>
              {recipes.length === 0
                ? t('mealPlanner.picker.emptyNoRecipes')
                : t('mealPlanner.picker.emptyNoMatch')}
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
