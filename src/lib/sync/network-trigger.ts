import * as Network from 'expo-network';

import { detectReconnect } from '@/lib/sync/reconnect';

/**
 * Netzwerk-Reconnect-Trigger (#50).
 *
 * Duenner `expo-network`-Wrapper — bewusst NICHT ueber `onlineManager` aus
 * `query-client.ts` (das ist die TanStack-Query-Schicht; `sync/` soll davon
 * unabhaengig bleiben, und die AC nennt `expo-network` ausdruecklich).
 * Dieselbe `isInternetReachable ?? isConnected ?? true`-Heuristik wie dort,
 * bewusst dupliziert statt geteilt — zwei Aufrufer derselben drei Zeilen
 * rechtfertigen keine gemeinsame Abstraktion ueber ein Modul-Grenze hinweg,
 * die sonst nichts miteinander zu tun haben.
 *
 * Kein automatisierter Test fuer dieses Modul: es ist ein reiner
 * natives-Modul-Wrapper (`Network.addNetworkStateListener`), der unter
 * `jest-expo` wie unter dem Node-Setup der Integrationstests nicht laedt —
 * derselbe Luecke wie bei `src/lib/db/client.ts`. Die eigentliche Logik
 * (`detectReconnect`) ist bereits isoliert und fuer sich getestet.
 */

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
