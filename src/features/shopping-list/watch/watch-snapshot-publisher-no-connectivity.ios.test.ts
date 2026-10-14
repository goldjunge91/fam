import { ExtensionStorage } from '@bacons/apple-targets';

import { WATCH_SNAPSHOT_KEY, type WatchShoppingSnapshot } from './watch-snapshot-contract';
import { publishWatchShoppingSnapshot } from './watch-snapshot-publisher.ios';

jest.mock('@bacons/apple-targets', () => ({
  ExtensionStorage: jest.fn().mockImplementation(() => ({ set: jest.fn() })),
}));

jest.mock('../../../../modules/fam-watch-connectivity', () => ({
  __esModule: true,
  default: null,
}));

const snapshot: WatchShoppingSnapshot = {
  householdId: 'household-1',
  storeName: null,
  updatedAt: '2026-10-11T00:00:00.000Z',
  items: [],
  stores: [],
};

beforeEach(() => {
  const storage = jest.mocked(ExtensionStorage).mock.results[0]?.value;
  if (storage === undefined) throw new Error('Watch app-group storage was not initialized.');
  jest.mocked(storage.set).mockClear();
});

test('stores the snapshot when Watch connectivity is unavailable', () => {
  const storage = jest.mocked(ExtensionStorage).mock.results[0]?.value;
  if (storage === undefined) throw new Error('Watch app-group storage was not initialized.');

  publishWatchShoppingSnapshot(snapshot);

  expect(storage.set).toHaveBeenCalledWith(WATCH_SNAPSHOT_KEY, JSON.stringify(snapshot));
});

test('skips persistence when JSON serialization has no result', () => {
  const storage = jest.mocked(ExtensionStorage).mock.results[0]?.value;
  if (storage === undefined) throw new Error('Watch app-group storage was not initialized.');
  const snapshotWithoutSerializedValue = Object.assign(
    { ...snapshot },
    {
      toJSON: () => undefined,
    },
  );

  publishWatchShoppingSnapshot(snapshotWithoutSerializedValue);

  expect(storage.set).not.toHaveBeenCalled();
});
