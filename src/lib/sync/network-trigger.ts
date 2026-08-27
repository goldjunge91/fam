import * as Network from 'expo-network';

import { detectReconnect } from '@/lib/sync/reconnect';
import { addDiagnosticStep, reportError } from '@/lib/telemetry';

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
      addDiagnosticStep('network.reconnected', {
        operation: 'network.reconnect',
        network_state: 'online',
      });
      void deps.onReconnect().catch((error) => {
        reportError(error, {
          operation: 'network.reconnect',
          error_code: 'network_reconnect_failed',
        });
      });
    }

    previousOnline = isOnline;
  });

  return () => subscription.remove();
}
