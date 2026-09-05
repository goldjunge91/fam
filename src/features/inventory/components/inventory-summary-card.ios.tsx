import { View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
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
      className="flex-row gap-three"
      accessible
      accessibilityLabel={`${criticalCount} Artikel laufen bald ab, ${soonCount} bald fällig, ${totalCount} insgesamt im Vorrat`}>
      <Card className="min-h-[176px] flex-1 items-center justify-center gap-three">
        <ProgressRing
          preset="compact"
          value={criticalCount}
          target={totalCount}
          displayMode="none"
          animated={false}
          progressColor={colors.danger}
          label="Läuft bald ab">
          <Txt variant="subheading" weight="700">
            {criticalCount}
          </Txt>
        </ProgressRing>
        <Txt variant="body" weight="700" center>
          Läuft{' '}
          <Txt variant="body" tone="secondary" weight="700">
            bald ab
          </Txt>
        </Txt>
      </Card>

      <Card className="min-h-[176px] flex-1 items-center justify-center gap-three">
        <ProgressRing
          preset="compact"
          value={soonCount}
          target={totalCount}
          displayMode="none"
          animated={false}
          progressColor={colors.warning}
          label="Bald fällig">
          <Txt variant="subheading" weight="700">
            {soonCount}
          </Txt>
        </ProgressRing>
        <Txt variant="body" weight="700" center>
          Bald{' '}
          <Txt variant="body" tone="secondary" weight="700">
            fällig
          </Txt>
        </Txt>
      </Card>
    </View>
  );
}
