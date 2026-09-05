import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { radius, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useGlassAvailable } from '@/components/ui/glass-card';
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
  const canUseGlass = useGlassAvailable();

  const cardStyle = {
    flex: 1,
    minHeight: 176,
    borderRadius: radius.xl,
    borderCurve: 'continuous' as const,
    boxShadow: `0 16px 30px ${withAlpha(colors.text, 0.16)}`,
  };

  function renderCard(value: number, color: string, label: ReactNode) {
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
          <Txt variant="title" weight="700" className="text-center">
            {value}
          </Txt>
        </ProgressRing>
        {label}
      </>
    );

    if (canUseGlass) {
      return (
        <View style={cardStyle}>
          <GlassView
            glassEffectStyle="regular"
            style={{
              flex: 1,
              minHeight: 176,
              borderRadius: radius.xl,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              paddingHorizontal: 10,
              paddingVertical: 18,
            }}>
            {content}
          </GlassView>
        </View>
      );
    }

    return (
      <View className="inventory-summary-ring-card" style={cardStyle}>
        {content}
      </View>
    );
  }

  return (
    <View
      accessible
      aria-label={`${criticalCount} Artikel laufen bald ab, ${soonCount} bald fällig, ${totalCount} insgesamt im Vorrat`}
      className="inventory-summary-row">
      {renderCard(
        criticalCount,
        colors.danger,
        <Txt variant="body" weight="700" className="text-center">
          Läuft{' '}
          <Txt variant="body" tone="secondary" weight="700">
            bald ab
          </Txt>
        </Txt>,
      )}

      {renderCard(
        soonCount,
        colors.warning,
        <Txt variant="body" weight="700" className="text-center">
          Bald{' '}
          <Txt variant="body" tone="secondary" weight="700">
            fällig
          </Txt>
        </Txt>,
      )}
    </View>
  );
}
