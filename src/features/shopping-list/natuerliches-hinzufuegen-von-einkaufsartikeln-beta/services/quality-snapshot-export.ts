import { DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT } from '../domain/quality-evaluator';
import {
  type QualitySnapshotInput,
  type SanitizedQualityPayload,
  sanitizeQualitySnapshot,
} from '../domain/quality-snapshot';
import type { BetaConsentState } from '../types';

export type ManualQualitySnapshotExportInput = QualitySnapshotInput & {
  qualityConsent: BetaConsentState['qualityMetrics'];
};

export type QualitySnapshotExportReady = {
  kind: 'ready';
  payload: SanitizedQualityPayload;
  text: string;
  canExport: boolean;
  exportUnavailableReason: 'insufficient-data' | null;
};

export type QualitySnapshotExport =
  | QualitySnapshotExportReady
  | {
      kind: 'unavailable';
      reason: 'quality-consent-required' | 'insufficient-data' | 'invalid-snapshot';
    };

export type QualitySnapshotClipboardWriter = (text: string) => Promise<unknown>;

export function hasSufficientQualityData(
  payload: SanitizedQualityPayload,
  minimumSampleCount = DEFAULT_MINIMUM_QUALITY_SAMPLE_COUNT,
): boolean {
  return Object.values(payload.metrics).every((metric) => metric.sampleCount >= minimumSampleCount);
}

/** Serializes only the already allowlisted transfer contract. */
export function serializeQualitySnapshot(payload: SanitizedQualityPayload): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Builds the one payload used by both the developer preview and manual copy.
 * Consent is checked before the payload becomes exportable; no network is involved.
 */
export function createManualQualitySnapshotExport(
  input: ManualQualitySnapshotExportInput,
): QualitySnapshotExport {
  if (input.qualityConsent !== 'granted') {
    return { kind: 'unavailable', reason: 'quality-consent-required' };
  }

  const payload = sanitizeQualitySnapshot(input);
  if (!payload) return { kind: 'unavailable', reason: 'invalid-snapshot' };

  const hasCapturedData = payload.confirmedItemCount > 0 || payload.durationSamplesMs.length > 0;
  if (!hasCapturedData) return { kind: 'unavailable', reason: 'insufficient-data' };

  const canExport = hasSufficientQualityData(payload);

  return {
    kind: 'ready',
    payload,
    text: serializeQualitySnapshot(payload),
    canExport,
    exportUnavailableReason: canExport ? null : 'insufficient-data',
  };
}

/** The adapter boundary is deliberately injected so tests never send externally. */
export async function copyQualitySnapshotExport(
  exportResult: QualitySnapshotExportReady,
  write: QualitySnapshotClipboardWriter,
): Promise<boolean> {
  if (!exportResult.canExport) return false;
  await write(exportResult.text);
  return true;
}
