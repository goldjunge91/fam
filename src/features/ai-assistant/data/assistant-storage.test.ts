import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import type { AssistantThread } from '../types';
import { loadAssistantThreads, saveAssistantThreads } from './assistant-storage';

const values = new Map<string, string>();
const mockStorage = {
  getString: jest.fn((key: string) => values.get(key)),
  set: jest.fn((key: string, value: string) => values.set(key, value)),
};

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: jest.fn(async () => mockStorage),
}));

const validProposal = {
  kind: 'meal_plan_proposal.v1',
  foodRulesUpdatedAt: null,
  safetyNote: 'Prüft Zutaten vor dem Kochen.',
  meals: [
    {
      date: '2026-11-09',
      mealSlot: 'dinner',
      recipeId: 'recipe-1',
      recipeTitle: 'Suppe',
      recipeUpdatedAt: 'v1',
      portions: 4,
      rationale: 'Passt zum Vorrat.',
    },
  ],
};

const validShoppingItemProposal = {
  kind: 'shopping_list_item_proposal.v1',
  name: 'Hafermilch',
  quantity: 2,
  unit: 'package',
  foodRuleStatus: 'unknown',
};

function thread(
  id: string,
  updatedAt: string,
  overrides: Record<string, unknown> = {},
): AssistantThread {
  return {
    id,
    title: id,
    model: 'model',
    messages: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt,
    ...overrides,
  } as AssistantThread;
}

describe('assistant account storage', () => {
  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
    jest.mocked(getEncryptedAccountStorage).mockResolvedValue(mockStorage as never);
  });

  it('returns empty history when there is no saved value or it cannot be parsed', async () => {
    await expect(loadAssistantThreads('user-1')).resolves.toEqual([]);
    values.set('ai-assistant.threads.v1', '{bad');
    await expect(loadAssistantThreads('user-1')).resolves.toEqual([]);
    values.set('ai-assistant.threads.v1', JSON.stringify({ not: 'an array' }));
    await expect(loadAssistantThreads('user-1')).resolves.toEqual([]);
  });

  it('keeps only valid threads and caps the restored history', async () => {
    const records = [
      thread('oldest', '2026-01-01'),
      thread('recent', '2026-11-08', {
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            text: 'Antwort',
            createdAt: '2026-11-08',
            proposals: [validProposal],
            toolTrace: ['get_inventory'],
            suggestions: ['Noch eine Idee'],
            attachments: [{ filename: 'rezept.jpg', mimeType: 'image/jpeg' }],
            pageContext: { kind: 'recipe', recipeId: 'recipe-1' },
          },
          {
            id: 'shopping-message',
            role: 'assistant',
            text: 'Ich kann es vorschlagen.',
            createdAt: '2026-11-08',
            proposals: [validShoppingItemProposal],
            toolTrace: ['propose_shopping_list_item'],
            appliedProposalIndexes: [0],
          },
        ],
      }),
      thread('bad-role', '2026-11-07', {
        messages: [{ id: 'x', role: 'system', text: '', createdAt: '' }],
      }),
      thread('bad-proposal', '2026-11-06', {
        messages: [
          { id: 'x', role: 'assistant', text: '', createdAt: '', proposals: [{ kind: 'nope' }] },
        ],
      }),
      thread('bad-tool', '2026-11-05', {
        messages: [
          { id: 'x', role: 'assistant', text: '', createdAt: '', toolTrace: ['run_code'] },
        ],
      }),
      thread('bad-suggestions', '2026-11-04', {
        messages: [{ id: 'x', role: 'assistant', text: '', createdAt: '', suggestions: [4] }],
      }),
    ];
    values.set('ai-assistant.threads.v1', JSON.stringify(records));

    await expect(loadAssistantThreads('user-1')).resolves.toEqual([records[0], records[1]]);
  });

  it('rejects malformed meal proposals and accepts valid ingredient-swap history', async () => {
    const invalid = [
      { ...validProposal, foodRulesUpdatedAt: 4 },
      { ...validProposal, meals: [] },
      { ...validProposal, meals: [{ ...validProposal.meals[0], date: 4 }] },
      { ...validProposal, meals: [{ ...validProposal.meals[0], mealSlot: 'snack' }] },
      { ...validProposal, meals: [{ ...validProposal.meals[0], recipeId: 4 }] },
      { ...validProposal, meals: [{ ...validProposal.meals[0], date: '2026-02-30' }] },
      { ...validProposal, meals: [{ ...validProposal.meals[0], portions: 0 }] },
      { ...validProposal, meals: [{ ...validProposal.meals[0], portions: 13 }] },
      { ...validProposal, meals: [{ ...validProposal.meals[0], portions: -1 }] },
      { ...validProposal, meals: [{ ...validProposal.meals[0], portions: 2.5 }] },
    ];
    const validSwap = {
      kind: 'ingredient_swap_proposal.v1',
      foodRulesUpdatedAt: 'rules-v1',
      recipeId: 'recipe-1',
      recipeTitle: 'Suppe',
      ingredientName: 'Milch',
      replacement: 'Haferdrink',
      rationale: 'Laktosefrei',
      safetyNote: 'Etikett prüfen.',
    };
    values.set(
      'ai-assistant.threads.v1',
      JSON.stringify([
        thread('valid-swap', '2026-11-08', {
          messages: [
            {
              id: 'message-1',
              role: 'assistant',
              text: 'Vorschlag',
              createdAt: '2026-11-08',
              proposals: [validSwap],
            },
          ],
        }),
        ...invalid.map((proposal, index) =>
          thread(`bad-${index}`, `2026-11-0${index + 1}`, {
            messages: [
              { id: 'message', role: 'assistant', text: '', createdAt: '', proposals: [proposal] },
            ],
          }),
        ),
        thread('bad-swap', '2026-11-07', {
          messages: [
            {
              id: 'message',
              role: 'assistant',
              text: '',
              createdAt: '',
              proposals: [{ ...validSwap, replacement: null }],
            },
          ],
        }),
        thread('bad-timestamp', 'not-a-timestamp'),
      ]),
    );

    const restored = await loadAssistantThreads('user-1');
    expect(restored.map(({ id }) => id)).toEqual(['valid-swap']);
  });

  it('restores applied shopping proposals and rejects malformed proposal state', async () => {
    const valid = thread('valid-shopping', '2026-11-08', {
      messages: [
        {
          id: 'message-1',
          role: 'assistant',
          text: 'Übernommen.',
          createdAt: '2026-11-08',
          proposals: [validShoppingItemProposal],
          toolTrace: ['propose_shopping_list_item'],
          appliedProposalIndexes: [0],
        },
      ],
    });
    const invalid = [
      { ...validShoppingItemProposal, quantity: 0 },
      { ...validShoppingItemProposal, unit: 'crate' },
      { ...validShoppingItemProposal, foodRuleStatus: 'clear-ish' },
      { ...validShoppingItemProposal, name: ' '.repeat(201) },
    ].map((proposal, index) =>
      thread(`bad-proposal-${String(index)}`, `2026-11-0${String(index + 1)}`, {
        messages: [
          { id: 'message', role: 'assistant', text: '', createdAt: '', proposals: [proposal] },
        ],
      }),
    );
    const invalidAppliedIndexes = [[0, 0], [-1], [1]].map((appliedProposalIndexes, index) =>
      thread(`bad-application-state-${String(index)}`, `2026-11-0${String(index + 2)}`, {
        messages: [
          {
            id: 'message',
            role: 'assistant',
            text: '',
            createdAt: '',
            proposals: [validShoppingItemProposal],
            appliedProposalIndexes,
          },
        ],
      }),
    );
    values.set(
      'ai-assistant.threads.v1',
      JSON.stringify([valid, ...invalid, ...invalidAppliedIndexes]),
    );

    const restored = await loadAssistantThreads('user-1');
    expect(restored).toEqual([valid]);
    expect(restored[0]?.messages[0]?.appliedProposalIndexes).toEqual([0]);
  });

  it('rejects malformed attachment and page context metadata while retaining valid meal-plan context', async () => {
    const message = (overrides: Record<string, unknown>) => ({
      id: 'message',
      role: 'assistant',
      text: 'Antwort',
      createdAt: '2026-11-08',
      ...overrides,
    });
    const invalidMessages = [
      message({ attachments: [] }),
      message({ attachments: [{ filename: ' ', mimeType: 'image/jpeg' }] }),
      message({ attachments: [{ filename: 'recipe.txt', mimeType: 'text/plain' }] }),
      message({ pageContext: { kind: 'recipe', recipeId: ' ' } }),
      message({ pageContext: { kind: 'recipe', recipeId: 'r'.repeat(129) } }),
      message({ pageContext: { kind: 'meal_plan', weekStartDate: '2026-02-30' } }),
    ];
    const valid = thread('valid-context', '2026-11-08', {
      messages: [message({ pageContext: { kind: 'meal_plan', weekStartDate: '2026-11-09' } })],
    });
    values.set(
      'ai-assistant.threads.v1',
      JSON.stringify([
        valid,
        ...invalidMessages.map((entry, index) =>
          thread(`invalid-context-${index}`, `2026-11-0${index + 1}`, { messages: [entry] }),
        ),
      ]),
    );

    await expect(loadAssistantThreads('user-1')).resolves.toEqual([valid]);
  });

  it('sorts and caps saved threads to the 20 most recently updated', async () => {
    const threads = Array.from({ length: 25 }, (_, index) =>
      thread(`thread-${index}`, `2026-11-${String(index + 1).padStart(2, '0')}`),
    );
    await saveAssistantThreads('user-1', threads);
    const saved = JSON.parse(values.get('ai-assistant.threads.v1') ?? '[]') as AssistantThread[];
    expect(saved).toHaveLength(20);
    expect(saved[0]?.id).toBe('thread-24');
    expect(saved.at(-1)?.id).toBe('thread-5');
  });
});
