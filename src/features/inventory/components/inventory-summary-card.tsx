import { View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { ProgressRing } from '@/components/ui/progress-ring';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();

  return (
    <View
      accessible
      aria-label={`${criticalCount} Artikel laufen bald ab, ${soonCount} bald fällig, ${totalCount} insgesamt im Vorrat`}
      className="inventory-summary-row">
      <View
        className="inventory-summary-ring-card"
        // Dynamischer Schatten und borderCurve haben kein Tailwind-Aequivalent.
        style={{
          boxShadow: `0 10px 24px ${withAlpha(theme.shadowCard, 0.14)}`,
          borderCurve: 'continuous',
        }}>
        <ProgressRing
          preset="compact"
          value={criticalCount}
          target={totalCount}
          displayMode="count"
          animated={false}
          progressColor={theme.danger}
          trackColor={withAlpha(theme.danger, 0.16)}
          label="Läuft bald ab"
        />
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          Läuft bald ab
        </ThemedText>
      </View>

      <View
        className="inventory-summary-ring-card"
        style={{
          boxShadow: `0 10px 24px ${withAlpha(theme.shadowCard, 0.14)}`,
          borderCurve: 'continuous',
        }}>
        <ProgressRing
          preset="compact"
          value={soonCount}
          target={totalCount}
          displayMode="count"
          animated={false}
          progressColor={theme.warning}
          trackColor={withAlpha(theme.warning, 0.16)}
          label="Bald fällig"
        />
        <ThemedText type="small" themeColor="textSecondary" className="text-center">
          Bald fällig
        </ThemedText>
      </View>
    </View>
  );
}
