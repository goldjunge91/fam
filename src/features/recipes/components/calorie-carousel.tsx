import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { FontSize, ThemedText } from '@/components/themed-text';
import { CALORIE_BUCKETS } from '@/features/recipe-templates/use-recipe-templates';
import { useTheme } from '@/hooks/use-theme';

/** Ein Food-Emoji je Bucket, rein dekorativ zur Wiedererkennung — deckungsgleich mit `CALORIE_BUCKETS`. */
const BUCKET_EMOJI = ['🍉', '🥪', '🥯', '🥞', '🍛', '🍱', '🍲', '🍝', '🍔', '🍕'];

const TILE_HEIGHT = 74;
const ROW_GAP = 8;

type CalorieCarouselProps = {
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
};

/** "Rezepte nach Kalorien": 2 Reihen, horizontal scrollend, 10 Buckets a 100 kcal. */
export function CalorieCarousel({ selectedIndex, onSelect }: CalorieCarouselProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {CALORIE_BUCKETS.map((bucket, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={bucket.label}
            onPress={() => onSelect(selected ? null : index)}
            role="button"
            aria-label={`${bucket.label} Kilokalorien`}
            aria-selected={selected}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: selected ? theme.accent : `${theme.backgroundElement}D9`,
                borderColor: selected ? theme.accent : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={styles.emoji}>{BUCKET_EMOJI[index]}</ThemedText>
            <ThemedText
              style={[styles.range, selected && { color: theme.background }]}
              numberOfLines={1}>
              {bucket.label}
            </ThemedText>
            <ThemedText
              themeColor={selected ? undefined : 'textSecondary'}
              style={[styles.unit, selected && { color: theme.background }]}>
              kcal
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    height: TILE_HEIGHT * 2 + ROW_GAP,
    gap: ROW_GAP,
  },
  tile: {
    width: 92,
    height: TILE_HEIGHT,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  pressed: {
    opacity: 0.8,
  },
  emoji: {
    ...FontSize[18],
    lineHeight: 21,
  },
  range: {
    ...FontSize[11],
    lineHeight: 14,
    fontWeight: 700,
    marginTop: 2,
  },
  unit: {
    ...FontSize[8],
    lineHeight: 10,
    fontWeight: 500,
  },
});
