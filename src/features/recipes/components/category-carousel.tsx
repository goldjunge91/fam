import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import type { RecipeTemplateWithNutrition } from '@/features/recipes/templates/use-recipe-templates';
import {
  isHighProteinTemplate,
  isLowCarbTemplate,
} from '@/features/recipes/templates/use-recipe-templates';

export type CategoryTile = {
  key: string;
  emoji: string;
  label: string;
  matches: (template: RecipeTemplateWithNutrition) => boolean;
};

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

/** Horizontale Kategorie-Kacheln mit Icon und Label. */
export function CategoryCarousel({ selectedKey, onSelect }: CategoryCarouselProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-two">
      {CATEGORY_TILES.map((tile) => {
        const selected = tile.key === selectedKey;
        return (
          <Pressable
            key={tile.key}
            onPress={() => onSelect(selected ? null : tile.key)}
            role="button"
            aria-label={tile.label}
            aria-selected={selected}
            className={`category-tile ${selected ? 'selectable-selected' : 'selectable-idle'}`}>
            <ThemedText className="text-[22px] leading-[26px]">{tile.emoji}</ThemedText>
            <ThemedText
              type="detail"
              themeColor={selected ? 'onAccent' : 'text'}
              className="text-[9px] leading-[11px] font-semibold text-center"
              numberOfLines={1}>
              {tile.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
