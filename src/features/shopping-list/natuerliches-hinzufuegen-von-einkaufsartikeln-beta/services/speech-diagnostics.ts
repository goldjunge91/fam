import { File, Paths } from 'expo-file-system';

import { env } from '@/lib/config/env';
import { debugLogEvent } from '@/lib/observability/debug-log';
import type { NaturalLanguageAdditionInput, ParseResult, SpeechInputSegment } from '../types';

export const SPEECH_DIAGNOSTICS_FILE_NAME = 'fam-natural-language-addition-speech.jsonl';

export type SpeechParseDiagnosticRecord = {
  event: 'shopping-list.natural-language.parse.completed';
  recorded_at: string;
  correlation_id: string;
  source: 'speech';
  locale: string | null;
  on_device: true;
  raw_transcript: string;
  speech_segments?: readonly {
    start_time_ms: number;
    end_time_ms: number;
    segment: string;
    confidence: number;
  }[];
  parsed_items: ParseResult['items'];
  unparsed_text: string | null;
};

type CreateSpeechParseDiagnosticInput = {
  correlationId: string;
  input: Extract<NaturalLanguageAdditionInput, { source: 'speech' }>;
  parseResult: ParseResult;
  recordedAt?: string;
};

function debugDiagnosticsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ && env.debugLogsEnabled;
}

function mapSpeechSegments(
  segments: readonly SpeechInputSegment[] | undefined,
): SpeechParseDiagnosticRecord['speech_segments'] {
  if (!segments || segments.length === 0) return undefined;

  return segments.map((segment) => ({
    start_time_ms: segment.startTimeMillis,
    end_time_ms: segment.endTimeMillis,
    segment: segment.segment,
    confidence: segment.confidence,
  }));
}

export function createSpeechParseDiagnosticRecord(
  input: CreateSpeechParseDiagnosticInput,
): SpeechParseDiagnosticRecord {
  const speechSegments = mapSpeechSegments(input.input.segments);

  return {
    event: 'shopping-list.natural-language.parse.completed',
    recorded_at: input.recordedAt ?? new Date().toISOString(),
    correlation_id: input.correlationId,
    source: 'speech',
    locale: input.input.locale,
    on_device: true,
    raw_transcript: input.input.text,
    ...(speechSegments ? { speech_segments: speechSegments } : {}),
    parsed_items: input.parseResult.items,
    unparsed_text: input.parseResult.unparsedText,
  };
}

/**
 * Writes one complete speech parse to the simulator's cache as JSONL.
 * The file is deliberately limited to development diagnostics and is never
 * written by production builds or when debug logging is disabled.
 */
export function appendSpeechParseDiagnostic(record: SpeechParseDiagnosticRecord): void {
  if (!debugDiagnosticsEnabled()) return;

  const file = new File(Paths.cache, SPEECH_DIAGNOSTICS_FILE_NAME);
  try {
    file.write(`${JSON.stringify(record)}\n`, { append: true });
    debugLogEvent('shopping-list.natural-language.parse.file-written', {
      correlation_id: record.correlation_id,
      file_name: SPEECH_DIAGNOSTICS_FILE_NAME,
      file_uri: file.uri,
    });
  } catch {
    debugLogEvent('shopping-list.natural-language.parse.file-write-failed', {
      correlation_id: record.correlation_id,
      file_name: SPEECH_DIAGNOSTICS_FILE_NAME,
    });
  }
}
