/** Gemeinsamer Port fuer `expo-sqlite` und `node:sqlite`; nur positionelle Parameter nutzen. */
export type SqlParam = string | number | null;

export type SqlRunResult = {
  lastInsertRowId: number;
  changes: number;
};

export type SqlDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: readonly SqlParam[]): Promise<SqlRunResult>;
  getAllAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T | null>;
  /** Innerhalb des Callbacks muessen alle Statements ueber `txn` laufen. */
  withExclusiveTransactionAsync(task: (txn: SqlDatabase) => Promise<void>): Promise<void>;
};

export type Migration = {
  version: number;
  name: string;
  statements: readonly string[];
};

/** Private Tracking-Tabellen gehoeren nicht zum Haushaltsspiegel. */
export type Entity =
  | 'storage_locations'
  | 'stores'
  | 'fridge_items'
  | 'shopping_list_items'
  | 'shopping_category_preferences'
  | 'products'
  | 'households'
  | 'recipes'
  | 'recipe_components'
  | 'recipe_component_items'
  | 'recipe_steps'
  | 'recipe_step_ingredients'
  | 'meal_plans'
  | 'meal_plan_entries';

/** `restore` ist separat, weil normale Updates `deleted_at` nicht pushen. */
export type OutboxOp = 'insert' | 'update' | 'delete' | 'restore';

export type OutboxEntry = {
  id: number;
  entity: Entity;
  entity_id: string;
  op: OutboxOp;
  payload: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
  next_attempt_at: number;
};

/** Zeitstempel sind fuer eine verlaessliche Sortierung Epoch-Millisekunden. */
export type MirrorMeta = {
  id: string;
  updated_at: number;
  deleted_at: number | null;
  _dirty: number;
};
