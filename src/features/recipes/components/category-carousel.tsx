import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';

type CategoryMatchInput = {
  dish_types: string[];
  dietary_tags: string[];
  cook_time_minutes: number | null;
  kcalPerServing: number | null;
  proteinGPerServing: number | null;
  carbsGPerServing: number | null;
};

export type CategoryLabelKey =
  | 'recipes.categories.breakfast'
  | 'recipes.categories.lunch'
  | 'recipes.categories.dinner'
  | 'recipes.categories.snack'
  | 'recipes.categories.vegan'
  | 'recipes.categories.vegetarian'
  | 'recipes.categories.highProtein'
  | 'recipes.categories.lowCarb'
  | 'recipes.categories.quick'
  | 'recipes.categories.dessert';

export type CategoryTile = {
  key: string;
  emoji: string;
  labelKey: CategoryLabelKey;
  matches: (recipe: CategoryMatchInput) => boolean;
};

export const CATEGORY_TILES: CategoryTile[] = [
  {
    key: 'breakfast',
    emoji: '☕',
    labelKey: 'recipes.categories.breakfast',
    matches: (t) => t.dish_types.includes('breakfast'),
  },
  {
    key: 'lunch',
    emoji: '🍜',
    labelKey: 'recipes.categories.lunch',
    matches: (t) => t.dish_types.includes('lunch'),
  },
  {
    key: 'dinner',
    emoji: '🍗',
    labelKey: 'recipes.categories.dinner',
    matches: (t) => t.dish_types.includes('dinner'),
  },
  {
    key: 'snack',
    emoji: '🥪',
    labelKey: 'recipes.categories.snack',
    matches: (t) => t.dish_types.includes('snack'),
  },
  {
    key: 'vegan',
    emoji: '🌱',
    labelKey: 'recipes.categories.vegan',
    matches: (t) => t.dietary_tags.includes('vegan'),
  },
  {
    key: 'vegetarian',
    emoji: '🥗',
    labelKey: 'recipes.categories.vegetarian',
    matches: (t) => t.dietary_tags.includes('vegetarian'),
  },
  {
    key: 'high_protein',
    emoji: '💪',
    labelKey: 'recipes.categories.highProtein',
    matches: (r) =>
      !!r.kcalPerServing &&
      !!r.proteinGPerServing &&
      (r.proteinGPerServing * 4) / r.kcalPerServing >= 0.25,
  },
  {
    key: 'low_carb',
    emoji: '🥦',
    labelKey: 'recipes.categories.lowCarb',
    matches: (r) => r.carbsGPerServing !== null && r.carbsGPerServing < 20,
  },
  {
    key: 'quick',
    emoji: '⏱️',
    labelKey: 'recipes.categories.quick',
    matches: (t) => t.cook_time_minutes !== null && t.cook_time_minutes <= 20,
  },
  {
    key: 'dessert',
    emoji: '🍰',
    labelKey: 'recipes.categories.dessert',
    matches: (t) => t.dish_types.includes('dessert'),
  },
];

type CategoryCarouselProps = {
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
};

const styles = StyleSheet.create((theme) => ({
  content: {
    flexDirection: 'row',
    gap: theme.space.sm,
  },
  tile: {
    width: 92,
    minHeight: 78,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.sm,
  },
}));

/** Horizontale Kategorie-Kacheln mit Icon und Label. */
export function CategoryCarousel({ selectedKey, onSelect }: CategoryCarouselProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {CATEGORY_TILES.map((tile) => {
        const selected = tile.key === selectedKey;
        return (
          <Press
            key={tile.key}
            onPress={() => onSelect(selected ? null : tile.key)}
            accessibilityRole="button"
            accessibilityLabel={t(tile.labelKey)}
            accessibilityState={{ selected: selected }}
            style={[
              styles.tile,
              {
                backgroundColor: selected ? colors.accent : colors.backgroundElement,
                borderColor: selected ? colors.accent : colors.border,
              },
            ]}>
            <Txt variant="subheading">{tile.emoji}</Txt>
            <Txt
              variant="caption"
              tone={selected ? 'onAccent' : 'primary'}
              weight="600"
              center
              numberOfLines={1}>
              {t(tile.labelKey)}
            </Txt>
          </Press>
        );
      })}
    </ScrollView>
  );
}
