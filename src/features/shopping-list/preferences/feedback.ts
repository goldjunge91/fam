import { type EnqueueMutationInput, enqueueMutation } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { normalizePreferenceName } from './normalize-preference-name';

export const CATEGORY_FEEDBACK_SCHEMA_VERSION = 1 as const;
export const CATEGORY_FEEDBACK_TAXONOMY_VERSION = 'placement-taxonomy-v2' as const;

export type CategoryFeedbackEventType = 'manual_reassign' | 'reset_to_automatic';
export type CategoryFeedbackInputMethod = 'add_form' | 'edit_form';
export type CategoryFeedbackPlatform = 'ios' | 'android' | 'web';
export type CategoryFeedbackPreferenceScope = 'store' | 'household';
export type CategoryFeedbackProductKeyType = 'product' | 'barcode' | 'name';

export type CategoryFeedbackInput = {
  eventId: string;
  eventType: CategoryFeedbackEventType;
  inputMethod: CategoryFeedbackInputMethod;
  householdId: string;
  actorUserId: string;
  shoppingListItemId: string;
  productId?: string | null;
  barcode?: string | null;
  productName: string;
  storeId?: string | null;
  preferenceScope: CategoryFeedbackPreferenceScope;
  oldPlacementZone: string;
  newPlacementZone: string;
  predictedPlacementZone: string;
  oldCategorySource: string;
  newCategorySource: string;
  predictedProductFamily: string;
  predictedProductForm: string;
  classifierVersion: string;
  platform: CategoryFeedbackPlatform;
  appVersion: string;
  buildChannel: string;
  clientCreatedAt: string;
};

export type CategoryFeedbackDraft = Omit<CategoryFeedbackInput, 'shoppingListItemId'>;

export type CategoryFeedbackPayload = {
  event_id: string;
  schema_version: typeof CATEGORY_FEEDBACK_SCHEMA_VERSION;
  taxonomy_version: typeof CATEGORY_FEEDBACK_TAXONOMY_VERSION;
  event_type: CategoryFeedbackEventType;
  input_method: CategoryFeedbackInputMethod;
  household_id: string;
  actor_user_id: string;
  shopping_list_item_id: string;
  product_key_type: CategoryFeedbackProductKeyType;
  product_key: string;
  product_id: string | null;
  barcode: string | null;
  product_name: string;
  store_id: string | null;
  preference_scope: CategoryFeedbackPreferenceScope;
  old_placement_zone: string;
  new_placement_zone: string;
  predicted_placement_zone: string;
  old_category_source: string;
  new_category_source: string;
  predicted_product_family: string;
  predicted_product_form: string;
  classifier_version: string;
  platform: CategoryFeedbackPlatform;
  app_version: string;
  build_channel: string;
  client_created_at: string;
};

function requiredText(value: string, field: string, maxLength?: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || (maxLength !== undefined && normalized.length > maxLength)) {
    throw new Error(
      `${field} muss gesetzt sein${maxLength ? ` und höchstens ${maxLength} Zeichen haben` : ''}`,
    );
  }
  return normalized;
}

function productKeyOf(
  input: CategoryFeedbackInput,
  productName: string,
): {
  type: CategoryFeedbackProductKeyType;
  value: string;
  barcode: string | null;
} {
  const normalizedBarcode = input.barcode?.trim() || null;
  if (normalizedBarcode !== null) {
    const barcode = requiredText(normalizedBarcode, 'barcode');
    if (!/^\d{6,32}$/.test(barcode)) {
      throw new Error('barcode muss aus 6 bis 32 Ziffern bestehen');
    }
    return { type: 'barcode', value: barcode, barcode };
  }

  if (input.productId !== undefined && input.productId !== null) {
    const productId = requiredText(input.productId, 'productId');
    return { type: 'product', value: productId, barcode: null };
  }

  const name = normalizePreferenceName(productName);
  if (!name) throw new Error('productName muss einen nicht-leeren Namen ergeben');
  return { type: 'name', value: name, barcode: null };
}

/** Baut den stabilen, snake_case Payload-Vertrag fuer die Haupt-Supabase. */
export function buildCategoryFeedbackPayload(
  input: CategoryFeedbackInput,
): CategoryFeedbackPayload {
  const eventId = requiredText(input.eventId, 'eventId');
  const productName = requiredText(input.productName, 'productName', 200);
  const householdId = requiredText(input.householdId, 'householdId');
  const storeId =
    input.storeId === undefined || input.storeId === null
      ? null
      : requiredText(input.storeId, 'storeId');

  if (input.preferenceScope === 'store' && storeId === null) {
    throw new Error('Eine Store-Präferenz benötigt storeId');
  }
  if (input.preferenceScope === 'household' && storeId !== null) {
    throw new Error('Eine Haushaltspräferenz darf keine storeId enthalten');
  }
  if (input.eventType === 'manual_reassign' && input.oldPlacementZone === input.newPlacementZone) {
    throw new Error('manual_reassign benötigt unterschiedliche alte und neue Bereiche');
  }

  const productKey = productKeyOf(input, productName);

  return {
    event_id: eventId,
    schema_version: CATEGORY_FEEDBACK_SCHEMA_VERSION,
    taxonomy_version: CATEGORY_FEEDBACK_TAXONOMY_VERSION,
    event_type: input.eventType,
    input_method: input.inputMethod,
    household_id: householdId,
    actor_user_id: requiredText(input.actorUserId, 'actorUserId'),
    shopping_list_item_id: requiredText(input.shoppingListItemId, 'shoppingListItemId'),
    product_key_type: productKey.type,
    product_key: productKey.value,
    product_id: input.productId ? input.productId.trim() : null,
    barcode: productKey.barcode,
    product_name: productName,
    store_id: storeId,
    preference_scope: input.preferenceScope,
    old_placement_zone: requiredText(input.oldPlacementZone, 'oldPlacementZone'),
    new_placement_zone: requiredText(input.newPlacementZone, 'newPlacementZone'),
    predicted_placement_zone: requiredText(input.predictedPlacementZone, 'predictedPlacementZone'),
    old_category_source: requiredText(input.oldCategorySource, 'oldCategorySource'),
    new_category_source: requiredText(input.newCategorySource, 'newCategorySource'),
    predicted_product_family: requiredText(input.predictedProductFamily, 'predictedProductFamily'),
    predicted_product_form: requiredText(input.predictedProductForm, 'predictedProductForm'),
    classifier_version: requiredText(input.classifierVersion, 'classifierVersion'),
    platform: input.platform,
    app_version: requiredText(input.appVersion, 'appVersion'),
    build_channel: requiredText(input.buildChannel, 'buildChannel'),
    client_created_at: requiredText(input.clientCreatedAt, 'clientCreatedAt'),
  };
}

/** Erzeugt die lokale push-only Mutation, ohne Netzwerk oder UI-Abhängigkeit. */
export function categoryFeedbackMutation(
  input: CategoryFeedbackInput,
  now = Date.now(),
): EnqueueMutationInput {
  const payload = buildCategoryFeedbackPayload(input);
  return {
    entity: 'shopping_category_feedback_events',
    entityId: payload.event_id,
    op: 'insert',
    payload: { ...payload },
    now,
    applyLocally: async (txn) => {
      const columns = [
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
      ] as const;
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map((column) => payload[column]);
      await txn.runAsync(
        `insert into shopping_category_feedback_events (${columns.join(', ')}, _dirty, synced_at)
         values (${placeholders}, 1, null)`,
        values,
      );
    },
  };
}

export async function enqueueCategoryFeedbackEvent(
  db: SqlDatabase,
  input: CategoryFeedbackInput,
): Promise<void> {
  await enqueueMutation(db, categoryFeedbackMutation(input));
}

export const DEFAULT_FEEDBACK_PRUNE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage

/**
 * Prunt lokale shopping_category_feedback_events, die erfolgreich synchronisiert
 * wurden (_dirty = 0, synced_at vorhanden) und aelter als maxAgeMs sind.
 */
export async function pruneOldSyncedFeedbackEvents(
  db: SqlDatabase,
  options?: { maxAgeMs?: number; nowMs?: number },
): Promise<number> {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_FEEDBACK_PRUNE_MAX_AGE_MS;
  const nowMs = options?.nowMs ?? Date.now();
  const threshold = nowMs - maxAgeMs;

  const result = await db.runAsync(
    'delete from shopping_category_feedback_events where _dirty = 0 and synced_at is not null and synced_at <= ?',
    [threshold],
  );
  return result.changes ?? 0;
}
