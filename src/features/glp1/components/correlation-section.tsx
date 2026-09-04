import { useState } from 'react';
import { View } from 'react-native';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Txt } from '@/constants/ui';
import type { CorrelationSeriesPoint } from '@/features/glp1/domain/correlation-series';

type CorrelationSectionProps = {
  series: CorrelationSeriesPoint[];
};

type CorrelationPeriod = '14' | '30' | '90';

const PERIOD_OPTIONS = [
  { value: '14', label: '14 Tage' },
  { value: '30', label: '30 Tage' },
  { value: '90', label: '90 Tage' },
] as const;

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatCalories(calories: number | null): string {
  return calories === null
    ? 'Keine Kalorien'
    : `${Math.round(calories).toLocaleString('de-DE')} kcal`;
}

function formatWeight(weightKg: number | null): string {
  return weightKg === null
    ? 'Kein Gewicht'
    : `${weightKg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`;
}

function CorrelationRow({ point }: { point: CorrelationSeriesPoint }) {
  return (
    <View className="gap-one border-b border-border py-two">
      <View className="flex-row items-center justify-between gap-two">
        <Txt variant="label" weight="700">
          {formatDate(point.date)}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {point.daysSinceInjection === null
            ? 'Noch keine Injektion'
            : `Tag ${point.daysSinceInjection}`}
        </Txt>
      </View>

      {point.injection ? (
        <View className="flex-row flex-wrap items-center gap-two">
          <Txt variant="caption" tone="secondary">
            Injektion {point.injection.dose ?? '–'} {point.injection.unit}
          </Txt>
          {point.doseChanged ? (
            <Txt variant="caption" tone="warning">
              Dosis geändert
            </Txt>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row items-center justify-between gap-two">
        <Txt variant="body">{formatCalories(point.calories)}</Txt>
        <Txt variant="body">{formatWeight(point.weightKg)}</Txt>
      </View>
    </View>
  );
}

export function CorrelationSection({ series }: CorrelationSectionProps) {
  const [period, setPeriod] = useState<CorrelationPeriod>('14');
  const visibleSeries = series.slice(-Number(period));

  return (
    <View className="gap-two">
      <Txt variant="label" weight="700">
        Injektion, Kalorien und Gewicht
      </Txt>
      <SegmentedControl
        label="Auswertungszeitraum"
        options={PERIOD_OPTIONS}
        selected={period}
        onSelect={setPeriod}
        size="compact"
      />
      <View>
        {visibleSeries.map((point) => (
          <CorrelationRow key={point.date} point={point} />
        ))}
      </View>
    </View>
  );
}
