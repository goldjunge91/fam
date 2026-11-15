import { ExtensionStorage } from '@bacons/apple-targets';
import {
  sharedStoreWriterOwner,
  withSharedStoreWriterSync,
} from '@/lib/apple/shared-store-lifecycle';
import watchConnectivity from '../../../../modules/fam-watch-connectivity';
import { WATCH_SNAPSHOT_KEY, type WatchShoppingSnapshot } from './watch-snapshot-contract';

const watchStorage = new ExtensionStorage('group.com.goldjunge91.fam1');

export function publishWatchShoppingSnapshot(snapshot: WatchShoppingSnapshot): void {
  const snapshotJSON = JSON.stringify(snapshot);
  if (snapshotJSON === undefined) return;

  withSharedStoreWriterSync(sharedStoreWriterOwner, 'watch.snapshot.write', () => {
    watchStorage.set(WATCH_SNAPSHOT_KEY, snapshotJSON);
  });
  watchConnectivity?.publishSnapshot(snapshotJSON);
}
