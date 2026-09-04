import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { CALORIE_BUCKETS } from '@/features/recipes/domain/recipe-calorie-buckets';

/** Dekoratives Food-Emoji je `CALORIE_BUCKETS`-Bucket. */
const BUCKET_EMOJI = ['🍉', '🥪', '🥯', '🥞', '🍛', '🍱', '🍲', '🍝', '🍔', '🍕'];

type CalorieCarouselProps = {
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
};

/** "Rezepte nach Kalorien": 2 Reihen, horizontal scrollend, 10 Buckets a 100 kcal. */
export function CalorieCarousel({ selectedIndex, onSelect }: CalorieCarouselProps) {
  const { colors } = useTheme();
  const columns = Array.from({ length: Math.ceil(CALORIE_BUCKETS.length / 2) }, (_, column) =>
    CALORIE_BUCKETS.slice(column * 2, column * 2 + 2),
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="calorie-carousel-content">
      {columns.map((column, columnIndex) => (
        <View key={`calorie-column-${column.map(({ min }) => min).join('-')}`} className="gap-two">
          {column.map((bucket, rowIndex) => {
            const index = columnIndex * 2 + rowIndex;
            const selected = index === selectedIndex;
            return (
              <Pressable
                key={bucket.label}
                onPress={() => onSelect(selected ? null : index)}
                role="button"
                aria-label={`${bucket.label} Kilokalorien`}
                aria-selected={selected}
                className="calorie-tile"
                style={{
                  backgroundColor: selected ? colors.accent : colors.backgroundElement,
                  borderColor: selected ? colors.accent : colors.border,
                }}>
                <Txt variant="controlActionLarge">{BUCKET_EMOJI[index]}</Txt>
                <Txt
                  variant="captionCompact"
                  tone={selected ? 'onAccent' : 'primary'}
                  weight="700"
                  className="mt-half"
                  numberOfLines={1}>
                  {bucket.label}
                </Txt>
                <Txt variant="micro" tone={selected ? 'onAccent' : 'secondary'}>
                  kcal
                </Txt>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
