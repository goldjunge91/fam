import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SegmentedControl, Txt } from '@/constants/ui';
import type { CorrelationSeriesPoint } from '@/features/glp1/domain/correlation-series';

type CorrelationSectionProps = {
  series: CorrelationSeriesPoint[];
};

type CorrelationPeriod = '14' | '30' | '90';

const PERIOD_OPTIONS = ['14', '30', '90'] as const;

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.space.sm,
  },
  row: {
    gap: theme.space.xs,
    paddingVertical: theme.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  injection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
}));

function formatDate(date: string, locale: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatCalories(calories: number | null, locale: string, t: TFunction): string {
  return calories === null
    ? t('glp1.correlation.noCalories')
    : `${Math.round(calories).toLocaleString(locale)} kcal`;
}

function formatWeight(weightKg: number | null, locale: string, t: TFunction): string {
  return weightKg === null
    ? t('glp1.correlation.noWeight')
    : `${weightKg.toLocaleString(locale, { maximumFractionDigits: 1 })} kg`;
}

function CorrelationRow({
  point,
  locale,
  t,
}: {
  point: CorrelationSeriesPoint;
  locale: string;
  t: TFunction;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Txt variant="label" weight="700">
          {formatDate(point.date, locale)}
        </Txt>
        <Txt variant="caption" tone="secondary">
          {point.daysSinceInjection === null
            ? t('glp1.correlation.noInjection')
            : t('glp1.correlation.day', { count: point.daysSinceInjection })}
        </Txt>
      </View>

      {point.injection ? (
        <View style={styles.injection}>
          <Txt variant="caption" tone="secondary">
            {t('glp1.correlation.injection', {
              dose: point.injection.dose ?? '–',
              unit: point.injection.unit,
            })}
          </Txt>
          {point.doseChanged ? (
            <Txt variant="caption" tone="warning">
              {t('glp1.correlation.doseChanged')}
            </Txt>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metrics}>
        <Txt variant="body">{formatCalories(point.calories, locale, t)}</Txt>
        <Txt variant="body">{formatWeight(point.weightKg, locale, t)}</Txt>
      </View>
    </View>
  );
}

export function CorrelationSection({ series }: CorrelationSectionProps) {
  const [period, setPeriod] = useState<CorrelationPeriod>('14');
  const { i18n, t } = useTranslation();
  const visibleSeries = series.slice(-Number(period));
  const periodOptions = PERIOD_OPTIONS.map((value) => ({
    value,
    label: t('glp1.correlation.days', { count: Number(value) }),
  }));

  return (
    <View style={styles.root}>
      <Txt variant="label" weight="700">
        {t('glp1.correlation.sectionTitle')}
      </Txt>
      <SegmentedControl
        label={t('glp1.correlation.periodLabel')}
        options={periodOptions}
        selected={period}
        onSelect={setPeriod}
        selectionRole="tab"
        size="compact"
      />
      <View>
        {visibleSeries.map((point) => (
          <CorrelationRow key={point.date} point={point} locale={i18n.language} t={t} />
        ))}
      </View>
    </View>
  );
}
