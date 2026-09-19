import {
  DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT,
  evaluateQualitySnapshot,
  type QualityEvaluation,
  type QualityMetricEvaluation,
  type QualityMetricKey,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-evaluator';
import { getBetaQualityMetricSnapshots } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-metrics';
import type { SanitizedQualityPayload } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-snapshot';
import type { ExperimentVariant } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-experiment';
import type { BetaQualityMetrics } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/types';
import { METRIC_KEYS, type QualityFlagKey } from './quality-cohort-report-parser';

export type QualityCohortOverallStatus = 'unavailable' | 'insufficient' | 'pass' | 'fail';

export type QualityCohortReport = Readonly<{
  reportSchemaVersion: 1;
  reportKind: 'quality-cohort';
  experimentVariant: ExperimentVariant | null;
  fixtureSetVersion: string | null;
  snapshotCount: number;
  overallStatus: QualityCohortOverallStatus;
  aggregation: Readonly<{
    mode: 'weighted-counters';
    confirmedItemCount: number;
    automaticAssignmentCount: number;
    correctAutomaticAssignmentCount: number;
    falseListAssignmentCount: number;
    manualCorrectionCount: number;
    durationSampleCount: number;
    durationSampleCoverage: 'none' | 'provided-samples-only';
    qualityFlags: Readonly<Record<QualityFlagKey, number>>;
  }>;
  metrics: QualityEvaluation;
  dataQuality: Readonly<{
    minimumSampleCount: number;
    sufficientSampleForAllMetrics: boolean;
    insufficientMetricKeys: readonly QualityMetricKey[];
    unavailableMetricKeys: readonly QualityMetricKey[];
    warnings: readonly string[];
  }>;
}>;

function emptyQualityFlags(): Record<QualityFlagKey, number> {
  return {
    unparsedTextPresent: 0,
    ambiguousItemBoundary: 0,
    semanticItemMismatch: 0,
    incorrectAutomaticAssignment: 0,
    manualCorrection: 0,
  };
}
function aggregateMetrics(snapshots: readonly SanitizedQualityPayload[]): {
  metrics: BetaQualityMetrics;
  qualityFlags: Record<QualityFlagKey, number>;
} {
  const completionDurationsMs: number[] = [];
  const metrics: BetaQualityMetrics = {
    confirmedItemCount: 0,
    automaticAssignmentCount: 0,
    correctAutomaticAssignmentCount: 0,
    falseListAssignmentCount: 0,
    manualCorrectionCount: 0,
    qualityFlagCounts: {
      unparsed_text_present: 0,
      ambiguous_item_boundary: 0,
      semantic_item_mismatch: 0,
      incorrect_automatic_assignment: 0,
      manual_correction: 0,
    },
    completionDurationsMs,
    recordedObservationIds: [],
    measuredSessionIds: [],
  };
  const qualityFlags = emptyQualityFlags();

  for (const snapshot of snapshots) {
    metrics.confirmedItemCount += snapshot.confirmedItemCount;
    metrics.automaticAssignmentCount += snapshot.automaticAssignmentCount;
    metrics.correctAutomaticAssignmentCount += snapshot.correctAutomaticAssignmentCount;
    metrics.falseListAssignmentCount += snapshot.falseListAssignmentCount;
    metrics.manualCorrectionCount += snapshot.manualCorrectionCount;
    completionDurationsMs.push(...snapshot.durationSamplesMs);
    qualityFlags.unparsedTextPresent += snapshot.qualityFlags.unparsedTextPresent;
    qualityFlags.ambiguousItemBoundary += snapshot.qualityFlags.ambiguousItemBoundary;
    qualityFlags.semanticItemMismatch += snapshot.qualityFlags.semanticItemMismatch;
    qualityFlags.incorrectAutomaticAssignment += snapshot.qualityFlags.incorrectAutomaticAssignment;
    qualityFlags.manualCorrection += snapshot.qualityFlags.manualCorrection;
  }

  metrics.qualityFlagCounts = {
    unparsed_text_present: qualityFlags.unparsedTextPresent,
    ambiguous_item_boundary: qualityFlags.ambiguousItemBoundary,
    semantic_item_mismatch: qualityFlags.semanticItemMismatch,
    incorrect_automatic_assignment: qualityFlags.incorrectAutomaticAssignment,
    manual_correction: qualityFlags.manualCorrection,
  };
  return { metrics, qualityFlags };
}

function aggregatePayload(
  snapshots: readonly SanitizedQualityPayload[],
  metrics: BetaQualityMetrics,
  qualityFlags: Record<QualityFlagKey, number>,
  metadata: Readonly<{
    experimentVariant: ExperimentVariant | null;
    fixtureSetVersion: string | null;
  }>,
): SanitizedQualityPayload {
  return {
    schemaVersion: 2,
    snapshotVersion: 1,
    metricDefinitionVersion: 1,
    captureKind: 'quality-snapshot',
    fixtureSetVersion: metadata.fixtureSetVersion,
    experimentVariant: metadata.experimentVariant ?? 'baseline',
    createdAt: snapshots[0]?.createdAt ?? '1970-01-01T00:00:00.000Z',
    confirmedItemCount: metrics.confirmedItemCount,
    automaticAssignmentCount: metrics.automaticAssignmentCount,
    correctAutomaticAssignmentCount: metrics.correctAutomaticAssignmentCount,
    falseListAssignmentCount: metrics.falseListAssignmentCount,
    manualCorrectionCount: metrics.manualCorrectionCount,
    durationSamplesMs: metrics.completionDurationsMs,
    qualityFlags,
    metrics: getBetaQualityMetricSnapshots(metrics),
  };
}

function readCohortMetadata(snapshots: readonly SanitizedQualityPayload[]): {
  experimentVariant: ExperimentVariant | null;
  fixtureSetVersion: string | null;
} {
  const firstSnapshot = snapshots[0];
  if (!firstSnapshot) {
    return { experimentVariant: null, fixtureSetVersion: null };
  }

  for (const [index, snapshot] of snapshots.entries()) {
    if (snapshot.captureKind !== firstSnapshot.captureKind) {
      throw new Error(
        `Cohort darf keine unterschiedlichen Capture-Typen mischen (Snapshot ${index + 1}).`,
      );
    }
    if (snapshot.experimentVariant !== firstSnapshot.experimentVariant) {
      throw new Error(
        `Cohort darf keine unterschiedlichen Experiment-Varianten mischen (Snapshot ${index + 1}).`,
      );
    }
    if (snapshot.fixtureSetVersion !== firstSnapshot.fixtureSetVersion) {
      throw new Error(
        `Cohort darf keine unterschiedlichen Fixture-Sets mischen (Snapshot ${index + 1}).`,
      );
    }
  }

  return {
    experimentVariant: firstSnapshot.experimentVariant,
    fixtureSetVersion: firstSnapshot.fixtureSetVersion,
  };
}

function statusForEvaluation(evaluation: QualityEvaluation): QualityCohortOverallStatus {
  const statuses = METRIC_KEYS.map((key) => evaluation[key].status);
  if (statuses.every((status) => status === 'unavailable')) return 'unavailable';
  if (statuses.some((status) => status === 'unavailable')) return 'unavailable';
  if (statuses.some((status) => status === 'insufficient')) return 'insufficient';
  if (statuses.some((status) => status === 'fail')) return 'fail';
  return 'pass';
}

function metricLabel(key: QualityMetricKey): string {
  switch (key) {
    case 'automaticAccuracyPercent':
      return 'Automatische Genauigkeit';
    case 'falseListPercent':
      return 'Falsche Liste';
    case 'manualCorrectionPercent':
      return 'Manuelle Korrektur';
    case 'medianTimeToAddMs':
      return 'Zeit bis zum Hinzufügen';
  }
}

function metricStatusLabel(metric: QualityMetricEvaluation): string {
  switch (metric.status) {
    case 'pass':
      return 'Ziel erreicht';
    case 'fail':
      return 'Ziel verfehlt';
    case 'insufficient':
      return 'Zu wenig Daten';
    case 'unavailable':
      return 'Nicht verfügbar';
  }
}

function metricValueLabel(metric: QualityMetricEvaluation): string {
  if (metric.value === null) return 'nicht bestimmbar';
  return metric.unit === 'percent' ? `${metric.value} %` : `${metric.value} ms`;
}

function metricBasisLabel(metric: QualityMetricEvaluation): string {
  if (metric.unit === 'milliseconds') return `${metric.sampleCount} Zeit-Samples`;
  return `${metric.numerator ?? '—'} / ${metric.denominator ?? '—'} Beobachtungen`;
}

function metricTargetLabel(metric: QualityMetricEvaluation): string {
  const direction = metric.targetDirection === 'atLeast' ? '≥' : '≤';
  const unit = metric.unit === 'percent' ? '%' : 'ms';
  return `${direction} ${metric.targetValue} ${unit}`;
}

/** Aggregates counters and samples from already validated, sanitized snapshots. */
export function buildQualityCohortReport(
  snapshots: readonly SanitizedQualityPayload[],
): QualityCohortReport {
  const metadata = readCohortMetadata(snapshots);
  const { metrics: aggregate, qualityFlags } = aggregateMetrics(snapshots);
  const evaluation = evaluateQualitySnapshot(
    aggregatePayload(snapshots, aggregate, qualityFlags, metadata),
  );
  const insufficientMetricKeys = METRIC_KEYS.filter(
    (key) => evaluation[key].status === 'insufficient',
  );
  const unavailableMetricKeys = METRIC_KEYS.filter(
    (key) => evaluation[key].status === 'unavailable',
  );
  const overallStatus = snapshots.length === 0 ? 'unavailable' : statusForEvaluation(evaluation);
  const warnings: string[] = [];

  if (snapshots.length === 0) warnings.push('Keine Snapshots vorhanden.');
  if (unavailableMetricKeys.length > 0) {
    warnings.push('Mindestens eine Metrik hat keinen gültigen Nenner oder keine Samples.');
  }
  if (insufficientMetricKeys.length > 0) {
    warnings.push('Mindestens eine Metrik liegt unter der Mindeststichprobe von 10.');
  }
  if (snapshots.length > 0) {
    warnings.push(
      'Die Zeitmetrik beschreibt nur die übergebenen Samples; der lokale Speicher begrenzt Samples je Snapshot auf 64.',
    );
  }

  return {
    reportSchemaVersion: 1,
    reportKind: 'quality-cohort',
    experimentVariant: metadata.experimentVariant,
    fixtureSetVersion: metadata.fixtureSetVersion,
    snapshotCount: snapshots.length,
    overallStatus,
    aggregation: {
      mode: 'weighted-counters',
      confirmedItemCount: aggregate.confirmedItemCount,
      automaticAssignmentCount: aggregate.automaticAssignmentCount,
      correctAutomaticAssignmentCount: aggregate.correctAutomaticAssignmentCount,
      falseListAssignmentCount: aggregate.falseListAssignmentCount,
      manualCorrectionCount: aggregate.manualCorrectionCount,
      durationSampleCount: aggregate.completionDurationsMs.length,
      durationSampleCoverage: snapshots.length === 0 ? 'none' : 'provided-samples-only',
      qualityFlags,
    },
    metrics: evaluation,
    dataQuality: {
      minimumSampleCount: DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT,
      sufficientSampleForAllMetrics:
        snapshots.length > 0 &&
        insufficientMetricKeys.length === 0 &&
        unavailableMetricKeys.length === 0,
      insufficientMetricKeys,
      unavailableMetricKeys,
      warnings,
    },
  };
}

export function renderQualityCohortText(report: QualityCohortReport): string {
  const lines = [
    'fam Qualitäts-Kohortenreport',
    `Snapshots: ${report.snapshotCount}`,
    `Variante: ${report.experimentVariant ?? '—'}`,
    `Fixture-Set: ${report.fixtureSetVersion ?? '—'}`,
    `Gesamtstatus: ${report.overallStatus}`,
    'Aggregation: gewichtete Zähler/Nenner',
    '',
    'Datengrundlage',
    `Bestätigte Artikel: ${report.aggregation.confirmedItemCount}`,
    `Automatische Zuordnungen: ${report.aggregation.automaticAssignmentCount}`,
    `Zeit-Samples: ${report.aggregation.durationSampleCount}`,
    '',
    'Metriken',
  ];

  for (const key of METRIC_KEYS) {
    const metric = report.metrics[key];
    lines.push(
      `${metricLabel(key)}: ${metricValueLabel(metric)} | ${metricStatusLabel(metric)} | Basis ${metricBasisLabel(metric)} | Ziel ${metricTargetLabel(metric)}`,
    );
  }

  if (report.dataQuality.warnings.length > 0) {
    lines.push('', 'Hinweise', ...report.dataQuality.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join('\n');
}
