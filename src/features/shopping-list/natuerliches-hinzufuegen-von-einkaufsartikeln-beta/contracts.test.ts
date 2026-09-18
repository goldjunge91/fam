import {
  DEFAULT_NATURAL_LANGUAGE_ADDITION_BETA_GATE,
  isNaturalLanguageAdditionBetaEnabled,
} from './gate';
import type {
  ConfirmedBetaOutput,
  NaturalLanguageAdditionInput,
  ParsedShoppingItem,
  RoutingDecision,
  ShoppingListSuggestion,
  SpeechInputResult,
} from './types';

describe('natural-language addition beta contracts', () => {
  it('is disabled when no gate is supplied', () => {
    expect(isNaturalLanguageAdditionBetaEnabled()).toBe(false);
    expect(DEFAULT_NATURAL_LANGUAGE_ADDITION_BETA_GATE.enabled).toBe(false);
  });

  it('requires an explicit enabled gate', () => {
    expect(isNaturalLanguageAdditionBetaEnabled({ enabled: false })).toBe(false);
    expect(isNaturalLanguageAdditionBetaEnabled({ enabled: true })).toBe(true);
  });

  it('keeps text and on-device speech inputs in one contract', () => {
    const inputs: readonly NaturalLanguageAdditionInput[] = [
      { source: 'text', text: 'Brot', locale: 'de-DE' },
      { source: 'speech', text: '3 Äpfel', locale: 'de-DE', onDevice: true },
    ];

    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toMatchObject({ source: 'speech', onDevice: true });
  });

  it('models speech error states without exposing raw audio', () => {
    const result: SpeechInputResult = {
      status: 'capability-unavailable',
      text: null,
      locale: 'de-DE',
      onDevice: false,
      error: 'On-Device-Erkennung nicht verfügbar',
    };

    expect(result).toEqual({
      status: 'capability-unavailable',
      text: null,
      locale: 'de-DE',
      onDevice: false,
      error: 'On-Device-Erkennung nicht verfügbar',
    });
    expect('audio' in result).toBe(false);
  });

  it('keeps unresolved routing separate from confirmed output', () => {
    const item: ParsedShoppingItem = {
      name: 'Skyr',
      quantity: 4,
      unit: null,
      brand: 'JA',
    };
    const suggestion: ShoppingListSuggestion = {
      listId: 'rewe-list',
      listName: 'REWE',
      confidence: 0.74,
    };
    const decision: RoutingDecision = {
      kind: 'uncertain',
      item,
      listId: null,
      confidence: 0.74,
      bestMatch: suggestion,
      suggestions: [suggestion],
      needsClarification: true,
    };
    const output: ConfirmedBetaOutput = {
      betaSessionId: 'beta-session-1',
      source: 'text',
      items: [
        {
          confirmation: 'confirmed',
          item,
          targetListId: 'rewe-list',
        },
      ],
    };

    expect(decision.kind).toBe('uncertain');
    expect(output.items[0]).toMatchObject({
      confirmation: 'confirmed',
      targetListId: 'rewe-list',
    });
  });
});
