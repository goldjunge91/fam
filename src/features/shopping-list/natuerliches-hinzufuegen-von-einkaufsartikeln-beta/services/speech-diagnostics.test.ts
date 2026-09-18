import type { ParseResult } from '../types';

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    uri: 'file:///cache/fam-natural-language-addition-speech.jsonl',
    write: jest.fn(),
  })),
  Paths: { cache: 'file:///cache' },
}));

jest.mock('@/lib/observability/debug-log', () => ({ debugLogEvent: jest.fn() }));

const {
  appendSpeechParseDiagnostic,
  createSpeechParseDiagnosticRecord,
  SPEECH_DIAGNOSTICS_FILE_NAME,
} = require('./speech-diagnostics') as typeof import('./speech-diagnostics');
const fileSystem = require('expo-file-system') as {
  File: jest.Mock;
};
const { debugLogEvent: mockDebugLogEvent } = require('@/lib/observability/debug-log') as {
  debugLogEvent: jest.Mock;
};

const parseResult: ParseResult = {
  items: [
    { name: 'Küchenrolle', quantity: 1, unit: null, brand: null },
    { name: 'Joghurt', quantity: 4, unit: 'piece', brand: null },
  ],
  unparsedText: null,
  qualityFlags: [],
};

describe('speech diagnostics', () => {
  const originalDebugLogs = process.env.EXPO_PUBLIC_DEBUG_LOGS;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_DEBUG_LOGS = 'true';
    mockDebugLogEvent.mockReset();
  });

  afterAll(() => {
    if (originalDebugLogs === undefined) delete process.env.EXPO_PUBLIC_DEBUG_LOGS;
    else process.env.EXPO_PUBLIC_DEBUG_LOGS = originalDebugLogs;
  });

  it('keeps the raw transcript and parsed items together under one correlation id', () => {
    expect(
      createSpeechParseDiagnosticRecord({
        correlationId: 'speech-session-20',
        recordedAt: '2026-09-18T12:00:00.000Z',
        input: {
          source: 'speech',
          text: 'Küchenrolle zur Einkaufsliste hinzu',
          locale: 'de-DE',
          onDevice: true,
          segments: [
            {
              startTimeMillis: 100,
              endTimeMillis: 900,
              segment: 'Küchenrolle zur Einkaufsliste hinzu',
              confidence: 0.91,
            },
          ],
        },
        parseResult,
      }),
    ).toEqual({
      event: 'shopping-list.natural-language.parse.completed',
      recorded_at: '2026-09-18T12:00:00.000Z',
      correlation_id: 'speech-session-20',
      source: 'speech',
      locale: 'de-DE',
      on_device: true,
      raw_transcript: 'Küchenrolle zur Einkaufsliste hinzu',
      speech_segments: [
        {
          start_time_ms: 100,
          end_time_ms: 900,
          segment: 'Küchenrolle zur Einkaufsliste hinzu',
          confidence: 0.91,
        },
      ],
      parsed_items: parseResult.items,
      unparsed_text: null,
    });
  });

  it('appends a JSONL record and reports the file URI', () => {
    const record = createSpeechParseDiagnosticRecord({
      correlationId: 'speech-session-20',
      input: {
        source: 'speech',
        text: 'Küchenrolle zur Einkaufsliste hinzu',
        locale: 'de-DE',
        onDevice: true,
      },
      parseResult,
    });

    appendSpeechParseDiagnostic(record);

    const mockWrite = fileSystem.File.mock.results.at(-1)?.value.write as jest.Mock;
    expect(mockWrite).toHaveBeenCalledWith(`${JSON.stringify(record)}\n`, { append: true });
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'shopping-list.natural-language.parse.file-written',
      expect.objectContaining({
        correlation_id: 'speech-session-20',
        file_name: SPEECH_DIAGNOSTICS_FILE_NAME,
        file_uri: `file:///cache/${SPEECH_DIAGNOSTICS_FILE_NAME}`,
      }),
    );
  });
});
