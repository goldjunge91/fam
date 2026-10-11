import type { WatchShoppingSnapshot } from './watch-snapshot-contract';

describe('non-watch snapshot publisher', () => {
  it('accepts snapshots on platforms without a paired watch target', () => {
    const fallback = jest.requireActual<typeof import('./watch-snapshot-publisher')>(
      './watch-snapshot-publisher.ts',
    );
    const snapshot: WatchShoppingSnapshot = {
      householdId: null,
      storeName: null,
      updatedAt: '2026-10-11T00:00:00.000Z',
      items: [],
      stores: [],
    };

    expect(() => fallback.publishWatchShoppingSnapshot(snapshot)).not.toThrow();
  });
});
