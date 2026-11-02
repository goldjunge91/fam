import { render, waitFor } from '@testing-library/react-native';
import { debugError } from '@/lib/observability/debug-log';
import type { WatchShoppingToggleEvent } from '../../../../modules/fam-watch-connectivity';
import { WatchShoppingToggleListener } from './watch-toggle-listener';

const mockMutateAsync = jest.fn();
const mockRemove = jest.fn();
let mockListener: ((event: WatchShoppingToggleEvent) => void) | undefined;

jest.mock('../../../../modules/fam-watch-connectivity', () => ({
  __esModule: true,
  default: {
    addWatchToggleListener: (listener: (event: WatchShoppingToggleEvent) => void) => {
      mockListener = listener;
      return { remove: mockRemove };
    },
  },
}));

jest.mock('../hooks/use-shopping-list-mutations', () => ({
  useToggleShoppingItem: () => ({ mutateAsync: mockMutateAsync }),
}));

jest.mock('@/lib/observability/debug-log', () => ({ debugError: jest.fn() }));

describe('WatchShoppingToggleListener', () => {
  beforeEach(() => {
    mockListener = undefined;
    mockRemove.mockReset();
    mockMutateAsync.mockReset().mockResolvedValue(undefined);
    jest.mocked(debugError).mockClear();
  });

  it('subscribes with the active household and removes the subscription on unmount', async () => {
    const view = await render(
      <WatchShoppingToggleListener activeHouseholdId="household-1" accountId="user-1" />,
    );

    expect(mockListener).toBeDefined();
    await view.unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale watch event and forwards a matching toggle', async () => {
    await render(
      <WatchShoppingToggleListener activeHouseholdId="household-1" accountId="user-1" />,
    );
    const listener = mockListener;
    if (!listener) throw new Error('Watch listener was not registered');

    listener({ householdId: 'household-old', itemId: 'item-1', isChecked: true });
    expect(mockMutateAsync).not.toHaveBeenCalled();

    listener({ householdId: 'household-1', itemId: 'item-1', isChecked: true });
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'item-1',
          household_id: 'household-1',
          checked_at: expect.any(String),
          checked_by: 'user-1',
        }),
      ),
    );
  });

  it('reports a failed local toggle without leaking a rejected promise', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('outbox unavailable'));
    await render(<WatchShoppingToggleListener activeHouseholdId="household-1" accountId={null} />);
    const listener = mockListener;
    if (!listener) throw new Error('Watch listener was not registered');

    listener({ householdId: 'household-1', itemId: 'item-2', isChecked: false });

    await waitFor(() =>
      expect(debugError).toHaveBeenCalledWith(
        'Watch-Einkaufslistenänderung fehlgeschlagen:',
        expect.any(Error),
      ),
    );
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ checked_at: null, checked_by: null }),
    );
  });
});
