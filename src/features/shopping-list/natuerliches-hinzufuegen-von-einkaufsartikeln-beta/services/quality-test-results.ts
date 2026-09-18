import { File, Paths } from 'expo-file-system';

import type { SanitizedQualityPayload } from '../domain/quality-snapshot';

export const QUALITY_TEST_RESULTS_FILE_NAME = 'fam-natural-language-addition-quality.jsonl';

/** Appends one already-sanitized test capture to the local development cache. */
export async function appendQualityTestSnapshot(payload: SanitizedQualityPayload): Promise<void> {
  const file = new File(Paths.cache, QUALITY_TEST_RESULTS_FILE_NAME);
  await file.write(`${JSON.stringify(payload)}\n`, { append: true });
}
