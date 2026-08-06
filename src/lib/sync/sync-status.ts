/**
 * Statusberechnung fuer den Offline-Indikator (#51).
 *
 * Rein: kein Netzwerk, keine Datenbank. Die Eingaben (Netzwerkstatus,
 * ausstehende/gescheiterte Outbox-Zeilen) liefert `use-sync-status.ts`, das
 * die eigentliche I/O uebernimmt. Dieselbe Aufteilung wie bei `resolve.ts`
 * und `coalesce.ts`: die Entscheidung ist testbar ohne jede Infrastruktur.
 */

export type SyncStatusView =
  | { kind: 'hidden' }
  | { kind: 'offline'; pendingCount: number }
  | { kind: 'syncing'; pendingCount: number }
  | { kind: 'failed'; failedCount: number };

/**
 * Reihenfolge der Regeln ist Teil der Semantik:
 *
 * 1. **Gescheitert schlaegt alles.** Eine dauerhaft gescheiterte Zeile braucht
 *    Aufmerksamkeit, ob online oder nicht — sie wird durch Warten allein nie
 *    verschwinden.
 * 2. **Offline wird immer gezeigt**, auch ohne ausstehende Aenderungen: Der
 *    Nutzer soll wissen, warum sich gerade nichts aktualisiert, nicht nur,
 *    dass etwas in der Warteschlange steht.
 * 3. **Ausstehend** heisst online, aber noch nicht durchgekommen.
 * 4. Sonst: nichts zu zeigen.
 */
export function computeSyncStatusView(input: {
  isOnline: boolean;
  pendingCount: number;
  failedCount: number;
}): SyncStatusView {
  if (input.failedCount > 0) {
    return { kind: 'failed', failedCount: input.failedCount };
  }

  if (!input.isOnline) {
    return { kind: 'offline', pendingCount: input.pendingCount };
  }

  if (input.pendingCount > 0) {
    return { kind: 'syncing', pendingCount: input.pendingCount };
  }

  return { kind: 'hidden' };
}
