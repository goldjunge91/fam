import type {
  BetaQualityMetrics,
  BetaStorageState,
  QualityFlag,
  QualityFlagCounts,
} from '../types';

const MAX_COMPLETION_DURATION_SAMPLES = 64;
const MAX_IDEMPOTENCY_KEYS = 512;
const QUALITY_FLAGS: readonly QualityFlag[] = [
  'unparsed_text_present',
  'ambiguous_item_boundary',
  'semantic_item_mismatch',
  'incorrect_automatic_assignment',
  'manual_correction',
];

export type BetaQualityObservation = {
  id: string;
  sessionId: string;
  predictedAutomatically: boolean;
  assignmentCorrect: boolean;
  manuallyCorrected: boolean;
  durationMs: number | null;
  qualityFlags?: readonly QualityFlag[];
};

export type BetaMetricSnapshot = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  sampleCount: number;
};

export type BetaQualityMetricSnapshots = {
  automaticAccuracyPercent: BetaMetricSnapshot;
  falseListPercent: BetaMetricSnapshot;
  manualCorrectionPercent: BetaMetricSnapshot;
  medianTimeToAddMs: BetaMetricSnapshot;
};

export type BetaQualityMetricSnapshot = {
  automaticAccuracyPercent: number | null;
  falseListPercent: number | null;
  manualCorrectionPercent: number | null;
  medianTimeToAddMs: number | null;
};

export type BetaQualityPayload = {
  schemaVersion: 1;
  confirmedItemCount: number;
  automaticAssignmentCount: number;
  automaticAccuracyPercent: number | null;
  falseListPercent: number | null;
  manualCorrectionPercent: number | null;
  medianTimeToAddMs: number | null;
};

export function createEmptyBetaQualityMetrics(): BetaQualityMetrics {
  return {
    confirmedItemCount: 0,
    automaticAssignmentCount: 0,
    correctAutomaticAssignmentCount: 0,
    falseListAssignmentCount: 0,
    manualCorrectionCount: 0,
    qualityFlagCounts: createEmptyBetaQualityFlagCounts(),
    completionDurationsMs: [],
    recordedObservationIds: [],
    measuredSessionIds: [],
  };
}

export function createEmptyBetaQualityFlagCounts(): QualityFlagCounts {
  return {
    unparsed_text_present: 0,
    ambiguous_item_boundary: 0,
    semantic_item_mismatch: 0,
    incorrect_automatic_assignment: 0,
    manual_correction: 0,
  };
}

function isQualityFlag(value: string): value is QualityFlag {
  return QUALITY_FLAGS.includes(value as QualityFlag);
}

function isValidDuration(durationMs: number | null): durationMs is number {
  return durationMs !== null && Number.isFinite(durationMs) && durationMs >= 0;
}

export function recordBetaQualityObservations(
  state: BetaStorageState,
  observations: readonly BetaQualityObservation[],
): BetaStorageState {
  if (state.consent.qualityMetrics !== 'granted' || observations.length === 0) return state;

  const recordedObservationIds = new Set(state.qualityMetrics.recordedObservationIds);
  const measuredSessionIds = new Set(state.qualityMetrics.measuredSessionIds);
  const completionDurationsMs = [...state.qualityMetrics.completionDurationsMs];
  let confirmedItemCount = state.qualityMetrics.confirmedItemCount;
  let automaticAssignmentCount = state.qualityMetrics.automaticAssignmentCount;
  let correctAutomaticAssignmentCount = state.qualityMetrics.correctAutomaticAssignmentCount;
  let falseListAssignmentCount = state.qualityMetrics.falseListAssignmentCount;
  let manualCorrectionCount = state.qualityMetrics.manualCorrectionCount;
  const qualityFlagCounts = {
    ...createEmptyBetaQualityFlagCounts(),
    ...(state.qualityMetrics.qualityFlagCounts ?? {}),
  };
  let recordedAny = false;

  for (const observation of observations) {
    if (recordedObservationIds.has(observation.id)) continue;
    recordedObservationIds.add(observation.id);
    recordedAny = true;
    confirmedItemCount += 1;

    if (observation.predictedAutomatically) {
      automaticAssignmentCount += 1;
      if (observation.assignmentCorrect) correctAutomaticAssignmentCount += 1;
      if (!observation.assignmentCorrect) falseListAssignmentCount += 1;
    }
    if (observation.manuallyCorrected) manualCorrectionCount += 1;

    for (const qualityFlag of new Set(observation.qualityFlags ?? [])) {
      if (isQualityFlag(qualityFlag)) qualityFlagCounts[qualityFlag] += 1;
    }

    if (!measuredSessionIds.has(observation.sessionId) && isValidDuration(observation.durationMs)) {
      measuredSessionIds.add(observation.sessionId);
      completionDurationsMs.push(observation.durationMs);
    }
  }

  if (!recordedAny) return state;

  return {
    ...state,
    qualityMetrics: {
      confirmedItemCount,
      automaticAssignmentCount,
      correctAutomaticAssignmentCount,
      falseListAssignmentCount,
      manualCorrectionCount,
      qualityFlagCounts,
      completionDurationsMs: completionDurationsMs.slice(-MAX_COMPLETION_DURATION_SAMPLES),
      recordedObservationIds: [...recordedObservationIds].slice(-MAX_IDEMPOTENCY_KEYS),
      measuredSessionIds: [...measuredSessionIds].slice(-MAX_IDEMPOTENCY_KEYS),
    },
  };
}

function percentage(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : (numerator / denominator) * 100;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return lower === undefined || upper === undefined ? null : (lower + upper) / 2;
}

function ratioSnapshot(numerator: number, denominator: number): BetaMetricSnapshot {
  return {
    value: percentage(numerator, denominator),
    numerator,
    denominator,
    sampleCount: denominator,
  };
}

export function getBetaQualityMetricSnapshots(
  metrics: BetaQualityMetrics,
): BetaQualityMetricSnapshots {
  return {
    automaticAccuracyPercent: ratioSnapshot(
      metrics.correctAutomaticAssignmentCount,
      metrics.automaticAssignmentCount,
    ),
    falseListPercent: ratioSnapshot(
      metrics.falseListAssignmentCount,
      metrics.automaticAssignmentCount,
    ),
    manualCorrectionPercent: ratioSnapshot(
      metrics.manualCorrectionCount,
      metrics.confirmedItemCount,
    ),
    medianTimeToAddMs: {
      value: median(metrics.completionDurationsMs),
      numerator: null,
      denominator: null,
      sampleCount: metrics.completionDurationsMs.length,
    },
  };
}

export function getBetaQualityMetricSnapshot(
  metrics: BetaQualityMetrics,
): BetaQualityMetricSnapshot {
  const snapshots = getBetaQualityMetricSnapshots(metrics);

  return {
    automaticAccuracyPercent: snapshots.automaticAccuracyPercent.value,
    falseListPercent: snapshots.falseListPercent.value,
    manualCorrectionPercent: snapshots.manualCorrectionPercent.value,
    medianTimeToAddMs: snapshots.medianTimeToAddMs.value,
  };
}

export function buildBetaQualityPayload(state: BetaStorageState): BetaQualityPayload | null {
  if (state.consent.qualityMetrics !== 'granted') return null;
  if (state.qualityMetrics.confirmedItemCount === 0) return null;

  return {
    schemaVersion: 1,
    confirmedItemCount: state.qualityMetrics.confirmedItemCount,
    automaticAssignmentCount: state.qualityMetrics.automaticAssignmentCount,
    ...getBetaQualityMetricSnapshot(state.qualityMetrics),
  };
}

export function getBetaCompletionDurationMs(startedAt: string, completedAt: string): number | null {
  const startedMillis = Date.parse(startedAt);
  const completedMillis = Date.parse(completedAt);
  if (!Number.isFinite(startedMillis) || !Number.isFinite(completedMillis)) return null;
  const durationMs = completedMillis - startedMillis;
  return durationMs >= 0 ? durationMs : null;
}
