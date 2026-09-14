import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Press, Txt } from '@/constants/ui';
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

const styles = StyleSheet.create((theme) => ({
  card: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth.base,
    overflow: 'hidden',
  },
  stripe: {
    width: 8,
    alignSelf: 'stretch',
    marginVertical: 2,
    borderRadius: theme.radius.sm,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  statusRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
  },
  trailing: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 2,
  },
}));

function withColorAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

export function StoreSummaryCard({
  name,
  color,
  totalCount,
  checkedCount,
  totalEstimate,
  openCategoryColors,
  onPress,
}: StoreSummaryCardProps) {
  const { t } = useTranslation();
  const { colors: theme } = useTheme();
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;
  const isComplete = totalCount > 0 && checkedCount === totalCount;
  const visibleDots = openCategoryColors.slice(0, MAX_CATEGORY_DOTS);

  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('shoppingList.storeSummaryCard.accessibility', {
        name,
        checked: checkedCount,
        total: totalCount,
        estimate: formatEuro(totalEstimate),
      })}
      style={[
        styles.card,
        {
          backgroundColor: withColorAlpha(color, '16'),
          borderColor: withColorAlpha(color, '66'),
        },
      ]}
      haptic="light">
      {/* Dynamische Markt-Farbe aus der Datenbank */}
      <View style={[styles.stripe, { backgroundColor: color }]} />

      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Txt variant="body" weight="700" numberOfLines={1} style={styles.title}>
            {name}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {checkedCount} / {totalCount}
          </Txt>
        </View>
        <ProgressBar height={4} value={progress} color={isComplete ? theme.success : color} />
        <View style={styles.statusRow}>
          {totalCount === 0 ? (
            <Txt variant="caption" tone="secondary">
              {t('shoppingList.storeSummaryCard.noItems')}
            </Txt>
          ) : isComplete ? (
            <Txt variant="caption" tone="success" weight="600">
              {t('shoppingList.storeSummaryCard.allDone')}
            </Txt>
          ) : (
            <>
              {visibleDots.map((dotColor) => (
                // Farben sind bereits dedupliziert und daher eindeutige Keys.
                <View key={dotColor} style={[styles.dot, { backgroundColor: dotColor }]} />
              ))}
              <Txt variant="caption" tone="secondary">
                {t('shoppingList.storeSummaryCard.open')}
              </Txt>
            </>
          )}
        </View>
      </View>

      <View style={styles.trailing}>
        <Txt variant="body" weight="700">
          {formatEuro(totalEstimate)}
        </Txt>
        <Txt variant="body" tone="secondary">
          {t('shoppingList.storeSummaryCard.estimated')}
        </Txt>
      </View>
    </Press>
  );
}
