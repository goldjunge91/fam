import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { CALORIE_BUCKETS } from '@/features/recipes/recipe-calorie-buckets';

/** Dekoratives Food-Emoji je `CALORIE_BUCKETS`-Bucket. */
const BUCKET_EMOJI = ['🍉', '🥪', '🥯', '🥞', '🍛', '🍱', '🍲', '🍝', '🍔', '🍕'];

type CalorieCarouselProps = {
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
};

/** "Rezepte nach Kalorien": 2 Reihen, horizontal scrollend, 10 Buckets a 100 kcal. */
export function CalorieCarousel({ selectedIndex, onSelect }: CalorieCarouselProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="calorie-carousel-content">
      {CALORIE_BUCKETS.map((bucket, index) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            key={bucket.label}
            onPress={() => onSelect(selected ? null : index)}
            role="button"
            aria-label={`${bucket.label} Kilokalorien`}
            aria-selected={selected}
            className={`calorie-tile ${selected ? 'selectable-selected' : 'selectable-idle'}`}>
            <ThemedText className="text-[18px] leading-[21px]">{BUCKET_EMOJI[index]}</ThemedText>
            <ThemedText
              type="captionCompact"
              themeColor={selected ? 'onAccent' : 'text'}
              className="font-bold mt-half"
              numberOfLines={1}>
              {bucket.label}
            </ThemedText>
            <ThemedText
              type="detail"
              themeColor={selected ? 'onAccent' : 'textSecondary'}
              className="text-[8px] leading-[10px] font-medium">
              kcal
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
