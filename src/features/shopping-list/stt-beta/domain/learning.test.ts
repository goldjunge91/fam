import { createEmptyNaturalLanguageAdditionBetaState } from '../beta-storage';
import type { BetaConfirmationEvent, ParsedShoppingItem } from '../types';
import type { ShoppingListCatalogEntry } from './routing';
import { getLearningProgress, recordRoutingConfirmation, routeShoppingItem } from './routing';

const lists: readonly ShoppingListCatalogEntry[] = [
  { listId: 'rewe-list', listName: 'REWE', knownBrands: ['JA'] },
  { listId: 'aldi-list', listName: 'Aldi', knownBrands: [] },
];

const skyr: ParsedShoppingItem = {
  name: 'Skyr',
  quantity: 4,
  unit: null,
  brand: 'JA',
};

function confirmation(
  id: string,
  sessionId: string,
  itemName: string,
  targetListId: string,
  brand: string | null = null,
): BetaConfirmationEvent {
  return {
    id,
    sessionId,
    itemName,
    brand,
    targetListId,
    result: 'confirmed',
    createdAt: `2026-09-16T00:00:${id.padStart(2, '0')}Z`,
  };
}

function stateWithConfirmations(confirmations: readonly BetaConfirmationEvent[]) {
  return { ...createEmptyNaturalLanguageAdditionBetaState(), confirmations };
}

describe('Beta routing learning', () => {
  it.each([10, 11, 12])('marks %s unique assignments as learning-ready', (count) => {
    const confirmations = Array.from({ length: count }, (_, index) =>
      confirmation(
        `event-${index}`,
        `session-${index}`,
        `Item ${index}`,
        'rewe-list',
        `Brand ${index}`,
      ),
    );

    expect(getLearningProgress(confirmations)).toEqual({
      uniqueAssignments: count,
      thresholdReached: true,
    });
  });

  it('does not count repeated item-brand assignments twice', () => {
    const confirmations = [
      confirmation('event-1', 'session-1', 'Skyr', 'rewe-list', 'JA'),
      confirmation('event-2', 'session-2', 'Skyr', 'rewe-list', 'JA'),
      ...Array.from({ length: 9 }, (_, index) =>
        confirmation(`event-${index + 3}`, `session-${index + 3}`, `Item ${index}`, 'rewe-list'),
      ),
    ];

    expect(getLearningProgress(confirmations).uniqueAssignments).toBe(10);
  });

  it('requires the learning threshold in addition to three separate confirmations', () => {
    let state = createEmptyNaturalLanguageAdditionBetaState();
    for (let index = 0; index < 3; index += 1) {
      state = recordRoutingConfirmation({
        state,
        eventId: `skyr-${index}`,
        sessionId: `skyr-session-${index}`,
        item: skyr,
        targetListId: 'rewe-list',
        result: 'confirmed',
        createdAt: `2026-09-16T00:00:0${index}Z`,
      }).state;
    }

    expect(state.learningRules).toEqual([]);
  });

  it('creates a rule after ten unique assignments and three separate confirmations', () => {
    const confirmations = [
      confirmation('skyr-1', 'skyr-session-1', 'Skyr', 'rewe-list', 'JA'),
      confirmation('skyr-2', 'skyr-session-2', 'Skyr', 'rewe-list', 'JA'),
      confirmation('skyr-3', 'skyr-session-3', 'Skyr', 'rewe-list', 'JA'),
      ...Array.from({ length: 9 }, (_, index) =>
        confirmation(`item-${index}`, `item-session-${index}`, `Item ${index}`, 'rewe-list'),
      ),
    ];
    let state = stateWithConfirmations([]);

    for (const event of confirmations) {
      state = recordRoutingConfirmation({
        state,
        eventId: event.id,
        sessionId: event.sessionId,
        item: { name: event.itemName, quantity: 1, unit: null, brand: event.brand },
        targetListId: event.targetListId,
        result: event.result,
        createdAt: event.createdAt,
      }).state;
    }

    expect(state.learningRules).toEqual([
      expect.objectContaining({
        itemName: 'Skyr',
        brand: 'JA',
        targetListId: 'rewe-list',
        confirmationCount: 3,
      }),
    ]);
  });

  it('resolves a clear majority and keeps a tie in conflict mode', () => {
    const majority = [
      confirmation('a-1', 'a-1', 'Skyr', 'rewe-list', 'JA'),
      confirmation('a-2', 'a-2', 'Skyr', 'rewe-list', 'JA'),
      confirmation('a-3', 'a-3', 'Skyr', 'rewe-list', 'JA'),
      confirmation('b-1', 'b-1', 'Skyr', 'aldi-list', 'JA'),
      confirmation('b-2', 'b-2', 'Skyr', 'aldi-list', 'JA'),
      ...Array.from({ length: 9 }, (_, index) =>
        confirmation(`other-${index}`, `other-${index}`, `Item ${index}`, 'rewe-list'),
      ),
    ];
    expect(
      routeShoppingItem({ item: skyr, lists, learningRules: [], confirmations: majority }),
    ).toEqual(expect.objectContaining({ kind: 'resolved', listId: 'rewe-list' }));

    const tie = [...majority, confirmation('b-3', 'b-3', 'Skyr', 'aldi-list', 'JA')];
    expect(routeShoppingItem({ item: skyr, lists, learningRules: [], confirmations: tie })).toEqual(
      expect.objectContaining({ kind: 'conflict', listId: null, needsClarification: true }),
    );
  });
});
