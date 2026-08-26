import * as Network from 'expo-network';

import { detectReconnect } from '@/lib/sync/reconnect';

export type NetworkReconnectTriggerDeps = {
  onReconnect: () => Promise<void>;
  /** Schutz gegen flatternde Verbindungen, die alle paar Sekunden erneut ausloesen. */
  minIntervalMs?: number;
  now?(): number;
};

const DEFAULT_MIN_INTERVAL_MS = 10_000;

export function startNetworkReconnectTrigger(deps: NetworkReconnectTriggerDeps): () => void {
  const minIntervalMs = deps.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const now = deps.now ?? Date.now;

  let previousOnline: boolean | null = null;
  let lastTriggeredAtMs = -Infinity;

  const subscription = Network.addNetworkStateListener((state) => {
    const isOnline = state.isInternetReachable ?? state.isConnected ?? true;

    if (detectReconnect(previousOnline, isOnline) && now() - lastTriggeredAtMs >= minIntervalMs) {
      lastTriggeredAtMs = now();
      void deps.onReconnect();
    }

    previousOnline = isOnline;
  });

  return () => subscription.remove();
}
