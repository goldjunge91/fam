import { Pressable, ScrollView } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';

type CategoryMatchInput = {
  dish_types: string[];
  dietary_tags: string[];
  cook_time_minutes: number | null;
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
};

export type CategoryTile = {
  key: string;
  emoji: string;
  label: string;
  matches: (recipe: CategoryMatchInput) => boolean;
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
  {
    key: 'high_protein',
    emoji: '💪',
    label: 'High Protein',
    matches: (r) =>
      !!r.kcalPerServing &&
      !!r.proteinGPerServing &&
      (r.proteinGPerServing * 4) / r.kcalPerServing >= 0.25,
  },
  {
    key: 'low_carb',
    emoji: '🥦',
    label: 'Low Carb',
    matches: (r) => r.carbsGPerServing !== null && r.carbsGPerServing < 20,
  },
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
  const { colors } = useTheme();
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
            className="category-tile"
            style={{
              backgroundColor: selected ? colors.basil : colors.surface,
              borderColor: selected ? colors.basil : colors.border,
            }}>
            <Txt variant="body" style={{ fontSize: 24, lineHeight: 28 }}>
              {tile.emoji}
            </Txt>
            <Txt
              variant="body"
              tone={selected ? 'onAccent' : 'primary'}
              weight="600"
              center
              style={{ fontSize: 10, lineHeight: 12 }}
              numberOfLines={1}>
              {tile.label}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
