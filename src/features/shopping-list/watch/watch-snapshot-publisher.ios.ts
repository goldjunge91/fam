import { ExtensionStorage } from '@bacons/apple-targets';

import { WATCH_SNAPSHOT_KEY, type WatchShoppingSnapshot } from './watch-snapshot-contract';

const watchStorage = new ExtensionStorage('group.com.goldjunge91.fam1');

export function publishWatchShoppingSnapshot(snapshot: WatchShoppingSnapshot): void {
  watchStorage.set(WATCH_SNAPSHOT_KEY, JSON.stringify(snapshot));
}
