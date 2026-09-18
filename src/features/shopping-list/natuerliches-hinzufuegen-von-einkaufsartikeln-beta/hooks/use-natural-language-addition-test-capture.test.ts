import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createEmptyNaturalLanguageAdditionBetaState } from '../beta-storage';
import { appendQualityTestSnapshot } from '../services/quality-test-results';
import type { TextBetaPreview, TextBetaStorage } from '../workflow/text-workflow';
import { useNaturalLanguageAdditionTestCapture } from './use-natural-language-addition-test-capture';

jest.mock('../services/quality-test-results', () => ({
  appendQualityTestSnapshot: jest.fn(),
}));

const mockAppendQualityTestSnapshot = jest.mocked(appendQualityTestSnapshot);

const preview: TextBetaPreview = {
  session: { id: 'session-1', source: 'speech', startedAt: '2026-09-18T11:59:59.000Z' },
  input: {
    source: 'speech',
    text: 'Küchenrolle',
    locale: 'de-DE',
    onDevice: true,
  },
  parseResult: {
    items: [{ name: 'Küchenrolle', quantity: 1, unit: null, brand: null }],
    unparsedText: null,
    qualityFlags: ['unparsed_text_present'],
  },
  items: [
    {
      itemId: 'session-1:item:0',
      item: { name: 'Küchenrolle', quantity: 1, unit: null, brand: null },
      routing: {
        kind: 'resolved',
        item: { name: 'Küchenrolle', quantity: 1, unit: null, brand: null },
        listId: 'store-1',
        confidence: 0.99,
        bestMatch: { listId: 'store-1', listName: 'REWE', confidence: 0.99 },
        suggestions: [{ listId: 'store-1', listName: 'REWE', confidence: 0.99 }],
        needsClarification: false,
      },
      reviewState: 'pending',
    },
  ],
  learningProgress: { uniqueAssignments: 0, thresholdReached: false },
};

function createStorage(): TextBetaStorage {
  const state = createEmptyNaturalLanguageAdditionBetaState();
  return {
    load: jest.fn().mockResolvedValue({ ...state, session: preview.session }),
    save: jest.fn(),
  };
}

describe('useNaturalLanguageAdditionTestCapture', () => {
  const originalFlag = process.env.EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_TEST_TOOLS;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_TEST_TOOLS = 'true';
    mockAppendQualityTestSnapshot.mockReset().mockImplementation(async () => undefined);
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_TEST_TOOLS;
    } else {
      process.env.EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_TEST_TOOLS = originalFlag;
    }
  });

  it('starts idle and reports saved only after the sanitized append succeeds', async () => {
    const storage = createStorage();
    const { result } = await renderHook(() =>
      useNaturalLanguageAdditionTestCapture({
        preview,
        variant: 'baseline',
        storage,
      }),
    );

    expect(result.current.enabled).toBe(true);
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.saveTestMeasurement([
        { itemId: 'session-1:item:0', targetListId: 'store-1' },
      ]);
    });

    expect(result.current.status).toBe('saved');
    expect(result.current.error).toBeNull();
    expect(storage.save).not.toHaveBeenCalled();
    expect(mockAppendQualityTestSnapshot).toHaveBeenCalledTimes(1);
    expect(mockAppendQualityTestSnapshot.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        captureKind: 'maestro-preview-test',
        experimentVariant: 'baseline',
        confirmedItemCount: 1,
        automaticAssignmentCount: 1,
        correctAutomaticAssignmentCount: 1,
        qualityFlags: expect.objectContaining({ unparsedTextPresent: 1 }),
      }),
    );
  });

  it('keeps a second save action from starting while the first append is pending', async () => {
    let resolveAppend!: () => void;
    mockAppendQualityTestSnapshot.mockImplementation(
      () => new Promise<void>((resolve) => (resolveAppend = resolve)),
    );
    const { result } = await renderHook(() =>
      useNaturalLanguageAdditionTestCapture({
        preview,
        variant: 'baseline',
        storage: createStorage(),
      }),
    );

    let firstSave!: Promise<void>;
    await act(async () => {
      firstSave = result.current.saveTestMeasurement([
        { itemId: 'session-1:item:0', targetListId: 'store-1' },
      ]);
    });
    await waitFor(() => expect(result.current.status).toBe('saving'));
    let secondSave!: Promise<void>;
    await act(async () => {
      secondSave = result.current.saveTestMeasurement([
        { itemId: 'session-1:item:0', targetListId: 'store-1' },
      ]);
    });

    resolveAppend();
    await act(async () => {
      await Promise.all([firstSave, secondSave]);
    });

    expect(mockAppendQualityTestSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saved');
  });

  it('exposes a visible error and does not claim success when append fails', async () => {
    mockAppendQualityTestSnapshot.mockImplementation(() => {
      throw new Error('cache unavailable');
    });
    const { result } = await renderHook(() =>
      useNaturalLanguageAdditionTestCapture({
        preview,
        variant: 'baseline',
        storage: createStorage(),
      }),
    );

    await act(async () => {
      await result.current.saveTestMeasurement([]);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('cache unavailable');
  });

  it('does nothing when the explicit test flag is disabled', async () => {
    process.env.EXPO_PUBLIC_NATURAL_LANGUAGE_ADDITION_TEST_TOOLS = 'false';
    const { result } = await renderHook(() =>
      useNaturalLanguageAdditionTestCapture({
        preview,
        variant: 'baseline',
        storage: createStorage(),
      }),
    );

    await act(async () => {
      await result.current.saveTestMeasurement([]);
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(mockAppendQualityTestSnapshot).not.toHaveBeenCalled();
  });
});
