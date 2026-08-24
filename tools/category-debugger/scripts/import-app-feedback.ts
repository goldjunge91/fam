import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizePreferenceName } from '../../../src/features/shopping-list/preferences/normalize-preference-name';
import type { Database as AppDatabase, Tables as AppTables } from '../../../src/lib/database.types';
import type { Database as EvaluationDatabase, Json as EvaluationJson } from '../src/database.types';

const IMPORT_SOURCE = 'app_feedback' as const;
const DESTINATION_SOURCE = 'alpha_app' as const;
const DESTINATION_EVENT_TYPE = 'product_moved' as const;
const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 1000;

const SOURCE_FEEDBACK_SELECT = [
  'event_id',
  'schema_version',
  'taxonomy_version',
  'event_type',
  'input_method',
  'household_id',
  'actor_user_id',
  'shopping_list_item_id',
  'product_key_type',
  'product_key',
  'product_id',
  'barcode',
  'product_name',
  'store_id',
  'preference_scope',
  'old_placement_zone',
  'new_placement_zone',
  'predicted_placement_zone',
  'old_category_source',
  'new_category_source',
  'predicted_product_family',
  'predicted_product_form',
  'classifier_version',
  'platform',
  'app_version',
  'build_channel',
  'client_created_at',
  'created_at',
].join(',');

export type AppFeedbackEvent = Pick<
  AppTables<'shopping_category_feedback_events'>,
  | 'event_id'
  | 'schema_version'
  | 'taxonomy_version'
  | 'event_type'
  | 'input_method'
  | 'household_id'
  | 'actor_user_id'
  | 'shopping_list_item_id'
  | 'product_key_type'
  | 'product_key'
  | 'product_id'
  | 'barcode'
  | 'product_name'
  | 'store_id'
  | 'preference_scope'
  | 'old_placement_zone'
  | 'new_placement_zone'
  | 'predicted_placement_zone'
  | 'old_category_source'
  | 'new_category_source'
  | 'predicted_product_family'
  | 'predicted_product_form'
  | 'classifier_version'
  | 'platform'
  | 'app_version'
  | 'build_channel'
  | 'client_created_at'
  | 'created_at'
>;

export type ImportCursor = {
  createdAt: string;
  eventId: string;
};

export type ImportPage = {
  events: readonly AppFeedbackEvent[];
};

export type AppFeedbackReader = {
  readPage(cursor: ImportCursor | null, pageSize: number): Promise<ImportPage>;
};

export type EvaluationCrowdSignalInsert = {
  event_id: string;
  schema_version: number;
  source: string;
  event_type: string;
  occurred_at: string;
  actor_key: string;
  household_key: string;
  store_key: string | null;
  product_key: string;
  barcode: string | null;
  product_name: string;
  from_zone_id: string | null;
  to_zone_id: string;
  classifier_version: string;
  payload_sha256: string;
  raw_payload: EvaluationJson;
};

export type ImportWriteResult = {
  imported: number;
  duplicates: number;
};

export type EvaluationImportStore = {
  getResumeCursor(): Promise<ImportCursor | null>;
  startRun(input: {
    runId: string;
    startedAt: string;
    cursor: ImportCursor | null;
  }): Promise<void>;
  writeSignals(signals: readonly EvaluationCrowdSignalInsert[]): Promise<ImportWriteResult>;
  advanceRun(input: {
    runId: string;
    cursor: ImportCursor;
    pages: number;
    eventsRead: number;
    eventsImported: number;
    eventsDuplicate: number;
  }): Promise<void>;
  completeRun(input: {
    runId: string;
    finishedAt: string;
    cursor: ImportCursor | null;
    pages: number;
    eventsRead: number;
    eventsImported: number;
    eventsDuplicate: number;
  }): Promise<void>;
  failRun(input: {
    runId: string;
    failedAt: string;
    cursor: ImportCursor | null;
    pages: number;
    eventsRead: number;
    eventsImported: number;
    eventsDuplicate: number;
    errorMessage: string;
  }): Promise<void>;
};

export type ImportSummary = {
  runId: string;
  status: 'completed';
  initialCursor: ImportCursor | null;
  finalCursor: ImportCursor | null;
  pages: number;
  eventsRead: number;
  eventsImported: number;
  eventsDuplicate: number;
};

export type Pseudonymize = (namespace: string, value: string) => string;

export type ImportConfig = {
  appSupabaseUrl: string;
  appSupabaseSecretKey: string;
  evaluationSupabaseUrl: string;
  evaluationSupabaseSecretKey: string;
  pseudonymKey: string;
  pageSize: number;
};

type SanitizedFeedbackPayload = {
  event_id: string;
  schema_version: number;
  taxonomy_version: string;
  event_type: AppFeedbackEvent['event_type'];
  input_method: AppFeedbackEvent['input_method'];
  actor_key: string;
  household_key: string;
  store_key: string | null;
  product_key_type: AppFeedbackEvent['product_key_type'];
  product_key: string;
  barcode: string | null;
  product_name: string;
  preference_scope: AppFeedbackEvent['preference_scope'];
  old_placement_zone: string;
  new_placement_zone: string;
  predicted_placement_zone: string;
  old_category_source: string;
  new_category_source: string;
  predicted_product_family: string;
  predicted_product_form: string;
  classifier_version: string;
  platform: string;
  app_version: string;
  build_channel: string;
  client_created_at: string;
  source_created_at: string;
};

type EvaluationImportRunStatus = 'running' | 'completed' | 'failed';

type EvaluationImportRunRow = {
  run_id: string;
  source: string;
  status: EvaluationImportRunStatus;
  started_at: string;
  finished_at: string | null;
  cursor_created_at: string | null;
  cursor_event_id: string | null;
  pages: number;
  events_read: number;
  events_imported: number;
  events_duplicate: number;
  error_message: string | null;
};

type EvaluationImportRunInsert = Omit<EvaluationImportRunRow, never>;
type EvaluationImportRunUpdate = Partial<
  Pick<
    EvaluationImportRunRow,
    | 'status'
    | 'finished_at'
    | 'cursor_created_at'
    | 'cursor_event_id'
    | 'pages'
    | 'events_read'
    | 'events_imported'
    | 'events_duplicate'
    | 'error_message'
  >
>;

type ImportRunDatabase = Omit<EvaluationDatabase, 'public'> & {
  public: Omit<EvaluationDatabase['public'], 'Tables'> & {
    Tables: EvaluationDatabase['public']['Tables'] & {
      evaluation_import_runs: {
        Row: EvaluationImportRunRow;
        Insert: EvaluationImportRunInsert;
        Update: EvaluationImportRunUpdate;
        Relationships: [];
      };
    };
  };
};

export class EvaluationImportSchemaError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EvaluationImportSchemaError';
  }
}

export function createPseudonymizer(secret: string): Pseudonymize {
  const key = secret.trim();
  if (!key) throw new Error('CATEGORY_FEEDBACK_PSEUDONYM_KEY fehlt.');

  return (namespace, value) => createHmac('sha256', key).update(`${namespace}\u0000${value}`).digest('hex');
}

export function loadImportConfig(
  environment: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv.slice(2),
): ImportConfig {
  const required = (name: string): string => {
    const value = environment[name]?.trim();
    if (!value) throw new Error(`${name} fehlt.`);
    return value;
  };

  const pageSizeArgument = argv.find((argument) => argument.startsWith('--page-size='));
  const pageSizeValue = pageSizeArgument?.slice('--page-size='.length) ?? environment.CATEGORY_FEEDBACK_IMPORT_PAGE_SIZE;
  const pageSize = pageSizeValue === undefined ? DEFAULT_PAGE_SIZE : Number.parseInt(pageSizeValue, 10);

  return {
    appSupabaseUrl: required('APP_SUPABASE_URL'),
    appSupabaseSecretKey: required('APP_SUPABASE_SECRET_KEY'),
    evaluationSupabaseUrl: required('EVALUATION_SUPABASE_URL'),
    evaluationSupabaseSecretKey: required('EVALUATION_SUPABASE_SECRET_KEY'),
    pseudonymKey: required('CATEGORY_FEEDBACK_PSEUDONYM_KEY'),
    pageSize: normalizePageSize(pageSize),
  };
}

export function normalizePageSize(pageSize: number): number {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new Error(`pageSize muss eine ganze Zahl zwischen 1 und ${MAX_PAGE_SIZE} sein.`);
  }
  return pageSize;
}

export function pseudonymizeIdentifier(
  pseudonymizer: Pseudonymize,
  namespace: string,
  value: string,
): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${namespace} darf nicht leer sein.`);
  return pseudonymizer(namespace, normalized);
}

function requiredText(value: string | null | undefined, field: string, maximum = 1000): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) throw new Error(`${field} fehlt.`);
  if (normalized.length > maximum) throw new Error(`${field} ist zu lang.`);
  return normalized;
}

function requiredTimestamp(value: string | null | undefined, field: string): string {
  const normalized = requiredText(value, field, 100);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} ist kein gültiger Zeitpunkt.`);
  return normalized;
}

function nullableBarcode(value: string | null): string | null {
  if (value === null || value.trim() === '') return null;
  const barcode = requiredText(value, 'barcode', 32);
  if (!/^\d{6,32}$/.test(barcode)) throw new Error('barcode ist ungültig.');
  return barcode;
}

function productIdentity(
  event: AppFeedbackEvent,
  pseudonymizer: Pseudonymize,
): { key: string; barcode: string | null } {
  const barcode = nullableBarcode(event.barcode);
  if (event.product_key_type === 'barcode') {
    if (barcode === null || event.product_key.trim() !== barcode) {
      throw new Error(`Feedback ${event.event_id} hat einen inkonsistenten Barcode-Produktschlüssel.`);
    }
    return { key: `barcode:${barcode}`, barcode };
  }

  if (event.product_key_type === 'product') {
    const productId = event.product_id?.trim() || event.product_key.trim();
    return {
      key: `product:${pseudonymizeIdentifier(pseudonymizer, 'product', productId)}`,
      barcode,
    };
  }

  if (event.product_key_type === 'name') {
    const nameKey = normalizePreferenceName(requiredText(event.product_name, 'product_name', 200));
    if (!nameKey || event.product_id !== null || barcode !== null) {
      throw new Error(`Feedback ${event.event_id} hat einen inkonsistenten Namens-Produktschlüssel.`);
    }
    return { key: `name:${nameKey}`, barcode: null };
  }

  throw new Error(`Feedback ${event.event_id} hat einen unbekannten product_key_type.`);
}

function sanitizedPayload(
  event: AppFeedbackEvent,
  actorKey: string,
  householdKey: string,
  storeKey: string | null,
  productKey: string,
  barcode: string | null,
): SanitizedFeedbackPayload {
  return {
    event_id: requiredText(event.event_id, 'event_id', 200),
    schema_version: event.schema_version,
    taxonomy_version: requiredText(event.taxonomy_version, 'taxonomy_version', 100),
    event_type: event.event_type,
    input_method: event.input_method,
    actor_key: actorKey,
    household_key: householdKey,
    store_key: storeKey,
    product_key_type: event.product_key_type,
    product_key: productKey,
    barcode,
    product_name: requiredText(event.product_name, 'product_name', 200),
    preference_scope: event.preference_scope,
    old_placement_zone: requiredText(event.old_placement_zone, 'old_placement_zone', 100),
    new_placement_zone: requiredText(event.new_placement_zone, 'new_placement_zone', 100),
    predicted_placement_zone: requiredText(event.predicted_placement_zone, 'predicted_placement_zone', 100),
    old_category_source: requiredText(event.old_category_source, 'old_category_source', 100),
    new_category_source: requiredText(event.new_category_source, 'new_category_source', 100),
    predicted_product_family: requiredText(event.predicted_product_family, 'predicted_product_family', 100),
    predicted_product_form: requiredText(event.predicted_product_form, 'predicted_product_form', 100),
    classifier_version: requiredText(event.classifier_version, 'classifier_version', 100),
    platform: requiredText(event.platform, 'platform', 20),
    app_version: requiredText(event.app_version, 'app_version', 100),
    build_channel: requiredText(event.build_channel, 'build_channel', 100),
    client_created_at: requiredTimestamp(event.client_created_at, 'client_created_at'),
    source_created_at: requiredTimestamp(event.created_at, 'created_at'),
  };
}

export function toEvaluationCrowdSignal(
  event: AppFeedbackEvent,
  pseudonymizer: Pseudonymize,
): EvaluationCrowdSignalInsert {
  const actorKey = pseudonymizeIdentifier(pseudonymizer, 'actor', event.actor_user_id);
  const householdKey = pseudonymizeIdentifier(pseudonymizer, 'household', event.household_id);
  const storeKey = event.store_id === null
    ? null
    : pseudonymizeIdentifier(pseudonymizer, 'store', event.store_id);
  const product = productIdentity(event, pseudonymizer);
  const productName = requiredText(event.product_name, 'product_name', 200);
  const payload = sanitizedPayload(event, actorKey, householdKey, storeKey, product.key, product.barcode);

  return {
    event_id: requiredText(event.event_id, 'event_id', 200),
    schema_version: 1,
    source: DESTINATION_SOURCE,
    event_type: DESTINATION_EVENT_TYPE,
    occurred_at: requiredTimestamp(event.client_created_at, 'client_created_at'),
    actor_key: actorKey,
    household_key: householdKey,
    store_key: storeKey,
    product_key: product.key,
    barcode: product.barcode,
    product_name: productName,
    from_zone_id: requiredText(event.old_placement_zone, 'old_placement_zone', 100),
    to_zone_id: requiredText(event.new_placement_zone, 'new_placement_zone', 100),
    classifier_version: requiredText(event.classifier_version, 'classifier_version', 100),
    payload_sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    raw_payload: payload as unknown as EvaluationJson,
  };
}

function cursorForEvent(event: AppFeedbackEvent): ImportCursor {
  return {
    createdAt: requiredTimestamp(event.created_at, 'created_at'),
    eventId: requiredText(event.event_id, 'event_id', 200),
  };
}

function cursorIsAfter(next: ImportCursor, previous: ImportCursor | null): boolean {
  if (previous === null) return true;
  const nextTime = Date.parse(next.createdAt);
  const previousTime = Date.parse(previous.createdAt);
  if (nextTime !== previousTime) return nextTime > previousTime;
  return next.eventId > previous.eventId;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim() || 'Unbekannter Importfehler';
}

function isMissingImportRunTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || /evaluation_import_runs/i.test(error.message ?? '');
}

function importRunSchemaError(operation: string, error: { message?: string } | null): EvaluationImportSchemaError {
  return new EvaluationImportSchemaError(
    `Evaluation-Schema fehlt: public.evaluation_import_runs (${operation}). `
      + 'Der Import wurde nicht unprotokolliert fortgesetzt. Erwartet wird der im Category-Lab-README dokumentierte Run-Log-Vertrag.'
      + (error?.message ? ` Ursache: ${error.message}` : ''),
    { cause: error },
  );
}

export async function runImport(input: {
  reader: AppFeedbackReader;
  store: EvaluationImportStore;
  pseudonymizer: Pseudonymize;
  pageSize?: number;
  now?: () => string;
  createRunId?: () => string;
  log?: (message: string) => void;
}): Promise<ImportSummary> {
  const pageSize = normalizePageSize(input.pageSize ?? DEFAULT_PAGE_SIZE);
  const now = input.now ?? (() => new Date().toISOString());
  const createRunId = input.createRunId ?? randomUUID;
  const log = input.log ?? (() => undefined);
  const initialCursor = await input.store.getResumeCursor();
  const runId = createRunId();
  await input.store.startRun({ runId, startedAt: now(), cursor: initialCursor });

  let cursor = initialCursor;
  let pages = 0;
  let eventsRead = 0;
  let eventsImported = 0;
  let eventsDuplicate = 0;

  try {
    while (true) {
      const page = await input.reader.readPage(cursor, pageSize);
      if (page.events.length === 0) break;

      const pageCursor = cursorForEvent(page.events[page.events.length - 1]!);
      if (!cursorIsAfter(pageCursor, cursor)) {
        throw new Error(`Feedback-Cursor macht keinen Fortschritt bei ${pageCursor.eventId}.`);
      }

      const signals = page.events.map((event) => toEvaluationCrowdSignal(event, input.pseudonymizer));
      const writeResult = await input.store.writeSignals(signals);
      const nextPages = pages + 1;
      const nextEventsRead = eventsRead + page.events.length;
      const nextEventsImported = eventsImported + writeResult.imported;
      const nextEventsDuplicate = eventsDuplicate + writeResult.duplicates;

      await input.store.advanceRun({
        runId,
        cursor: pageCursor,
        pages: nextPages,
        eventsRead: nextEventsRead,
        eventsImported: nextEventsImported,
        eventsDuplicate: nextEventsDuplicate,
      });

      cursor = pageCursor;
      pages = nextPages;
      eventsRead = nextEventsRead;
      eventsImported = nextEventsImported;
      eventsDuplicate = nextEventsDuplicate;
      log(`Importseite ${pages}: ${page.events.length} gelesen, ${writeResult.imported} neu, ${writeResult.duplicates} bereits vorhanden.`);
    }

    await input.store.completeRun({
      runId,
      finishedAt: now(),
      cursor,
      pages,
      eventsRead,
      eventsImported,
      eventsDuplicate,
    });

    return {
      runId,
      status: 'completed',
      initialCursor,
      finalCursor: cursor,
      pages,
      eventsRead,
      eventsImported,
      eventsDuplicate,
    };
  } catch (error) {
    try {
      await input.store.failRun({
        runId,
        failedAt: now(),
        cursor,
        pages,
        eventsRead,
        eventsImported,
        eventsDuplicate,
        errorMessage: errorMessage(error),
      });
    } catch (loggingError) {
      log(`Run-Fehler konnte nicht protokolliert werden: ${errorMessage(loggingError)}`);
    }
    throw error;
  }
}

export function createSupabaseAppFeedbackReader(
  client: SupabaseClient<AppDatabase>,
): AppFeedbackReader {
  return {
    async readPage(cursor, pageSize) {
      let query = client
        .from('shopping_category_feedback_events')
        .select(SOURCE_FEEDBACK_SELECT);

      if (cursor !== null) {
        query = query.or(
          `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},event_id.gt.${cursor.eventId})`,
        );
      }

      const { data, error } = await query
        .order('created_at', { ascending: true })
        .order('event_id', { ascending: true })
        .range(0, pageSize - 1)
        .overrideTypes<AppFeedbackEvent[], { merge: false }>();
      if (error) throw error;
      return { events: data ?? [] };
    },
  };
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

async function insertSignals(
  client: SupabaseClient<ImportRunDatabase>,
  rows: readonly EvaluationCrowdSignalInsert[],
): Promise<ImportWriteResult> {
  if (rows.length === 0) return { imported: 0, duplicates: 0 };

  const eventIds = rows.map((row) => row.event_id);
  const { data: existingRows, error: existingError } = await client
    .from('evaluation_crowd_signals')
    .select('event_id')
    .in('event_id', eventIds)
    .overrideTypes<Array<{ event_id: string }>, { merge: false }>();
  if (existingError) throw existingError;

  const existing = new Set((existingRows ?? []).map((row) => row.event_id));
  const freshRows = rows.filter((row) => !existing.has(row.event_id));
  let duplicates = rows.length - freshRows.length;
  if (freshRows.length === 0) return { imported: 0, duplicates };

  const { error: batchError } = await client.from('evaluation_crowd_signals').insert(freshRows);
  if (!batchError) return { imported: freshRows.length, duplicates };
  if (!isUniqueViolation(batchError)) throw batchError;

  let imported = 0;
  for (const row of freshRows) {
    const { error } = await client.from('evaluation_crowd_signals').insert(row);
    if (!error) {
      imported += 1;
    } else if (isUniqueViolation(error)) {
      duplicates += 1;
    } else {
      throw error;
    }
  }
  return { imported, duplicates };
}

export function createSupabaseEvaluationImportStore(
  client: SupabaseClient<ImportRunDatabase>,
): EvaluationImportStore {
  const runLogError = (operation: string, error: { code?: string; message?: string } | null): Error => {
    if (isMissingImportRunTable(error)) return importRunSchemaError(operation, error);
    return new Error(error?.message ?? operation, { cause: error });
  };

  return {
    async getResumeCursor() {
      const { data, error } = await client
        .from('evaluation_import_runs')
        .select('cursor_created_at,cursor_event_id')
        .eq('source', IMPORT_SOURCE)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .overrideTypes<Pick<EvaluationImportRunRow, 'cursor_created_at' | 'cursor_event_id'> | null, { merge: false }>();
      if (error) throw runLogError('Resume-Cursor lesen', error);
      if (data === null || data.cursor_created_at === null || data.cursor_event_id === null) return null;
      return { createdAt: data.cursor_created_at, eventId: data.cursor_event_id };
    },

    async startRun({ runId, startedAt, cursor }) {
      const row: EvaluationImportRunInsert = {
        run_id: runId,
        source: IMPORT_SOURCE,
        status: 'running',
        started_at: startedAt,
        finished_at: null,
        cursor_created_at: cursor?.createdAt ?? null,
        cursor_event_id: cursor?.eventId ?? null,
        pages: 0,
        events_read: 0,
        events_imported: 0,
        events_duplicate: 0,
        error_message: null,
      };
      const { error } = await client.from('evaluation_import_runs').insert(row);
      if (error) throw runLogError('Run starten', error);
    },

    async writeSignals(signals) {
      return insertSignals(client, signals);
    },

    async advanceRun({ runId, cursor, pages, eventsRead, eventsImported, eventsDuplicate }) {
      const update: EvaluationImportRunUpdate = {
        cursor_created_at: cursor.createdAt,
        cursor_event_id: cursor.eventId,
        pages,
        events_read: eventsRead,
        events_imported: eventsImported,
        events_duplicate: eventsDuplicate,
      };
      const { error } = await client
        .from('evaluation_import_runs')
        .update(update)
        .eq('run_id', runId);
      if (error) throw runLogError('Cursor speichern', error);
    },

    async completeRun({ runId, finishedAt, cursor, pages, eventsRead, eventsImported, eventsDuplicate }) {
      const update: EvaluationImportRunUpdate = {
        status: 'completed',
        finished_at: finishedAt,
        cursor_created_at: cursor?.createdAt ?? null,
        cursor_event_id: cursor?.eventId ?? null,
        pages,
        events_read: eventsRead,
        events_imported: eventsImported,
        events_duplicate: eventsDuplicate,
        error_message: null,
      };
      const { error } = await client
        .from('evaluation_import_runs')
        .update(update)
        .eq('run_id', runId);
      if (error) throw runLogError('Run abschließen', error);
    },

    async failRun({ runId, failedAt, cursor, pages, eventsRead, eventsImported, eventsDuplicate, errorMessage }) {
      const update: EvaluationImportRunUpdate = {
        status: 'failed',
        finished_at: failedAt,
        cursor_created_at: cursor?.createdAt ?? null,
        cursor_event_id: cursor?.eventId ?? null,
        pages,
        events_read: eventsRead,
        events_imported: eventsImported,
        events_duplicate: eventsDuplicate,
        error_message: errorMessage.slice(0, 4000),
      };
      const { error } = await client
        .from('evaluation_import_runs')
        .update(update)
        .eq('run_id', runId);
      if (error) throw runLogError('Run fehlschlagen markieren', error);
    },
  };
}

function clientsFromConfig(config: ImportConfig): {
  app: SupabaseClient<AppDatabase>;
  evaluation: SupabaseClient<ImportRunDatabase>;
} {
  return {
    app: createClient<AppDatabase>(config.appSupabaseUrl, config.appSupabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
    evaluation: createClient<ImportRunDatabase>(config.evaluationSupabaseUrl, config.evaluationSupabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
}

export async function main(): Promise<void> {
  const config = loadImportConfig();
  const clients = clientsFromConfig(config);
  const result = await runImport({
    reader: createSupabaseAppFeedbackReader(clients.app),
    store: createSupabaseEvaluationImportStore(clients.evaluation),
    pseudonymizer: createPseudonymizer(config.pseudonymKey),
    pageSize: config.pageSize,
  });
  console.info(JSON.stringify(result));
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
