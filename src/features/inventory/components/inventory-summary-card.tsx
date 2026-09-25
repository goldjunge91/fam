import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Card, Txt } from '@/constants/ui';
import { uiShadowStyles } from '@/constants/ui-shadow';

const styles = StyleSheet.create((theme) => ({
  summaryRow: {
    flexDirection: 'row',
    // Preserve the tuned 14pt gap between the two rings.
    gap: theme.space.md + 2,
  },
  ringCard: {
    flex: 1,
    minHeight: 176,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.lg + 2,
  },
}));

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

  function renderCard(testID: string, value: number, color: string, label: ReactNode) {
    const content = (
      <>
        <ProgressRing
          size={86}
          strokeWidth={10}
          value={value}
          target={totalCount}
          displayMode="none"
          animated={false}
          progressColor={color}
          trackColor={withAlpha(color, 0.2)}
          label={typeof label === 'string' ? label : undefined}>
          <Txt variant="title" weight="700" center>
            {value}
          </Txt>
        </ProgressRing>
        {label}
      </>
    );

    return (
      <Card
        testID={testID}
        elevation="none"
        padded={false}
        style={[styles.ringCard, uiShadowStyles.prominentCard]}>
        {content}
      </Card>
    );
  }

  return (
    <View
      accessible
      aria-label={`${criticalCount} Artikel laufen bald ab, ${soonCount} bald fällig, ${totalCount} insgesamt im Vorrat`}
      style={styles.summaryRow}>
      {renderCard(
        'inventory-summary-critical',
        criticalCount,
        colors.danger,
        <Txt variant="body" weight="700" center>
          Läuft{' '}
          <Txt variant="body" tone="secondary" weight="700">
            bald ab
          </Txt>
        </Txt>,
      )}

      {renderCard(
        'inventory-summary-soon',
        soonCount,
        colors.warning,
        <Txt variant="body" weight="700" center>
          Bald{' '}
          <Txt variant="body" tone="secondary" weight="700">
            fällig
          </Txt>
        </Txt>,
      )}
    </View>
  );
}
