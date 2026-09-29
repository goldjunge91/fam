import { toWatchShoppingToggleMutationInput } from './watch-toggle-handler';

const event = {
  householdId: 'household-1',
  itemId: 'item-1',
  isChecked: true,
};

describe('toWatchShoppingToggleMutationInput', () => {
  it('maps a matching Watch check into the active household mutation', () => {
    expect(
      toWatchShoppingToggleMutationInput(
        event,
        'household-1',
        'account-1',
        '2026-09-29T00:00:00.000Z',
      ),
    ).toEqual({
      id: 'item-1',
      household_id: 'household-1',
      checked_at: '2026-09-29T00:00:00.000Z',
      checked_by: 'account-1',
    });
  });

  it('clears check metadata when Watch unchecks an item', () => {
    expect(
      toWatchShoppingToggleMutationInput(
        { ...event, isChecked: false },
        'household-1',
        'account-1',
        '2026-09-29T00:00:00.000Z',
      ),
    ).toMatchObject({ checked_at: null, checked_by: null });
  });

  it('ignores a stale toggle for a different active household', () => {
    expect(
      toWatchShoppingToggleMutationInput(
        event,
        'household-2',
        'account-1',
        '2026-09-29T00:00:00.000Z',
      ),
    ).toBeNull();
  });
});
