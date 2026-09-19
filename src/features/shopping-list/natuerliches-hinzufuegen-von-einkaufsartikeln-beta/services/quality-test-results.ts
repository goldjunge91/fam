import { File, Paths } from 'expo-file-system';

import { parseQualitySnapshotInput } from '../domain/quality-cohort-report';
import type { SanitizedQualityPayload } from '../domain/quality-snapshot';

export const QUALITY_TEST_RESULTS_FILE_NAME = 'fam-natural-language-addition-quality.jsonl';
export const MAX_QUALITY_TEST_SNAPSHOTS = 256;

/** Keeps the newest sanitized test captures in the bounded local development cache. */
export async function appendQualityTestSnapshot(payload: SanitizedQualityPayload): Promise<void> {
  const file = new File(Paths.cache, QUALITY_TEST_RESULTS_FILE_NAME);
  const existingSnapshots = file.exists
    ? parseQualitySnapshotInput(await file.text())
    : ([] satisfies SanitizedQualityPayload[]);
  if (existingSnapshots.some((snapshot) => snapshot.captureKind !== 'maestro-preview-test')) {
    throw new Error('Der Test-Cache enthält einen nicht unterstützten Capture-Typ.');
  }

  const snapshots = [...existingSnapshots, payload].slice(-MAX_QUALITY_TEST_SNAPSHOTS);
  await file.write(`${snapshots.map((snapshot) => JSON.stringify(snapshot)).join('\n')}\n`, {
    append: false,
  });
}

/** Reads only the dev/test captures kept separate from persistent beta metrics. */
export async function readQualityTestSnapshots(): Promise<SanitizedQualityPayload[]> {
  const file = new File(Paths.cache, QUALITY_TEST_RESULTS_FILE_NAME);
  if (!file.exists) return [];

  const snapshots = parseQualitySnapshotInput(await file.text());
  if (snapshots.some((snapshot) => snapshot.captureKind !== 'maestro-preview-test')) {
    throw new Error('Der Test-Cache enthält einen nicht unterstützten Capture-Typ.');
  }
  return snapshots.slice(-MAX_QUALITY_TEST_SNAPSHOTS);
}
