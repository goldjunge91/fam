import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { space } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Card } from '@/components/ui/card';
import { Button, Row, Txt } from '@/constants/ui';
import { buildQualityCohortReport } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-cohort-report';
import {
  DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT,
  type QualityEvaluation,
  type QualityMetricEvaluation,
  type QualityMetricKey,
  type QualityMetricStatus,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-evaluator';
import type { SanitizedQualityPayload } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-snapshot';
import {
  copyQualitySnapshotExport,
  type QualitySnapshotExportReady,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/services/quality-snapshot-export';
import type { BetaStorageState } from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/types';
import { styles } from './dev-quality-metrics-screen.styles';

export type QualityViewState =
  | { kind: 'loading' }
  | { kind: 'no-session' }
  | { kind: 'consent'; consent: BetaStorageState['consent']['qualityMetrics'] }
  | { kind: 'empty' }
  | {
      kind: 'ready';
      snapshot: QualitySnapshotExportReady;
      evaluation: QualityEvaluation;
    }
  | { kind: 'error'; message: string };

export type TestMeasurementSummary = {
  count: number;
  variant: SanitizedQualityPayload['experimentVariant'];
  fixtureSetVersion: SanitizedQualityPayload['fixtureSetVersion'];
  confirmedItemCount: number;
  automaticAssignmentCount: number;
  evaluation: QualityEvaluation;
};

const METRIC_LABELS: Record<QualityMetricKey, string> = {
  automaticAccuracyPercent: 'Automatische Genauigkeit',
  falseListPercent: 'Falsche Liste',
  manualCorrectionPercent: 'Manuelle Korrektur',
  medianTimeToAddMs: 'Zeit bis zum Hinzufügen',
};

const METRIC_ORDER: readonly QualityMetricKey[] = [
  'automaticAccuracyPercent',
  'falseListPercent',
  'manualCorrectionPercent',
  'medianTimeToAddMs',
];

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatMetricValue(metric: QualityMetricEvaluation): string {
  if (metric.value === null) return '—';
  return metric.unit === 'percent'
    ? `${formatNumber(metric.value)} %`
    : `${formatNumber(metric.value)} ms`;
}

function formatTarget(metric: QualityMetricEvaluation): string {
  const direction = metric.targetDirection === 'atLeast' ? '≥' : '≤';
  const value =
    metric.unit === 'percent'
      ? `${formatNumber(metric.targetValue)} %`
      : `${formatNumber(metric.targetValue)} ms`;
  return `Ziel ${direction} ${value}`;
}

function formatBasis(metric: QualityMetricEvaluation): string {
  if (metric.unit === 'milliseconds') {
    return metric.status === 'unavailable'
      ? `${metric.sampleCount} Zeit-Samples · keine Samples`
      : `${metric.sampleCount} Zeit-Samples`;
  }

  const observationBasis = `${metric.numerator ?? '—'} / ${metric.denominator ?? '—'} Beobachtungen`;
  return metric.status === 'unavailable'
    ? `${observationBasis} · kein gültiger Nenner`
    : observationBasis;
}

function statusLabel(status: QualityMetricStatus): string {
  switch (status) {
    case 'pass':
      return 'Ziel erreicht';
    case 'fail':
      return 'Ziel verfehlt';
    case 'insufficient':
      return 'Zu wenig Daten';
    default:
      return 'Nicht verfügbar';
  }
}

function statusIcon(status: QualityMetricStatus): string {
  switch (status) {
    case 'pass':
      return '✓';
    case 'fail':
      return '!';
    case 'insufficient':
      return '…';
    default:
      return '—';
  }
}

function progressPercent(metric: QualityMetricEvaluation): number {
  if (metric.value === null || metric.targetValue === 0) return 0;
  return Math.min(100, Math.max(0, (metric.value / metric.targetValue) * 100));
}

export function summarizeTestMeasurements(
  snapshots: readonly SanitizedQualityPayload[],
): TestMeasurementSummary[] {
  const snapshotsByCohort = new Map<string, SanitizedQualityPayload[]>();
  for (const snapshot of snapshots) {
    const cohortKey = `${snapshot.experimentVariant}:${snapshot.fixtureSetVersion ?? 'none'}`;
    const cohortSnapshots = snapshotsByCohort.get(cohortKey) ?? [];
    cohortSnapshots.push(snapshot);
    snapshotsByCohort.set(cohortKey, cohortSnapshots);
  }

  return [...snapshotsByCohort.values()].map((cohortSnapshots) => {
    const firstSnapshot = cohortSnapshots[0];
    if (!firstSnapshot) throw new Error('Leere Qualitätskohorte kann nicht angezeigt werden.');
    const report = buildQualityCohortReport(cohortSnapshots);
    return {
      count: cohortSnapshots.length,
      variant: firstSnapshot.experimentVariant,
      fixtureSetVersion: report.fixtureSetVersion,
      confirmedItemCount: report.aggregation.confirmedItemCount,
      automaticAssignmentCount: report.aggregation.automaticAssignmentCount,
      evaluation: report.metrics,
    };
  });
}

function MetricRow({ metric }: { metric: QualityMetricEvaluation }) {
  const statusStyle =
    metric.status === 'pass'
      ? styles.statusPass
      : metric.status === 'fail'
        ? styles.statusFail
        : metric.status === 'insufficient'
          ? styles.statusInsufficient
          : styles.statusUnavailable;
  const fillStyle =
    metric.status === 'pass'
      ? styles.fillPass
      : metric.status === 'fail'
        ? styles.fillFail
        : metric.status === 'insufficient'
          ? styles.fillInsufficient
          : styles.fillUnavailable;

  return (
    <View style={styles.metricRow}>
      <Row align="flex-start" justify="space-between" gap={space.md}>
        <View style={styles.metricCopy}>
          <Txt variant="label" weight="700">
            {METRIC_LABELS[metric.key]}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {formatBasis(metric)}
          </Txt>
        </View>
        <View style={styles.metricValueBlock}>
          <Txt variant="subheading" weight="700" center>
            {formatMetricValue(metric)}
          </Txt>
          <View style={[styles.statusPill, statusStyle]}>
            <Txt variant="caption" weight="700" tone="primary">
              {statusIcon(metric.status)} {statusLabel(metric.status)}
            </Txt>
          </View>
        </View>
      </Row>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, fillStyle, { width: `${progressPercent(metric)}%` }]} />
      </View>
      <Row justify="space-between" gap={space.sm}>
        <Txt variant="caption" tone="secondary">
          {formatTarget(metric)}
        </Txt>
        <Txt variant="caption" tone="secondary">
          Mindeststichprobe {metric.minimumSampleCount}
        </Txt>
      </Row>
    </View>
  );
}

export function ReadyView({
  snapshot,
  evaluation,
}: Pick<Extract<QualityViewState, { kind: 'ready' }>, 'snapshot' | 'evaluation'>) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const passedCount = METRIC_ORDER.filter((key) => evaluation[key].status === 'pass').length;

  async function copyPayload() {
    try {
      await copyQualitySnapshotExport(snapshot, (text) => Clipboard.setStringAsync(text));
      setCopied(true);
    } catch {
      Alert.alert('Kopieren fehlgeschlagen', 'Der bereinigte Payload konnte nicht kopiert werden.');
    }
  }

  return (
    <>
      <Card style={styles.summaryCard}>
        <Txt variant="caption" tone="secondary">
          Auswertung der vier Qualitätsmetriken
        </Txt>
        <Txt variant="heading" weight="700">
          {passedCount} von {METRIC_ORDER.length} Zielen erreicht
        </Txt>
        <Txt variant="caption" tone="secondary">
          Mindeststichprobe {DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT} · Werte bleiben mit ihrer
          Datengrundlage sichtbar
        </Txt>
      </Card>

      <Card title="Messwerte">
        <View style={styles.metricList}>
          {METRIC_ORDER.map((key) => (
            <MetricRow key={key} metric={evaluation[key]} />
          ))}
        </View>
      </Card>

      <Card title="Bereinigter Übertragungs-Payload">
        <Txt variant="caption" tone="secondary">
          Enthält nur Qualitätszähler und Statusdaten. Artikeltexte, Transkripte, Audio und
          Session-IDs fehlen.
        </Txt>
        <View style={[styles.payloadBox, { borderColor: colors.border }]}>
          <Txt variant="caption" selectable style={styles.payloadText}>
            {snapshot.text}
          </Txt>
        </View>
        {!snapshot.canExport ? (
          <Txt tone="warning">
            Copy ist bis zur Mindeststichprobe von {DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT} je Metrik
            deaktiviert.
          </Txt>
        ) : null}
        <Button
          title={
            copied
              ? 'Payload kopiert'
              : snapshot.canExport
                ? 'Payload kopieren'
                : 'Zu wenig Daten für Export'
          }
          variant="secondary"
          icon={copied ? 'check' : 'copy'}
          disabled={!snapshot.canExport}
          onPress={() => void copyPayload()}
        />
      </Card>
    </>
  );
}

export function TestMeasurementsView({ summary }: { summary: TestMeasurementSummary }) {
  const measurementLabel = summary.count === 1 ? 'Testmessung' : 'Testmessungen';

  return (
    <Card title="Speech-Testmessungen">
      <Txt variant="caption" tone="secondary">
        {`${summary.count} gespeicherte ${measurementLabel} im Simulator-Cache`}
      </Txt>
      <Txt variant="caption" tone="secondary">
        Die Matrix aggregiert die Captures dieser Variante separat vom persistenten Beta-Zustand.
      </Txt>
      <Txt variant="caption" tone="secondary">
        Variante: {summary.variant}
      </Txt>
      <Txt variant="caption" tone="secondary">
        Fixture-Set: {summary.fixtureSetVersion ?? '—'}
      </Txt>
      <Txt variant="caption" tone="secondary">
        Datengrundlage: {summary.confirmedItemCount} bestätigte Artikel ·{' '}
        {summary.automaticAssignmentCount} automatische Zuordnungen
      </Txt>
      <View style={styles.metricList}>
        {METRIC_ORDER.map((key) => (
          <MetricRow key={key} metric={summary.evaluation[key]} />
        ))}
      </View>
    </Card>
  );
}

export function StateMessage({
  view,
}: {
  view: Exclude<QualityViewState, { kind: 'ready' | 'loading' }>;
}) {
  if (view.kind === 'no-session') {
    return (
      <Card title="Kein Account">
        <Txt tone="warning">Die lokale Qualitätsansicht benötigt einen aktiven Account.</Txt>
      </Card>
    );
  }

  if (view.kind === 'consent') {
    const revoked = view.consent === 'revoked';
    return (
      <Card title="Qualitätsmetriken nicht verfügbar">
        <Txt tone={revoked ? 'danger' : 'warning'}>
          {revoked
            ? 'Die Übertragung ist widerrufen. Lokale Qualitätsmetriken wurden gelöscht.'
            : 'Die Übertragung ist noch nicht freigegeben. Alte Messwerte werden deshalb nicht angezeigt.'}
        </Txt>
      </Card>
    );
  }

  if (view.kind === 'empty') {
    return (
      <Card title="Noch keine Messwerte">
        <Txt tone="secondary">
          Nach mindestens einer bestätigten Eingabe erscheinen hier die vier Qualitätsmetriken und
          der bereinigte Payload.
        </Txt>
      </Card>
    );
  }

  return (
    <Card title="Qualitätsmetriken konnten nicht geladen werden">
      <Txt tone="danger">{view.message}</Txt>
    </Card>
  );
}

export function LoadingState() {
  return (
    <Card>
      <View style={styles.loadingState}>
        <ActivityIndicator accessibilityLabel="Qualitätsmetriken werden geladen" />
        <Txt variant="caption" tone="secondary">
          Lokalen Snapshot laden …
        </Txt>
      </View>
    </Card>
  );
}
