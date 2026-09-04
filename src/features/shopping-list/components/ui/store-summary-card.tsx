import { Pressable, View } from 'react-native';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Txt } from '@/constants/ui';
import { formatEuro } from '@/lib/format-currency';

interface StoreSummaryCardProps {
  name: string;
  color: string;
  totalCount: number;
  checkedCount: number;
  totalEstimate: number;
  /** Farben der Kategorien mit offenen Artikeln. */
  openCategoryColors: string[];
  onPress: () => void;
}

const MAX_CATEGORY_DOTS = 4;

export function StoreSummaryCard({
  name,
  color,
  totalCount,
  checkedCount,
  totalEstimate,
  openCategoryColors,
  onPress,
}: StoreSummaryCardProps) {
  const { colors: theme } = useTheme();
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;
  const isComplete = totalCount > 0 && checkedCount === totalCount;
  const visibleDots = openCategoryColors.slice(0, MAX_CATEGORY_DOTS);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${checkedCount} von ${totalCount} Artikeln, ${formatEuro(totalEstimate)} geschätzt`}
      className="store-summary-row">
      {/* Dynamische Markt-Farbe aus der Datenbank */}
      <View className="store-summary-stripe" style={{ backgroundColor: color }} />

      <View className="flex-1 gap-1">
        <View className="flex-row items-baseline justify-between gap-two">
          <Txt variant="body" weight="700" numberOfLines={1} className="flex-1">
            {name}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {checkedCount} / {totalCount}
          </Txt>
        </View>
        <ProgressBar height={3} value={progress} color={isComplete ? theme.basil : theme.basil} />
        <View className="flex-row items-center gap-1 mt-[1px]">
          {totalCount === 0 ? (
            <Txt variant="caption" tone="secondary">
              keine Artikel
            </Txt>
          ) : isComplete ? (
            <Txt variant="caption" tone="success" weight="600">
              alles erledigt
            </Txt>
          ) : (
            <>
              {visibleDots.map((dotColor) => (
                // Farben sind bereits dedupliziert und daher eindeutige Keys.
                <View
                  key={dotColor}
                  className="w-[7px] h-[7px] rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
              ))}
              <Txt variant="caption" tone="secondary">
                offen
              </Txt>
            </>
          )}
        </View>
      </View>

      <View className="items-end gap-[2px]">
        <Txt variant="body" weight="700">
          {formatEuro(totalEstimate)}
        </Txt>
        <Txt variant="body" tone="secondary">
          geschätzt
        </Txt>
      </View>
    </Pressable>
  );
}
