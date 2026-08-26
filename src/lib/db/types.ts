/** Was SQLite als Parameter binden kann. Kein `any`, keine Objekte. */
export type SqlParam = string | number | null;

export type SqlRunResult = {
  /** Bei `insert` in eine AUTOINCREMENT-Tabelle die vergebene rowid. */
  lastInsertRowId: number;
  changes: number;
};

export type SqlDatabase = {
  /** Mehrere Statements am Stueck, ohne Parameter. Fuer DDL und PRAGMA. */
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: readonly SqlParam[]): Promise<SqlRunResult>;
  getAllAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T | null>;

  getAllRawAsync?(source: string, params?: readonly SqlParam[]): Promise<SqlParam[][]>;

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
  | 'shopping_category_preferences'
  | 'shopping_category_feedback_events'
  | 'products'
  | 'households'
  | 'recipes'
  | 'recipe_components'
  | 'recipe_component_items'
  | 'recipe_steps'
  | 'recipe_step_ingredients'
  | 'meal_plans'
  | 'meal_plan_entries'
  | 'favorite_brochure_stores';

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

export type MirrorMeta = {
  id: string;
  updated_at: number;
  deleted_at: number | null;
  _dirty: number;
};
