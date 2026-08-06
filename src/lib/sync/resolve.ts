/**
 * Konfliktaufloesung der Sync-Engine (#47, #49).
 *
 * Bewusst eine reine Funktion: keine Datenbank, kein Netz, keine Uhr. Diese
 * Datei importiert nichts. Genau dieser Zuschnitt ist der Grund, warum sie
 * vollstaendig und ohne Testdoubles pruefbar ist — die Forderung aus #49.
 *
 * Das Verfahren ist Last-Write-Wins mit Soft-Delete-Tombstones. Bewusste
 * Vereinfachung gegenueber einem CRDT: Bei gleichzeitiger Bearbeitung gewinnt
 * der spaetere Schreibzugriff, Undo ist Aufgabe der UI, nicht der Engine.
 */

export type SyncSide = {
  /** Primaerschluessel. Bei local und remote derselben Zeile identisch. */
  id: string;
  /** epoch ms, bereits normalisiert (siehe `toEpochMs` in cursor.ts). */
  updatedAt: number;
  /** epoch ms oder null. `null` heisst lebendig, eine Zahl heisst Tombstone. */
  deletedAt: number | null;
};

export type ResolveOptions = {
  /**
   * Obergrenze fuer den LOKALEN Zeitstempel, in epoch ms — aus der Serverzeit
   * abgeleitet (server-clock.ts).
   *
   * Ohne sie koennte eine falsch gestellte Geraeteuhr jede kuenftige
   * Serveraenderung dauerhaft schlagen: Eine Zeile mit updatedAt im Jahr 2099
   * gewaenne siebzig Jahre lang jeden Vergleich. Das ist der "Deadlock"-Fall
   * aus #49.
   */
  clockCeiling: number;
};

export type Resolution = 'local' | 'remote';

/**
 * Entscheidet, welche Fassung derselben Zeile gilt.
 *
 * Reihenfolge der Regeln ist Teil der Semantik:
 *
 * 1. **Tombstone schlaegt Update.** Hat genau eine Seite `deletedAt`, gewinnt
 *    sie — unabhaengig von jedem Zeitstempel. Sonst taeuchte ein geloeschter
 *    Artikel wieder auf, sobald ihn jemand gleichzeitig bearbeitet hat. Gilt in
 *    beide Richtungen: Remote-Tombstone gegen lokales Update ebenso wie
 *    lokaler Tombstone gegen neueres Remote-Update.
 * 2. **Uhr-Klemmung.** Der lokale Zeitstempel wird auf `clockCeiling` gedeckelt.
 *    Der Remote-Wert wird nie geklemmt — der Server ist per Definition die
 *    Autoritaet.
 * 3. **Last-Write-Wins** ueber den (geklemmten) Zeitstempel.
 * 4. **Tiebreak ueber die id** bei exakter Gleichheit.
 *
 * Zu (4) — das sieht nach einem Fehler aus und ist keiner: `resolve` wird immer
 * fuer *dieselbe logische Zeile* aufgerufen, also gilt `local.id === remote.id`
 * und die Regel liefert `'remote'`. Das ist die einzig konvergente Antwort.
 * Bevorzugte der Tiebreak `'local'`, behielte Geraet A seinen Wert und Geraet B
 * seinen — die beiden wuerden sich nie einigen, und genau das verbietet das
 * Akzeptanzkriterium "gleichzeitige Bearbeitung endet auf beiden Geraeten im
 * selben Zustand". Der Vergleich ueber die id erfuellt zugleich den in #49
 * geforderten deterministischen Tiebreak und bleibt fuer beliebige Paare total.
 *
 * Die Nutzeraenderung geht dabei nicht verloren, auch wenn `'remote'` gewinnt:
 * Lokal geaenderte Zeilen tragen `_dirty = 1` und ihre Absicht liegt in der
 * Outbox. Sie wird beim Push erneut angewandt und bekommt dort einen
 * autoritativen Serverzeitstempel.
 */
export function resolve(local: SyncSide, remote: SyncSide, options: ResolveOptions): Resolution {
  const localDeleted = local.deletedAt !== null;
  const remoteDeleted = remote.deletedAt !== null;

  if (localDeleted !== remoteDeleted) {
    return localDeleted ? 'local' : 'remote';
  }

  const effectiveLocal = Math.min(local.updatedAt, options.clockCeiling);

  if (effectiveLocal > remote.updatedAt) return 'local';
  if (effectiveLocal < remote.updatedAt) return 'remote';

  return remote.id >= local.id ? 'remote' : 'local';
}
