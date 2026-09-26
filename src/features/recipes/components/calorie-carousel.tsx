import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Press, Txt } from '@/constants/ui';
import { CALORIE_BUCKETS } from '@/features/recipes/domain/recipe-calorie-buckets';

/** Dekoratives Food-Emoji je `CALORIE_BUCKETS`-Bucket. */
const BUCKET_EMOJI = ['🍉', '🥪', '🥯', '🥞', '🍛', '🍱', '🍲', '🍝', '🍔', '🍕'];

type CalorieCarouselProps = {
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
};

const styles = StyleSheet.create((theme) => ({
  content: {
    height: 176,
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: theme.space.sm,
  },
  column: {
    gap: theme.space.sm,
  },
  tile: {
    width: 108,
    height: 84,
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.space.sm,
  },
  label: {
    marginTop: theme.space.xs / 2,
  },
}));

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
      contentContainerStyle={styles.content}>
      {columns.map((column, columnIndex) => (
        <View
          key={`calorie-column-${column.map(({ min }) => min).join('-')}`}
          style={styles.column}>
          {column.map((bucket, rowIndex) => {
            const index = columnIndex * 2 + rowIndex;
            const selected = index === selectedIndex;
            return (
              <Press
                key={bucket.label}
                onPress={() => onSelect(selected ? null : index)}
                role="button"
                aria-label={`${bucket.label} Kilokalorien`}
                aria-selected={selected}
                style={[
                  styles.tile,
                  {
                    backgroundColor: selected ? colors.accent : colors.backgroundElement,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}>
                <Txt variant="subheading">{BUCKET_EMOJI[index]}</Txt>
                <Txt
                  variant="caption"
                  tone={selected ? 'onAccent' : 'primary'}
                  weight="700"
                  style={styles.label}
                  numberOfLines={1}>
                  {bucket.label}
                </Txt>
                <Txt variant="caption" tone={selected ? 'onAccent' : 'secondary'}>
                  kcal
                </Txt>
              </Press>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
