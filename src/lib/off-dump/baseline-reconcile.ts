/**
 * Reine Zustands-Rekonziliation für den sicheren Baseline-Wechsel (#223
 * Paket 6, Abschnitt 14 "Sicherer Baseline-Wechsel"). Aus der Menge der
 * tatsächlich vorhandenen Dateien (active/next/recovery) wird abgeleitet,
 * welche Aufräum-/Fortsetzungsaktionen nötig sind — unabhängig davon, WARUM
 * genau dieser Zustand vorliegt (normaler Start oder Absturz mittendrin).
 *
 * Unter der korrekten Ablaufreihenfolge (siehe baseline-installer.ts) sind
 * nur vier Zwischenzustände erreichbar: {active}, {active,next},
 * {next,recovery}, {active,recovery}. Die übrigen (alle drei; nur next;
 * nur recovery) sollten nicht vorkommen, werden hier aber defensiv
 * behandelt, falls doch — nie mit einem Fehler, immer mit dem
 * konservativsten Pfad zurück zu einem eindeutigen Zustand.
 */

export type ReconcileAction =
  | { kind: 'move'; from: 'next' | 'recovery'; to: 'active' }
  | { kind: 'delete'; file: 'next' | 'recovery' };

export function reconcileBaselineState(state: {
  active: boolean;
  next: boolean;
  recovery: boolean;
}): ReconcileAction[] {
  const { active, next, recovery } = state;

  // Normalzustand oder frischer Erstinstall — nichts zu tun.
  if (!next && !recovery) return [];

  // Swap ist bereits abgeschlossen (active = die neue Datei), nur das
  // Aufräumen von recovery fehlt noch (Absturz zwischen Schritt 8 und 10).
  if (active && !next && recovery) {
    return [{ kind: 'delete', file: 'recovery' }];
  }

  // Absturz zwischen Umbenennen alt->recovery und next->active (Schritt 7/8):
  // next wurde schon vor dem Swap-Beginn integritaetsgeprueft (Schritt 2-4),
  // der Swap laesst sich also sicher zu Ende fuehren statt zurueckzurollen.
  if (!active && next && recovery) {
    return [
      { kind: 'move', from: 'next', to: 'active' },
      { kind: 'delete', file: 'recovery' },
    ];
  }

  // Nur recovery: next ging verloren, bevor der Swap abgeschlossen war —
  // zurueck zum letzten bekannt guten Stand.
  if (!active && !next && recovery) {
    return [{ kind: 'move', from: 'recovery', to: 'active' }];
  }

  // Alles Uebrige (next vorhanden, egal ob mit active und/oder recovery):
  // active — falls vorhanden — ist der vertrauenswuerdige Stand, next war
  // noch nicht aktiviert. Verwirft next (und recovery, falls vorhanden)
  // statt einen unbestaetigten Download zu uebernehmen.
  const actions: ReconcileAction[] = [{ kind: 'delete', file: 'next' }];
  if (recovery) actions.push({ kind: 'delete', file: 'recovery' });
  return actions;
}
