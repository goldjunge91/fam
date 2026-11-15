import { ExtensionStorage } from '@bacons/apple-targets';

import watchConnectivity from '../../../../modules/fam-watch-connectivity';
import { WATCH_SNAPSHOT_KEY, type WatchShoppingSnapshot } from './watch-snapshot-contract';
import { publishWatchShoppingSnapshot } from './watch-snapshot-publisher.ios';

const mockBeginWriterLease = jest.fn();
const mockLeaseEnd = jest.fn();

function createWriterLease() {
  return { signal: new AbortController().signal, ended: false, end: mockLeaseEnd };
}

jest.mock('@/lib/apple/shared-store-lifecycle', () => ({
  sharedStoreWriterOwner: {
    beginWriterLease: (...args: unknown[]) => mockBeginWriterLease(...args),
  },
  withSharedStoreWriterSync: (
    owner: { beginWriterLease: (name: string) => ReturnType<typeof createWriterLease> | null },
    name: string,
    operation: (lease: ReturnType<typeof createWriterLease>) => unknown,
  ) => {
    const lease = owner.beginWriterLease(name);
    if (!lease) throw new Error('writer unavailable');
    try {
      return operation(lease);
    } finally {
      lease.end();
    }
  },
}));

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
  beforeEach(() => {
    mockBeginWriterLease.mockReset().mockImplementation(() => createWriterLease());
    mockLeaseEnd.mockReset();
    const storage = jest.mocked(ExtensionStorage).mock.results[0]?.value;
    storage?.set.mockClear();
    if (watchConnectivity) jest.mocked(watchConnectivity.publishSnapshot).mockClear();
  });

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
          categoryColor: null,
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
    expect(mockBeginWriterLease).toHaveBeenCalledWith('watch.snapshot.write');
    expect(mockLeaseEnd).toHaveBeenCalledTimes(1);
    expect(watchConnectivity?.publishSnapshot).toHaveBeenCalledWith(snapshotJSON);
  });

  it('beendet die Writer-Zusage bei einem fehlgeschlagenen Shared-Write', () => {
    const storage = jest.mocked(ExtensionStorage).mock.results[0]?.value;
    if (storage === undefined) throw new Error('Watch app-group storage was not initialized.');
    storage.set.mockImplementationOnce(() => {
      throw new Error('shared write failed');
    });

    expect(() =>
      publishWatchShoppingSnapshot({
        householdId: 'household-1',
        storeName: null,
        updatedAt: '2026-09-29T08:00:00.000Z',
        items: [],
        stores: [],
      }),
    ).toThrow('shared write failed');
    expect(mockLeaseEnd).toHaveBeenCalledTimes(1);
    expect(watchConnectivity?.publishSnapshot).not.toHaveBeenCalled();
  });

  it('skips persistence when JSON serialization has no result', () => {
    const storage = jest.mocked(ExtensionStorage).mock.results[0]?.value;
    if (storage === undefined) throw new Error('Watch app-group storage was not initialized.');
    const snapshotWithoutSerializedValue = Object.assign(
      {
        householdId: 'household-1',
        storeName: 'REWE',
        updatedAt: '2026-09-29T08:00:00.000Z',
        items: [],
        stores: [],
      },
      {
        toJSON: () => undefined,
      },
    );

    publishWatchShoppingSnapshot(snapshotWithoutSerializedValue);

    expect(storage.set).not.toHaveBeenCalled();
    expect(mockBeginWriterLease).not.toHaveBeenCalled();
  });
});
