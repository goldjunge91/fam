import type { BetaQualityMetrics, QualityFlagCounts } from '../types';
import { type BetaQualityMetricSnapshots, getBetaQualityMetricSnapshots } from './quality-metrics';
import type { ExperimentVariant } from './speech-experiment';

export type { ExperimentVariant } from './speech-experiment';

const MAX_DURATION_SAMPLES = 64;

export type QualityCaptureKind = 'quality-snapshot' | 'maestro-preview-test';

export type SanitizedQualityPayload = {
  schemaVersion: 2;
  snapshotVersion: 1;
  metricDefinitionVersion: 1;
  captureKind: QualityCaptureKind;
  fixtureSetVersion: string | null;
  experimentVariant: ExperimentVariant;
  createdAt: string;
  confirmedItemCount: number;
  automaticAssignmentCount: number;
  correctAutomaticAssignmentCount: number;
  falseListAssignmentCount: number;
  manualCorrectionCount: number;
  durationSamplesMs: readonly number[];
  qualityFlags: {
    unparsedTextPresent: number;
    ambiguousItemBoundary: number;
    semanticItemMismatch: number;
    incorrectAutomaticAssignment: number;
    manualCorrection: number;
  };
  metrics: BetaQualityMetricSnapshots;
};

export type QualitySnapshotInput = {
  metrics: BetaQualityMetrics;
  captureKind: QualityCaptureKind;
  fixtureSetVersion: string | null;
  experimentVariant: ExperimentVariant;
  createdAt: string;
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isExperimentVariant(value: unknown): value is ExperimentVariant {
  return value === 'baseline' || value === 'contextual-strings';
}

function isQualityCaptureKind(value: unknown): value is QualityCaptureKind {
  return value === 'quality-snapshot' || value === 'maestro-preview-test';
}

function normalizeCreatedAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function sanitizeFlagCounts(
  value: QualityFlagCounts,
): SanitizedQualityPayload['qualityFlags'] | null {
  if (
    !isNonNegativeInteger(value.unparsed_text_present) ||
    !isNonNegativeInteger(value.ambiguous_item_boundary) ||
    !isNonNegativeInteger(value.semantic_item_mismatch) ||
    !isNonNegativeInteger(value.incorrect_automatic_assignment) ||
    !isNonNegativeInteger(value.manual_correction)
  ) {
    return null;
  }

  return {
    unparsedTextPresent: value.unparsed_text_present,
    ambiguousItemBoundary: value.ambiguous_item_boundary,
    semanticItemMismatch: value.semantic_item_mismatch,
    incorrectAutomaticAssignment: value.incorrect_automatic_assignment,
    manualCorrection: value.manual_correction,
  };
}

export function sanitizeQualitySnapshot(
  input: QualitySnapshotInput,
): SanitizedQualityPayload | null {
  if (!isQualityCaptureKind(input.captureKind)) return null;
  if (input.fixtureSetVersion !== null && typeof input.fixtureSetVersion !== 'string') {
    return null;
  }
  if (!isExperimentVariant(input.experimentVariant)) return null;

  const createdAt = normalizeCreatedAt(input.createdAt);
  if (createdAt === null) return null;

  const metrics = input.metrics;
  const counters = [
    metrics.confirmedItemCount,
    metrics.automaticAssignmentCount,
    metrics.correctAutomaticAssignmentCount,
    metrics.falseListAssignmentCount,
    metrics.manualCorrectionCount,
  ];
  if (!counters.every(isNonNegativeInteger)) return null;

  if (metrics.automaticAssignmentCount > metrics.confirmedItemCount) return null;
  if (
    metrics.correctAutomaticAssignmentCount + metrics.falseListAssignmentCount !==
    metrics.automaticAssignmentCount
  ) {
    return null;
  }
  if (metrics.manualCorrectionCount > metrics.confirmedItemCount) return null;
  if (!Array.isArray(metrics.completionDurationsMs)) return null;
  if (!metrics.completionDurationsMs.every(isValidDuration)) return null;

  const qualityFlags = sanitizeFlagCounts(metrics.qualityFlagCounts);
  if (qualityFlags === null) return null;

  const durationSamplesMs = metrics.completionDurationsMs.slice(-MAX_DURATION_SAMPLES);
  const metricSnapshots = getBetaQualityMetricSnapshots({
    ...metrics,
    completionDurationsMs: durationSamplesMs,
  });

  return {
    schemaVersion: 2,
    snapshotVersion: 1,
    metricDefinitionVersion: 1,
    captureKind: input.captureKind,
    fixtureSetVersion: input.fixtureSetVersion,
    experimentVariant: input.experimentVariant,
    createdAt,
    confirmedItemCount: metrics.confirmedItemCount,
    automaticAssignmentCount: metrics.automaticAssignmentCount,
    correctAutomaticAssignmentCount: metrics.correctAutomaticAssignmentCount,
    falseListAssignmentCount: metrics.falseListAssignmentCount,
    manualCorrectionCount: metrics.manualCorrectionCount,
    durationSamplesMs,
    qualityFlags,
    metrics: metricSnapshots,
  };
}
