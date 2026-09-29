import { ExtensionStorage } from '@bacons/apple-targets';

import watchConnectivity from '../../../../modules/fam-watch-connectivity';
import { WATCH_SNAPSHOT_KEY, type WatchShoppingSnapshot } from './watch-snapshot-contract';
import { publishWatchShoppingSnapshot } from './watch-snapshot-publisher.ios';

jest.mock('@bacons/apple-targets', () => ({
  ExtensionStorage: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
  })),
}));

jest.mock('../../../../modules/fam-watch-connectivity', () => ({
  __esModule: true,
  default: {
    publishSnapshot: jest.fn(),
  },
}));

describe('publishWatchShoppingSnapshot', () => {
  it('stores and sends the same snapshot to the paired Watch', () => {
    const snapshot: WatchShoppingSnapshot = {
      householdId: 'household-1',
      storeName: 'REWE',
      updatedAt: '2026-09-29T08:00:00.000Z',
      items: [
        {
          id: 'milk',
          name: 'Milch',
          quantityLabel: '2 l',
          category: 'Getränke',
          isChecked: false,
        },
      ],
      stores: [],
    };
    const snapshotJSON = JSON.stringify(snapshot);
    const storage = jest.mocked(ExtensionStorage).mock.results[0]?.value;

    if (storage === undefined) throw new Error('Watch app-group storage was not initialized.');

    publishWatchShoppingSnapshot(snapshot);

    expect(storage.set).toHaveBeenCalledWith(WATCH_SNAPSHOT_KEY, snapshotJSON);
    expect(watchConnectivity?.publishSnapshot).toHaveBeenCalledWith(snapshotJSON);
  });
});
