import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';
import type { RecipeTemplateWithNutrition } from '@/features/recipe-templates/use-recipe-templates';
import {
  isHighProteinTemplate,
  isLowCarbTemplate,
} from '@/features/recipe-templates/use-recipe-templates';
import { useTheme } from '@/hooks/use-theme';

export type CategoryTile = {
  key: string;
  emoji: string;
  label: string;
  matches: (template: RecipeTemplateWithNutrition) => boolean;
};

/**
 * Die 10 Kacheln fuer den "Kategorien"-Carousel im Entdecken-Screen.
 * `high_protein`/`low_carb`/`quick` sind rein abgeleitet (siehe
 * `isHighProteinTemplate`/`isLowCarbTemplate` in use-recipe-templates.ts),
 * die uebrigen filtern auf `dish_types`/`dietary_tags`.
 */
export const CATEGORY_TILES: CategoryTile[] = [
  {
    key: 'breakfast',
    emoji: '☕',
    label: 'Frühstück',
    matches: (t) => t.dish_types.includes('breakfast'),
  },
  {
    key: 'lunch',
    emoji: '🍜',
    label: 'Mittagessen',
    matches: (t) => t.dish_types.includes('lunch'),
  },
  {
    key: 'dinner',
    emoji: '🍗',
    label: 'Abendessen',
    matches: (t) => t.dish_types.includes('dinner'),
  },
  { key: 'snack', emoji: '🥪', label: 'Snack', matches: (t) => t.dish_types.includes('snack') },
  { key: 'vegan', emoji: '🌱', label: 'Vegan', matches: (t) => t.dietary_tags.includes('vegan') },
  {
    key: 'vegetarian',
    emoji: '🥗',
    label: 'Vegetarisch',
    matches: (t) => t.dietary_tags.includes('vegetarian'),
  },
  { key: 'high_protein', emoji: '💪', label: 'High Protein', matches: isHighProteinTemplate },
  { key: 'low_carb', emoji: '🥦', label: 'Low Carb', matches: isLowCarbTemplate },
  {
    key: 'quick',
    emoji: '⏱️',
    label: 'Schnell',
    matches: (t) => t.cook_time_minutes !== null && t.cook_time_minutes <= 20,
  },
  {
    key: 'dessert',
    emoji: '🍰',
    label: 'Dessert',
    matches: (t) => t.dish_types.includes('dessert'),
  },
];

type CategoryCarouselProps = {
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
};

/** Horizontal scrollende Kategorie-Kacheln — Icon und Label in derselben Karte, kein Text darunter. */
export function CategoryCarousel({ selectedKey, onSelect }: CategoryCarouselProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {CATEGORY_TILES.map((tile) => {
        const selected = tile.key === selectedKey;
        return (
          <Pressable
            key={tile.key}
            onPress={() => onSelect(selected ? null : tile.key)}
            role="button"
            aria-label={tile.label}
            aria-selected={selected}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: selected ? theme.accent : `${theme.backgroundElement}D9`,
                borderColor: selected ? theme.accent : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.emoji}>{tile.emoji}</ThemedText>
            <ThemedText
              style={[styles.label, selected && { color: theme.background }]}
              numberOfLines={1}>
              {tile.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    width: 78,
    minHeight: 68,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.8,
  },
  emoji: {
    ...FontSize[22],
    lineHeight: 26,
  },
  label: {
    ...FontSize[9],
    lineHeight: 11,
    fontWeight: 600,
    textAlign: 'center',
  },
});
