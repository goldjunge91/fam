import type { WatchShoppingSnapshot } from './watch-snapshot-contract';

/** Android and web do not have a paired watchOS target to publish to. */
export function publishWatchShoppingSnapshot(_snapshot: WatchShoppingSnapshot): void {}
