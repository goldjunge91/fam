import { createEmptyNaturalLanguageAdditionBetaState } from '../beta-storage';
import type { ShoppingListCatalogEntry } from '../domain/routing';
import type {
  BetaConfirmationEvent,
  BetaStorageState,
  ConfirmedBetaOutput,
  SpeechInputResult,
} from '../types';
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

function createFakeStorage(
  initialState = createEmptyNaturalLanguageAdditionBetaState(),
): TextBetaStorage & { getState: () => BetaStorageState } {
  let state = initialState;
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

  it('feeds an on-device transcript into the same preview workflow', async () => {
    const storage = createFakeStorage();
    const speechResult: SpeechInputResult = {
      status: 'transcript',
      text: '4x Skyr von JA',
      locale: 'de-DE',
      onDevice: true,
      error: null,
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
      onDevice: true,
    });
    expect(result.preview.session.source).toBe('speech');
    expect(result.preview.items[0]?.item).toMatchObject({ name: 'Skyr', quantity: 4, brand: 'JA' });
  });

  it('rejects a non-device transcript before creating a preview session', async () => {
    const storage = createFakeStorage();
    const speechResult = {
      status: 'transcript',
      text: 'Milch',
      locale: 'de-DE',
      onDevice: false,
      error: null,
    } as unknown as SpeechInputResult;

    await expect(
      createSpeechBetaPreview({
        speechResult,
        betaSessionId: 'non-device-session-1',
        startedAt: '2026-09-18T12:00:00.000Z',
        lists,
        storage,
      }),
    ).resolves.toEqual({
      kind: 'unavailable',
      speechResult: {
        status: 'capability-unavailable',
        text: null,
        locale: 'de-DE',
        onDevice: false,
        error: 'On-Device-Spracherkennung ist für diesen Workflow erforderlich.',
        errorCode: 'on-device-required',
      },
    });
    expect(storage.getState().session).toBeNull();
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

  it('returns speech unavailability without opening a manual input surface', async () => {
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
    ).resolves.toEqual({ kind: 'unavailable', speechResult });
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

  it('allows a resolved item to be reassigned to another available shopping list', async () => {
    const storage = createFakeStorage();
    const saveConfirmedOutput = jest.fn(async (output: ConfirmedBetaOutput) => ({
      savedItemCount: output.items.length,
      mutationCount: output.items.length,
      itemIds: ['item-1'],
    }));
    const preview = await createTextBetaPreview({
      text: 'Skyr von JA',
      betaSessionId: 'session-reassigned-1',
      startedAt: '2026-09-18T12:00:00.000Z',
      lists,
      storage,
    });
    const item = preview.items.at(0);
    if (!item) throw new Error('Expected a preview item');

    await expect(
      confirmTextBetaItems({
        preview,
        selections: [{ itemId: item.itemId, targetListId: 'aldi-list' }],
        availableTargetListIds: lists.map((list) => list.listId),
        storage,
        saveConfirmedOutput,
      }),
    ).resolves.toMatchObject({ output: { items: [{ targetListId: 'aldi-list' }] } });
  });

  it('does not turn a learning-state write failure into a duplicate retry', async () => {
    let state = createEmptyNaturalLanguageAdditionBetaState();
    let saveCalls = 0;
    const storage: TextBetaStorage = {
      load: async () => state,
      save: async (nextState) => {
        saveCalls += 1;
        if (saveCalls > 1) throw new Error('learning state unavailable');
        state = nextState;
      },
    };
    const saveConfirmedOutput = jest.fn(async (output: ConfirmedBetaOutput) => ({
      savedItemCount: output.items.length,
      mutationCount: output.items.length,
      itemIds: ['item-1'],
    }));
    const preview = await createTextBetaPreview({
      text: 'Brot',
      betaSessionId: 'session-storage-failure-1',
      startedAt: '2026-09-18T12:00:00.000Z',
      lists,
      storage,
    });
    const item = preview.items.at(0);
    if (!item) throw new Error('Expected a preview item');

    await expect(
      confirmTextBetaItems({
        preview,
        selections: [{ itemId: item.itemId, targetListId: 'rewe-list' }],
        availableTargetListIds: lists.map((list) => list.listId),
        storage,
        saveConfirmedOutput,
      }),
    ).resolves.toMatchObject({ saveResult: { savedItemCount: 1 } });
    expect(saveConfirmedOutput).toHaveBeenCalledTimes(1);
  });

  it('signals the one-time automatic-application question exactly at the learning threshold', async () => {
    const confirmations: BetaConfirmationEvent[] = Array.from({ length: 9 }, (_, index) => ({
      id: `confirmation-${index}`,
      sessionId: `session-${index}`,
      itemName: `Artikel ${index}`,
      brand: `Marke ${index}`,
      targetListId: 'rewe-list',
      result: 'confirmed',
      createdAt: '2026-09-18T12:00:00.000Z',
    }));
    const initialState: BetaStorageState = {
      ...createEmptyNaturalLanguageAdditionBetaState(),
      confirmations,
    };
    const storage = createFakeStorage(initialState);
    const saveConfirmedOutput = jest.fn(async (output: ConfirmedBetaOutput) => ({
      savedItemCount: output.items.length,
      mutationCount: output.items.length,
      itemIds: ['item-threshold'],
    }));
    const preview = await createTextBetaPreview({
      text: 'Haferdrink von Oatly',
      betaSessionId: 'session-threshold',
      startedAt: '2026-09-18T12:00:00.000Z',
      lists,
      storage,
    });
    const item = preview.items.at(0);
    if (!item) throw new Error('Expected a preview item');

    const result = await confirmTextBetaItems({
      preview,
      selections: [{ itemId: item.itemId, targetListId: 'rewe-list' }],
      availableTargetListIds: lists.map((list) => list.listId),
      storage,
      saveConfirmedOutput,
      confirmedAt: '2026-09-18T12:01:00.000Z',
    });

    expect(result.shouldAskForAutomaticApplication).toBe(true);
    expect(result.state.consent.automaticApplication).toBe('undecided');
  });

  it('does not commit a stale automatic selection after the user revokes consent', async () => {
    let state: BetaStorageState = {
      ...createEmptyNaturalLanguageAdditionBetaState(),
      consent: {
        automaticApplication: 'granted',
      },
      learningRules: [
        {
          id: 'rule-oatly',
          itemName: 'Haferdrink',
          brand: 'Oatly',
          targetListId: 'aldi-list',
          confirmationCount: 3,
          createdAt: '2026-09-18T12:00:00.000Z',
          updatedAt: '2026-09-18T12:00:00.000Z',
        },
      ],
    };
    const storage: TextBetaStorage = {
      load: async () => state,
      save: async (nextState) => {
        state = nextState;
      },
    };
    const saveConfirmedOutput = jest.fn(async (output: ConfirmedBetaOutput) => ({
      savedItemCount: output.items.length,
      mutationCount: output.items.length,
      itemIds: ['item-stale'],
    }));
    const preview = await createTextBetaPreview({
      text: 'Haferdrink von Oatly',
      betaSessionId: 'session-revoked',
      startedAt: '2026-09-18T12:00:00.000Z',
      lists,
      storage,
    });
    const item = preview.items.at(0);
    if (!item) throw new Error('Expected a preview item');
    expect(item.routing).toMatchObject({ kind: 'resolved', listId: 'aldi-list', automatic: true });

    state = {
      ...state,
      consent: { ...state.consent, automaticApplication: 'revoked' },
    };

    await expect(
      confirmTextBetaItems({
        preview,
        selections: [{ itemId: item.itemId, targetListId: 'aldi-list' }],
        availableTargetListIds: lists.map((list) => list.listId),
        storage,
        saveConfirmedOutput,
      }),
    ).rejects.toThrow('automatische Zuordnung wurde widerrufen');
    expect(saveConfirmedOutput).not.toHaveBeenCalled();
  });
});
