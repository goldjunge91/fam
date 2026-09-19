import type { SanitizedQualityPayload } from './quality-snapshot';

export const DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT = 10;

export type QualityMetricKey = keyof SanitizedQualityPayload['metrics'];
export type QualityMetricStatus = 'unavailable' | 'insufficient' | 'pass' | 'fail';
export type QualityMetricUnit = 'percent' | 'milliseconds';
export type QualityMetricTargetDirection = 'atLeast' | 'atMost';

export type QualityMetricDefinition = {
  key: QualityMetricKey;
  unit: QualityMetricUnit;
  targetValue: number;
  targetDirection: QualityMetricTargetDirection;
};

const METRIC_DEFINITIONS: Record<QualityMetricKey, QualityMetricDefinition> = {
  automaticAccuracyPercent: {
    key: 'automaticAccuracyPercent',
    unit: 'percent',
    targetValue: 95,
    targetDirection: 'atLeast',
  },
  falseListPercent: {
    key: 'falseListPercent',
    unit: 'percent',
    targetValue: 1,
    targetDirection: 'atMost',
  },
  manualCorrectionPercent: {
    key: 'manualCorrectionPercent',
    unit: 'percent',
    targetValue: 10,
    targetDirection: 'atMost',
  },
  medianTimeToAddMs: {
    key: 'medianTimeToAddMs',
    unit: 'milliseconds',
    targetValue: 6_000,
    targetDirection: 'atMost',
  },
};

export const QUALITY_METRIC_DEFINITIONS = Object.values(METRIC_DEFINITIONS);

export type QualityMetricEvaluation = QualityMetricDefinition & {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  sampleCount: number;
  minimumSampleCount: number;
  status: QualityMetricStatus;
};

export type QualityEvaluation = {
  [key in QualityMetricKey]: QualityMetricEvaluation;
};

export type QualityEvaluationOptions = {
  minimumSampleCount?: number;
};

type NormalizedMetricSnapshot = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  sampleCount: number;
  valid: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function normalizeMetricSnapshot(input: unknown): NormalizedMetricSnapshot {
  if (!isRecord(input)) {
    return { value: null, numerator: null, denominator: null, sampleCount: 0, valid: false };
  }

  let valid = true;
  let value: number | null = null;
  let numerator: number | null = null;
  let denominator: number | null = null;

  if (input.value === null) {
    value = null;
  } else if (isFiniteNonNegativeNumber(input.value)) {
    value = input.value;
  } else {
    valid = false;
  }

  if (input.numerator === null) {
    numerator = null;
  } else if (isNonNegativeInteger(input.numerator)) {
    numerator = input.numerator;
  } else {
    valid = false;
  }

  if (input.denominator === null) {
    denominator = null;
  } else if (isNonNegativeInteger(input.denominator)) {
    denominator = input.denominator;
  } else {
    valid = false;
  }

  const sampleCount = isNonNegativeInteger(input.sampleCount) ? input.sampleCount : 0;
  if (!isNonNegativeInteger(input.sampleCount)) valid = false;

  return { value, numerator, denominator, sampleCount, valid };
}

function resolveMinimumSampleCount(value: number | undefined): number {
  return isNonNegativeInteger(value) && value > 0 ? value : DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT;
}

function hasValidMetricShape(
  metric: NormalizedMetricSnapshot,
  definition: QualityMetricDefinition,
): boolean {
  if (!metric.valid) return false;

  if (definition.unit === 'percent') {
    if (
      metric.value === null ||
      metric.value > 100 ||
      metric.numerator === null ||
      metric.denominator === null ||
      metric.numerator > metric.denominator ||
      metric.sampleCount !== metric.denominator
    ) {
      return false;
    }

    const expectedValue = (metric.numerator / metric.denominator) * 100;
    return metric.value === expectedValue;
  }

  return (
    metric.numerator === null &&
    metric.denominator === null &&
    ((metric.sampleCount === 0 && metric.value === null) ||
      (metric.sampleCount > 0 && metric.value !== null))
  );
}

function evaluateMetric(
  input: unknown,
  definition: QualityMetricDefinition,
  minimumSampleCount: number,
): QualityMetricEvaluation {
  const metric = normalizeMetricSnapshot(input);
  const value = metric.value;
  const validShape = hasValidMetricShape(metric, definition);
  const hasData =
    validShape &&
    value !== null &&
    (definition.unit === 'percent'
      ? metric.denominator !== null && metric.denominator > 0
      : metric.sampleCount > 0);

  let status: QualityMetricStatus;
  if (!hasData || value === null) {
    status = 'unavailable';
  } else if (metric.sampleCount < minimumSampleCount) {
    status = 'insufficient';
  } else {
    const reachesTarget =
      definition.targetDirection === 'atLeast'
        ? value >= definition.targetValue
        : value <= definition.targetValue;
    status = reachesTarget ? 'pass' : 'fail';
  }

  return {
    ...definition,
    value: metric.value,
    numerator: metric.numerator,
    denominator: metric.denominator,
    sampleCount: metric.sampleCount,
    minimumSampleCount,
    status,
  };
}

export function evaluateQualitySnapshot(
  payload: SanitizedQualityPayload,
  options: QualityEvaluationOptions = {},
): QualityEvaluation {
  const minimumSampleCount = resolveMinimumSampleCount(options.minimumSampleCount);

  return {
    automaticAccuracyPercent: evaluateMetric(
      payload.metrics.automaticAccuracyPercent,
      METRIC_DEFINITIONS.automaticAccuracyPercent,
      minimumSampleCount,
    ),
    falseListPercent: evaluateMetric(
      payload.metrics.falseListPercent,
      METRIC_DEFINITIONS.falseListPercent,
      minimumSampleCount,
    ),
    manualCorrectionPercent: evaluateMetric(
      payload.metrics.manualCorrectionPercent,
      METRIC_DEFINITIONS.manualCorrectionPercent,
      minimumSampleCount,
    ),
    medianTimeToAddMs: evaluateMetric(
      payload.metrics.medianTimeToAddMs,
      METRIC_DEFINITIONS.medianTimeToAddMs,
      minimumSampleCount,
    ),
  };
}
