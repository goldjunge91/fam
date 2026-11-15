import { getDatabase } from '@/lib/db/local-client';
import { enqueueMutationStepsInExclusiveTransaction } from '@/lib/db/outbox';
import { buildAddOrMergeShoppingItemMutation } from '@/lib/db/shopping-list-merge';
import type { SqlDatabase } from '@/lib/db/types';
import { applyAssistantShoppingListProposal } from './apply-shopping-list-proposal';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'item-id') }));
jest.mock('@/lib/db/local-client', () => ({ getDatabase: jest.fn() }));
jest.mock('@/lib/db/outbox', () => ({
  enqueueMutationStepsInExclusiveTransaction: jest.fn(),
}));
jest.mock('@/lib/db/shopping-list-merge', () => ({
  buildAddOrMergeShoppingItemMutation: jest.fn(),
}));

const proposal = {
  kind: 'shopping_list_proposal.v1' as const,
  summary: 'Hafermilch ergänzen',
  items: [
    { name: 'Hafermilch', quantity: 2, unit: 'package' as const, foodRuleStatus: 'clear' as const },
    { name: 'Linsen', quantity: 500, unit: 'g' as const, foodRuleStatus: 'clear' as const },
  ],
};

const mockDb = {} as SqlDatabase;
const mockTxn = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
} as unknown as SqlDatabase;
const mockAppend = jest.fn();

describe('applyAssistantShoppingListProposal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDatabase).mockResolvedValue(mockDb as never);
    jest
      .mocked(enqueueMutationStepsInExclusiveTransaction)
      .mockImplementation(async (_db, build) => build(mockTxn, mockAppend));
    jest.mocked(mockTxn.getFirstAsync).mockResolvedValue(null);
    jest.mocked(mockTxn.runAsync).mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
    jest.mocked(buildAddOrMergeShoppingItemMutation).mockResolvedValue({
      entity: 'shopping_list_items',
      entityId: 'item-id',
      op: 'insert',
      payload: {},
      applyLocally: jest.fn(),
    } as never);
    mockAppend.mockResolvedValue(undefined);
  });

  it('applies every item and writes an idempotency receipt in the same transaction', async () => {
    const result = await applyAssistantShoppingListProposal({
      userId: 'user-1',
      householdId: 'household-1',
      proposalKey: 'reply-1-0',
      proposal,
    });

    expect(result).toEqual({ addedCount: 2, alreadyApplied: false });
    expect(mockAppend).toHaveBeenCalledTimes(2);
    expect(buildAddOrMergeShoppingItemMutation).toHaveBeenNthCalledWith(
      1,
      mockTxn,
      'item-id',
      expect.objectContaining({ name: 'Hafermilch', household_id: 'household-1' }),
    );
    expect(mockTxn.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('insert into applied_assistant_shopping_proposals'),
      ['user-1', 'household-1', 'reply-1-0', expect.any(Number)],
    );
  });

  it('does not merge items a second time when the proposal receipt already exists', async () => {
    jest.mocked(mockTxn.getFirstAsync).mockResolvedValue({ proposal_key: 'reply-1-0' } as never);

    const result = await applyAssistantShoppingListProposal({
      userId: 'user-1',
      householdId: 'household-1',
      proposalKey: 'reply-1-0',
      proposal,
    });

    expect(result).toEqual({ addedCount: 0, alreadyApplied: true });
    expect(buildAddOrMergeShoppingItemMutation).not.toHaveBeenCalled();
    expect(mockAppend).not.toHaveBeenCalled();
    expect(mockTxn.runAsync).not.toHaveBeenCalled();
  });

  it('leaves the receipt absent when adding an item fails', async () => {
    jest.mocked(buildAddOrMergeShoppingItemMutation).mockRejectedValueOnce(new Error('offline'));

    await expect(
      applyAssistantShoppingListProposal({
        userId: 'user-1',
        householdId: 'household-1',
        proposalKey: 'reply-1-0',
        proposal,
      }),
    ).rejects.toThrow('offline');
    expect(mockTxn.runAsync).not.toHaveBeenCalled();
  });
});
