import { createEmptyNaturalLanguageAdditionBetaState } from '../beta-storage';
import type { ShoppingListCatalogEntry } from '../domain/routing';
import type { BetaStorageState, ConfirmedBetaOutput, SpeechInputResult } from '../types';
import {
  confirmTextBetaItems,
  createSpeechBetaPreview,
  createTextBetaPreview,
  type TextBetaStorage,
} from './text-workflow';

const lists: readonly ShoppingListCatalogEntry[] = [
  { listId: 'rewe-list', listName: 'REWE', knownBrands: ['JA'] },
  { listId: 'aldi-list', listName: 'Aldi', knownBrands: [] },
];

function createFakeStorage(): TextBetaStorage & { getState: () => BetaStorageState } {
  let state = createEmptyNaturalLanguageAdditionBetaState();
  return {
    load: async () => state,
    save: async (nextState) => {
      state = nextState;
    },
    getState: () => state,
  };
}

describe('text beta workflow', () => {
  it('parses all articles, exposes routing, and saves only selected confirmations', async () => {
    const storage = createFakeStorage();
    const saveConfirmedOutput = jest.fn(async (output: ConfirmedBetaOutput) => ({
      savedItemCount: output.items.length,
      mutationCount: output.items.length,
      itemIds: output.items.map((_, index) => `item-${index}`),
    }));

    const preview = await createTextBetaPreview({
      text: '3 Äpfel, Brot, 3x Joghurt und 4x Skyr von JA',
      betaSessionId: 'session-1',
      startedAt: '2026-09-16T12:00:00.000Z',
      lists,
      storage,
    });

    expect(preview.items.map((entry) => entry.item.name)).toEqual([
      'Äpfel',
      'Brot',
      'Joghurt',
      'Skyr',
    ]);
    expect(preview.input).toEqual({
      source: 'text',
      text: '3 Äpfel, Brot, 3x Joghurt und 4x Skyr von JA',
      locale: null,
    });
    expect(preview.items[3]).toMatchObject({
      routing: { kind: 'resolved', listId: 'rewe-list' },
      reviewState: 'pending',
    });
    expect(preview.items[1]).toMatchObject({
      routing: { kind: 'uncertain', listId: null, needsClarification: true },
    });

    const result = await confirmTextBetaItems({
      preview,
      selections: [
        { itemId: preview.items[1].itemId, targetListId: 'aldi-list' },
        { itemId: preview.items[3].itemId, targetListId: 'rewe-list' },
      ],
      storage,
      saveConfirmedOutput,
    });

    expect(saveConfirmedOutput).toHaveBeenCalledWith({
      betaSessionId: 'session-1',
      source: 'text',
      items: [
        expect.objectContaining({ targetListId: 'aldi-list', confirmation: 'confirmed' }),
        expect.objectContaining({ targetListId: 'rewe-list', confirmation: 'confirmed' }),
      ],
    });
    expect(result.output.items).toHaveLength(2);
    expect(storage.getState().confirmations).toHaveLength(2);
    expect(storage.getState().confirmations[0]).toMatchObject({
      itemName: 'Brot',
      targetListId: 'aldi-list',
      result: 'corrected',
    });
  });

  it('feeds a network transcript into the same preview workflow', async () => {
    const storage = createFakeStorage();
    const speechResult: SpeechInputResult = {
      status: 'transcript',
      text: '4x Skyr von JA',
      locale: 'de-DE',
      onDevice: false,
      error: null,
      segments: [
        {
          startTimeMillis: 180,
          endTimeMillis: 560,
          segment: '4x Skyr von JA',
          confidence: 0.94,
        },
      ],
    };

    const result = await createSpeechBetaPreview({
      speechResult,
      betaSessionId: 'speech-session-1',
      startedAt: '2026-09-16T12:00:00.000Z',
      lists,
      storage,
    });

    expect(result).toMatchObject({ kind: 'preview' });
    if (result.kind !== 'preview') throw new Error('Expected a speech preview');
    expect(result.preview.input).toEqual({
      source: 'speech',
      text: '4x Skyr von JA',
      locale: 'de-DE',
      onDevice: false,
      segments: [
        {
          startTimeMillis: 180,
          endTimeMillis: 560,
          segment: '4x Skyr von JA',
          confidence: 0.94,
        },
      ],
    });
    expect(result.preview.session.source).toBe('speech');
    expect(result.preview.items[0]?.item).toMatchObject({ name: 'Skyr', quantity: 4, brand: 'JA' });
  });

  it('rebuilds the same session when the preview transcript is edited', async () => {
    const storage = createFakeStorage();
    const firstPreview = await createTextBetaPreview({
      text: 'Äpfel',
      betaSessionId: 'editable-session-1',
      startedAt: '2026-09-16T12:00:00.000Z',
      lists,
      storage,
    });

    const editedPreview = await createTextBetaPreview({
      text: 'Milch und Brot',
      betaSessionId: firstPreview.session.id,
      startedAt: firstPreview.session.startedAt,
      lists,
      storage,
    });

    expect(editedPreview.session).toEqual(firstPreview.session);
    expect(editedPreview.items.map((entry) => entry.item.name)).toEqual(['Milch', 'Brot']);
    expect(
      editedPreview.items.every((entry) => entry.itemId.startsWith('editable-session-1:')),
    ).toBe(true);
  });

  it('keeps text fallback available when speech capability is missing', async () => {
    const storage = createFakeStorage();
    const speechResult: SpeechInputResult = {
      status: 'capability-unavailable',
      text: null,
      locale: 'de-DE',
      onDevice: false,
      error: 'On-Device-Spracherkennung nicht verfügbar',
    };

    await expect(
      createSpeechBetaPreview({
        speechResult,
        betaSessionId: 'speech-session-2',
        startedAt: '2026-09-16T12:00:00.000Z',
        lists,
        storage,
      }),
    ).resolves.toEqual({ kind: 'fallback', speechResult });
    expect(storage.getState().session).toBeNull();
  });

  it('does not call the productive adapter when nothing is explicitly selected', async () => {
    const storage = createFakeStorage();
    const saveConfirmedOutput = jest.fn();
    const preview = await createTextBetaPreview({
      text: 'Brot',
      betaSessionId: 'session-2',
      startedAt: '2026-09-16T12:00:00.000Z',
      lists,
      storage,
    });

    const result = await confirmTextBetaItems({
      preview,
      selections: [],
      storage,
      saveConfirmedOutput,
    });

    expect(result.output.items).toEqual([]);
    expect(saveConfirmedOutput).not.toHaveBeenCalled();
    expect(storage.getState().confirmations).toEqual([]);
  });
});
