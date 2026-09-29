import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

export type WatchShoppingToggleEvent = {
  householdId: string;
  itemId: string;
  isChecked: boolean;
};

type FamWatchConnectivityNativeModule = {
  publishSnapshot(snapshotJSON: string): void;
  addListener(
    eventName: 'onWatchToggle',
    listener: (event: WatchShoppingToggleEvent) => void,
  ): EventSubscription;
};

const nativeModule = requireOptionalNativeModule<FamWatchConnectivityNativeModule>(
  'FamWatchConnectivity',
);

function publishSnapshot(snapshotJSON: string): void {
  nativeModule?.publishSnapshot(snapshotJSON);
}

function addWatchToggleListener(
  listener: (event: WatchShoppingToggleEvent) => void,
): EventSubscription | undefined {
  return nativeModule?.addListener('onWatchToggle', listener);
}

export default { addWatchToggleListener, publishSnapshot };
