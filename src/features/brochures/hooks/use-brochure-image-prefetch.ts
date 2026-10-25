import { Image } from 'expo-image';
import * as Network from 'expo-network';
import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/features/auth/session-provider';
import { brochureImageSource } from '../lib/brochure-image';
import {
  type BrochureImagePrefetchItem,
  type BrochureImagePrefetchReference,
  prefetchBrochureImages,
} from '../lib/brochure-image-prefetch';

export function useBrochureImagePrefetch(
  references: readonly BrochureImagePrefetchReference[],
  snapshotZipCode: string | null,
): void {
  const { session } = useSession();
  const accessToken = session?.access_token ?? null;
  const currentSnapshotZipCode = useRef(snapshotZipCode);
  currentSnapshotZipCode.current = snapshotZipCode;
  const completed = useRef(new Set<string>());
  const items = useMemo<BrochureImagePrefetchItem[]>(
    () =>
      references.flatMap(({ reference, validUntil }) => {
        const source = brochureImageSource(reference, accessToken);
        return source?.headers ? [{ uri: source.uri, headers: source.headers, validUntil }] : [];
      }),
    [accessToken, references],
  );

  useEffect(() => {
    if (!snapshotZipCode || items.length === 0 || !accessToken) return;

    let stopped = false;
    let appIsActive = AppState.currentState === 'active';
    let isWifi = false;
    let isRunning = false;
    const inFlight = new Map<string, Promise<boolean>>();

    const canContinue = () =>
      !stopped && currentSnapshotZipCode.current === snapshotZipCode && appIsActive && isWifi;

    const run = async () => {
      if (!canContinue() || isRunning) return;
      isRunning = true;
      try {
        await prefetchBrochureImages({
          items,
          canContinue,
          completed: completed.current,
          inFlight,
          prefetch: (item) =>
            Image.prefetch(item.uri, { cachePolicy: 'disk', headers: item.headers }),
        });
      } finally {
        isRunning = false;
      }
    };

    const networkSubscription = Network.addNetworkStateListener((state) => {
      isWifi =
        state.type === Network.NetworkStateType.WIFI &&
        state.isConnected !== false &&
        state.isInternetReachable !== false;
      void run();
    });
    const appSubscription = AppState.addEventListener('change', (state) => {
      appIsActive = state === 'active';
      void run();
    });

    void Network.getNetworkStateAsync()
      .then((state) => {
        isWifi =
          state.type === Network.NetworkStateType.WIFI &&
          state.isConnected !== false &&
          state.isInternetReachable !== false;
        void run();
      })
      .catch(() => {
        isWifi = false;
      });

    return () => {
      stopped = true;
      networkSubscription.remove();
      appSubscription.remove();
    };
  }, [accessToken, items, snapshotZipCode]);
}
