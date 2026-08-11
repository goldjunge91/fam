/**
 * Der Port zur lokalen Datenbank — und die Grenze, an der Epic 2 testbar wird.
 *
 * Diese Datei importiert absichtlich NICHTS. `expo-sqlite` ist ein natives
 * Modul und laeuft weder unter `jest-expo` noch im Node-Setup der
 * Integrationstests. Wuerde die Sync-Logik direkt dagegen programmieren, waere
 * sie nur auf einem Geraet pruefbar — und #49 verlangt ausdruecklich Tests ohne
 * Testdoubles.
 *
 * Stattdessen sprechen alle Schichten ausser `client.ts` nur gegen `SqlDatabase`.
 * In der App erfuellt `expo-sqlite` den Port, im Test `node:sqlite` — eine echte
 * SQLite-Engine, kein Mock. Dasselbe Muster wie `KeyValueStore` in
 * `chunked-storage.ts`, das im Test von einer echten Map erfuellt wird.
 *
 * Zwei Regeln, die aus dem doppelten Treiber folgen:
 *
 * 1. **Nur positionelle `?`-Parameter**, nie benannte (`$foo`, `:foo`). Die
 *    Bindings der beiden Treiber unterscheiden sich dort.
 * 2. **Kein treiberspezifisches SQL.** Was hier durchgeht, muss beide Engines
 *    verstehen.
 */

/** Was SQLite als Parameter binden kann. Kein `any`, keine Objekte. */
export type SqlParam = string | number | null;

export type SqlRunResult = {
  /** Bei `insert` in eine AUTOINCREMENT-Tabelle die vergebene rowid. */
  lastInsertRowId: number;
  changes: number;
};

/**
 * Die Teilmenge der SQLite-API, die dieses Projekt benutzt.
 *
 * Bewusst klein gehalten: Jede zusaetzliche Methode muss von beiden Treibern
 * erfuellt werden und macht den Test-Adapter groesser.
 */
export type SqlDatabase = {
  /** Mehrere Statements am Stueck, ohne Parameter. Fuer DDL und PRAGMA. */
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: readonly SqlParam[]): Promise<SqlRunResult>;
  getAllAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T | null>;
  /**
   * Exklusive Transaktion. Bewusst nicht `withTransactionAsync`: Laut
   * Expo-Doku geraten dort nebenlaeufige, voellig unbeteiligte Queries mit in
   * die Transaktion und werden bei einem Rollback mit zurueckgedreht. Fuer die
   * Zusicherung aus #46 ("Abbruch mitten in der Transaktion hinterlaesst keinen
   * halben Zustand") ist nur die exklusive Variante belastbar.
   *
   * Innerhalb der Funktion MUSS jedes Statement auf `txn` laufen. Wer auf das
   * aeussere Handle zugreift, steht ausserhalb der Transaktion — das ist die
   * leise Variante genau dieses Fehlers, deshalb bekommt der Callback das
   * Handle als Argument statt es aus dem Scope zu nehmen.
   */
  withExclusiveTransactionAsync(task: (txn: SqlDatabase) => Promise<void>): Promise<void>;
};

// --------------------------------------------------------------- Migrationen

export type Migration = {
  /** Fortlaufend ab 1, luecken- und duplikatfrei. */
  version: number;
  /** Kurzer Name, taucht nur in Fehlermeldungen auf. */
  name: string;
  statements: readonly string[];
};

// ------------------------------------------------------------------ Entitaeten

/** Die Spiegeltabellen aus #45. Die privaten Tracking-Tabellen sind bewusst nicht dabei. */
export type Entity =
  | 'storage_locations'
  | 'stores'
  | 'fridge_items'
  | 'shopping_list_items'
  | 'products'
  | 'households';

/**
 * `restore` setzt `deleted_at` serverseitig zurueck auf `null` — fuer
 * Undo-nach-Loeschen (#69), wo ein reines `update` es nicht tut:
 * `buildUpdatePayload()` in `push.ts` filtert `deleted_at` aus jedem
 * `update`-Push explizit heraus (`SYNC_COLUMNS`), ein `restore` ist deshalb
 * eine eigene Operation statt ein `update` mit `deleted_at: null` im Payload.
 */
export type OutboxOp = 'insert' | 'update' | 'delete' | 'restore';

export type OutboxEntry = {
  id: number;
  entity: Entity;
  entity_id: string;
  op: OutboxOp;
  /** JSON-Text. Beim Lesen ueber `parseOutboxEntry` in ein Objekt verwandelt. */
  payload: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
  next_attempt_at: number;
};

/**
 * Die Sync-Spalten einer lokalen Zeile.
 *
 * `updated_at`/`deleted_at` sind epoch ms, nicht ISO-Text: Ein Stringvergleich
 * von PostgREST-Zeitstempeln ist unsicher (`+00:00` gegen `Z`, drei gegen sechs
 * Nachkommastellen), und die Ordnung muss numerisch sein.
 */
export type MirrorMeta = {
  id: string;
  updated_at: number;
  deleted_at: number | null;
  _dirty: number;
};
