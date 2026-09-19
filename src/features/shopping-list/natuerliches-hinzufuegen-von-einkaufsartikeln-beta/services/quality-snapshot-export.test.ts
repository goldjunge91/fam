import { createEmptyBetaQualityMetrics } from '../domain/quality-metrics';
import type { QualitySnapshotInput } from '../domain/quality-snapshot';
import {
  copyQualitySnapshotExport,
  createManualQualitySnapshotExport,
} from './quality-snapshot-export';

function snapshotInput(): QualitySnapshotInput {
  const metrics = createEmptyBetaQualityMetrics();

  return {
    metrics: {
      ...metrics,
      confirmedItemCount: 10,
      automaticAssignmentCount: 10,
      correctAutomaticAssignmentCount: 10,
      completionDurationsMs: Array.from({ length: 10 }, (_, index) => 1_000 + index * 100),
      recordedObservationIds: ['observation-private'],
      measuredSessionIds: ['session-private'],
    },
    captureKind: 'quality-snapshot',
    fixtureSetVersion: 'fixture-private-name',
    experimentVariant: 'baseline',
    createdAt: '2026-09-19T10:00:00.000Z',
  };
}

describe('quality-snapshot-export', () => {
  it('uses one sanitized payload for the visible text and the export text', () => {
    const result = createManualQualitySnapshotExport({
      ...snapshotInput(),
      qualityConsent: 'granted',
    });

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.canExport).toBe(true);

    expect(result.text).toBe(JSON.stringify(result.payload, null, 2));
    expect(JSON.parse(result.text)).toEqual(result.payload);
    expect(result.text).not.toContain('observation-private');
    expect(result.text).not.toContain('session-private');
    expect(Object.keys(result.payload)).toEqual([
      'schemaVersion',
      'snapshotVersion',
      'metricDefinitionVersion',
      'captureKind',
      'fixtureSetVersion',
      'experimentVariant',
      'createdAt',
      'confirmedItemCount',
      'automaticAssignmentCount',
      'correctAutomaticAssignmentCount',
      'falseListAssignmentCount',
      'manualCorrectionCount',
      'durationSamplesMs',
      'qualityFlags',
      'metrics',
    ]);
  });

  it('does not create an export without granted quality consent', () => {
    expect(
      createManualQualitySnapshotExport({ ...snapshotInput(), qualityConsent: 'revoked' }),
    ).toEqual({ kind: 'unavailable', reason: 'quality-consent-required' });
  });

  it('does not create an export for an empty local snapshot', () => {
    expect(
      createManualQualitySnapshotExport({
        ...snapshotInput(),
        metrics: createEmptyBetaQualityMetrics(),
        qualityConsent: 'granted',
      }),
    ).toEqual({ kind: 'unavailable', reason: 'insufficient-data' });
  });

  it('keeps an insufficient preview visible but blocks its export', async () => {
    const result = createManualQualitySnapshotExport({
      ...snapshotInput(),
      metrics: {
        ...snapshotInput().metrics,
        confirmedItemCount: 2,
        automaticAssignmentCount: 2,
        correctAutomaticAssignmentCount: 2,
        completionDurationsMs: [1_000, 2_000],
      },
      qualityConsent: 'granted',
    });
    const write = jest.fn().mockResolvedValue(undefined);

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;

    expect(result.canExport).toBe(false);
    expect(result.exportUnavailableReason).toBe('insufficient-data');
    await expect(copyQualitySnapshotExport(result, write)).resolves.toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('passes only the shared serialized text to the explicit clipboard adapter', async () => {
    const result = createManualQualitySnapshotExport({
      ...snapshotInput(),
      qualityConsent: 'granted',
    });
    const write = jest.fn().mockResolvedValue(undefined);

    if (result.kind !== 'ready') throw new Error('expected a ready export');
    await expect(copyQualitySnapshotExport(result, write)).resolves.toBe(true);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(result.text);
  });
});
