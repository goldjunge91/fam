import { View } from 'react-native';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Txt } from '@/constants/ui';

type InventorySummaryCardProps = {
  totalCount: number;
  criticalCount: number;
  soonCount: number;
};

export function InventorySummaryCard({
  totalCount,
  criticalCount,
  soonCount,
}: InventorySummaryCardProps) {
  const { colors } = useTheme();

  return (
    <View
      accessible
      aria-label={`${criticalCount} Artikel laufen bald ab, ${soonCount} bald fällig, ${totalCount} insgesamt im Vorrat`}
      className="inventory-summary-row">
      <View
        className="inventory-summary-ring-card"
        // boxShadow (dynamische Opazitaet) und borderCurve (kein Tailwind-
        // Aequivalent) sind Ausnahmen.
        style={{
          boxShadow: `0 10px 24px ${withAlpha(colors.text, 0.14)}`,
          borderCurve: 'continuous',
        }}>
        <ProgressRing
          preset="compact"
          value={criticalCount}
          target={totalCount}
          displayMode="count"
          animated={false}
          progressColor={colors.tomato}
          trackColor={withAlpha(colors.tomato, 0.16)}
          label="Läuft bald ab"
        />
        <Txt variant="body" tone="secondary" className="text-center">
          Läuft bald ab
        </Txt>
      </View>

      <View
        className="inventory-summary-ring-card"
        style={{
          boxShadow: `0 10px 24px ${withAlpha(colors.text, 0.14)}`,
          borderCurve: 'continuous',
        }}>
        <ProgressRing
          preset="compact"
          value={soonCount}
          target={totalCount}
          displayMode="count"
          animated={false}
          progressColor={colors.carrot}
          trackColor={withAlpha(colors.carrot, 0.16)}
          label="Bald fällig"
        />
        <Txt variant="body" tone="secondary" className="text-center">
          Bald fällig
        </Txt>
      </View>
    </View>
  );
}
