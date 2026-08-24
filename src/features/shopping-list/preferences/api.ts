import { getDatabase } from '@/lib/db/client';
import { type EnqueueMutationInput, enqueueMutations } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { parseCategoryTagsJson } from '@/lib/open-food-facts';
import { normalizePlacementZoneIdNullable } from '../classification/placement-taxonomy';
import type { ShoppingCategoryId } from '../classification/shopping-category-id';
import type { PlacementClassificationInput } from '../classification/types';
import { normalizePreferenceName } from './normalize-preference-name';
import { preferenceId } from './preference-identity.expo';
import { type ResolvedPlacementClassification, resolveCategory } from './resolve-category';

export type CategoryPreferenceKeyType = 'product' | 'name';

/** Lokal gespiegelte Zeile aus `shopping_category_preferences` (aktiv, nicht geloescht). */
export type CategoryPreference = {
  id: string;
  household_id: string;
  store_id: string | null;
  key_type: CategoryPreferenceKeyType;
  normalized_key_value: string;
  category_id: ShoppingCategoryId | null;
  created_by: string | null;
  created_at: string | null;
};

type LocalPreferenceRow = CategoryPreference & { deleted_at: number | null };

const SELECT_COLUMNS =
  'id, household_id, store_id, key_type, normalized_key_value, category_id, created_by, created_at, deleted_at';

function toPublicRow(row: LocalPreferenceRow): CategoryPreference {
  const { deleted_at: _deleted_at, ...rest } = row;
  return rest;
}

/** Aktive (nicht geloeschte) Produkt-Praeferenz einer `product_id`, falls vorhanden. */
export async function findProductPreference(
  householdId: string,
  productId: string,
  storeId?: string | null,
): Promise<CategoryPreference | null> {
  const db = await getDatabase();
  const scope = storeId === undefined || storeId === null ? 'store_id is null' : 'store_id = ?';
  const params =
    storeId === undefined || storeId === null
      ? [householdId, productId.toLowerCase()]
      : [householdId, storeId, productId.toLowerCase()];
  const row = await db.getFirstAsync<LocalPreferenceRow>(
    `select ${SELECT_COLUMNS} from shopping_category_preferences
     where household_id = ? and ${scope} and key_type = 'product' and normalized_key_value = ? and deleted_at is null`,
    params,
  );
  return row ? toPublicRow(row) : null;
}

/** Aktive (nicht geloeschte) Namens-Praeferenz eines Freitextnamens, falls vorhanden. */
export async function findNamePreference(
  householdId: string,
  name: string,
  storeId?: string | null,
): Promise<CategoryPreference | null> {
  const normalized = normalizePreferenceName(name);
  if (!normalized) return null;

  const db = await getDatabase();
  const scope = storeId === undefined || storeId === null ? 'store_id is null' : 'store_id = ?';
  const params =
    storeId === undefined || storeId === null
      ? [householdId, normalized]
      : [householdId, storeId, normalized];
  const row = await db.getFirstAsync<LocalPreferenceRow>(
    `select ${SELECT_COLUMNS} from shopping_category_preferences
     where household_id = ? and ${scope} and key_type = 'name' and normalized_key_value = ? and deleted_at is null`,
    params,
  );
  return row ? toPublicRow(row) : null;
}

export type ResolveCategoryForItemInput = PlacementClassificationInput & {
  householdId: string;
  /** Der Markt des aktuellen Einkaufslisteneintrags, falls gewählt. */
  storeId?: string | null;
  /** `product_id` des aktuell gewaehlten Produkts, falls per Barcode/Suche hinzugefuegt. */
  productId?: string | null;
};

export type ResolvePlacementForItemOptions = {
  /** Preview/save helper for "Automatisch": ignore only the preference being reset. */
  omitPreferenceScope?: 'household' | 'store' | null;
};

type LocalProductSignals = {
  barcode: string | null;
  off_category_tags: string | null;
};

/**
 * Laedt die lokal bekannten Praeferenzen fuer `householdId`/`productId`/`name`
 * und delegiert die eigentliche Auflösung an das reine `resolveCategory()`.
 * Der Punkt, an dem `preferences/` und `classification/` zusammenlaufen
 * (Schritte 1–6 der Auflösungsreihenfolge, siehe `resolve-category.ts`).
 */
export async function resolvePlacementForItem(
  input: ResolveCategoryForItemInput,
  options: ResolvePlacementForItemOptions = {},
): Promise<ResolvedPlacementClassification & { barcode: string | null }> {
  const db = await getDatabase();
  const productSignals = input.productId
    ? await db.getFirstAsync<LocalProductSignals>(
        'select barcode, off_category_tags from products where id = ?',
        [input.productId],
      )
    : null;
  const categoryTags =
    input.categoryTags && input.categoryTags.length > 0
      ? input.categoryTags
      : parseCategoryTagsJson(productSignals?.off_category_tags);

  const productPreference =
    options.omitPreferenceScope !== 'household' && input.productId
      ? await findProductPreference(input.householdId, input.productId)
      : null;
  const namePreference =
    options.omitPreferenceScope === 'household' || productPreference
      ? null
      : await findNamePreference(input.householdId, input.name);

  const hasStoreScope = input.storeId !== undefined && input.storeId !== null;
  const storeProductPreference =
    options.omitPreferenceScope !== 'store' && hasStoreScope && input.productId
      ? await findProductPreference(input.householdId, input.productId, input.storeId)
      : null;
  const storeNamePreference =
    options.omitPreferenceScope !== 'store' && hasStoreScope && !storeProductPreference
      ? await findNamePreference(input.householdId, input.name, input.storeId)
      : null;

  const resolved = resolveCategory({
    name: input.name,
    categoryTags,
    source: input.source,
    dataVersion: input.dataVersion,
    productFamilyId: input.productFamilyId,
    productFormId: input.productFormId,
    productPreference: productPreference ? { categoryId: productPreference.category_id } : null,
    namePreference: namePreference ? { categoryId: namePreference.category_id } : null,
    storePreference: storeProductPreference
      ? { categoryId: storeProductPreference.category_id }
      : storeNamePreference
        ? { categoryId: storeNamePreference.category_id }
        : null,
  });
  return { ...resolved, barcode: productSignals?.barcode?.trim() || null };
}

/** Compatibility name for non-form callers during the V2 cutover. */
export const resolveCategoryForItem = resolvePlacementForItem;

export type SetCategoryPreferenceInput = {
  householdId: string;
  storeId?: string | null;
  keyType: CategoryPreferenceKeyType;
  /** Roh: Produkt-Id oder Freitextname — wird hier kanonisiert. */
  keyValue: string;
  /** `null` ist eine bewusste "Sonstiges"-Entscheidung. */
  categoryId: ShoppingCategoryId | null;
  createdBy: string | null;
};

function canonicalKeyValueOf(
  input: Pick<SetCategoryPreferenceInput, 'keyType' | 'keyValue'>,
): string {
  return input.keyType === 'product'
    ? input.keyValue.toLowerCase()
    : normalizePreferenceName(input.keyValue);
}

export type ResetCategoryPreferenceInput = {
  householdId: string;
  storeId?: string | null;
  keyType: CategoryPreferenceKeyType;
  keyValue: string;
};

export type CategoryPreferenceMutation =
  | { type: 'set'; input: SetCategoryPreferenceInput }
  | { type: 'reset'; input: ResetCategoryPreferenceInput };

export type CategoryPreferenceMutationPlan = {
  id: string;
  changed: boolean;
  mutations: readonly EnqueueMutationInput[];
};

type PreferenceKeyInput = Pick<SetCategoryPreferenceInput, 'keyType' | 'keyValue'>;

/**
 * Baut die lokalen Preference-Mutationen, schreibt aber noch nichts.
 *
 * Der Plan ist der gemeinsame Baustein fuer die Einzel-API und fuer den
 * atomaren Formular-Save. Dadurch bleiben `restore` + `update` ebenso wie ein
 * Reset in derselben exklusiven Transaktion wie die Artikelmutation.
 */
export async function buildCategoryPreferenceMutationPlan(
  db: SqlDatabase,
  action: CategoryPreferenceMutation,
  nowMs = Date.now(),
): Promise<CategoryPreferenceMutationPlan> {
  const keyInput = action.input;
  const normalizedKeyValue = canonicalKeyValueOf(keyInput as PreferenceKeyInput);
  const id = await preferenceId({
    householdId: keyInput.householdId,
    storeId: keyInput.storeId,
    keyType: keyInput.keyType,
    normalizedKeyValue,
  });

  if (action.type === 'reset') {
    const input = action.input;
    const storeId = input.storeId ?? null;
    const existing = await db.getFirstAsync<{ deleted_at: number | null }>(
      'select deleted_at from shopping_category_preferences where id = ?',
      [id],
    );
    if (!existing || existing.deleted_at !== null) {
      return { id, changed: false, mutations: [] };
    }

    const now = new Date(nowMs).toISOString();
    return {
      id,
      changed: true,
      mutations: [
        {
          entity: 'shopping_category_preferences',
          entityId: id,
          op: 'delete',
          payload: {
            id,
            household_id: input.householdId,
            store_id: storeId,
            deleted_at: now,
            updated_at: now,
          },
          now: nowMs,
          applyLocally: async (txn) => {
            await txn.runAsync(
              'update shopping_category_preferences set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
              [nowMs, nowMs, id],
            );
          },
        },
      ],
    };
  }

  const input = action.input;
  const storeId = input.storeId ?? null;
  const categoryId = normalizePlacementZoneIdNullable(input.categoryId);
  const now = new Date(nowMs).toISOString();
  const existing = await db.getFirstAsync<{ id: string; deleted_at: number | null }>(
    'select id, deleted_at from shopping_category_preferences where id = ?',
    [id],
  );

  if (!existing) {
    return {
      id,
      changed: true,
      mutations: [
        {
          entity: 'shopping_category_preferences',
          entityId: id,
          op: 'insert',
          payload: {
            id,
            household_id: input.householdId,
            store_id: storeId,
            key_type: input.keyType,
            normalized_key_value: normalizedKeyValue,
            category_id: categoryId,
            created_by: input.createdBy,
            created_at: now,
            updated_at: now,
          },
          now: nowMs,
          applyLocally: async (txn) => {
            await txn.runAsync(
              `insert into shopping_category_preferences
                 (id, household_id, store_id, key_type, normalized_key_value, category_id, created_by, created_at, updated_at, _dirty)
               values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                id,
                input.householdId,
                storeId,
                input.keyType,
                normalizedKeyValue,
                categoryId,
                input.createdBy,
                now,
                nowMs,
              ],
            );
          },
        },
      ],
    };
  }

  const updateMutation: EnqueueMutationInput = {
    entity: 'shopping_category_preferences',
    entityId: id,
    op: 'update',
    payload: {
      id,
      household_id: input.householdId,
      store_id: storeId,
      category_id: categoryId,
      updated_at: now,
    },
    now: nowMs,
    applyLocally: async (txn) => {
      await txn.runAsync(
        'update shopping_category_preferences set category_id = ?, updated_at = ?, _dirty = 1 where id = ?',
        [categoryId, nowMs, id],
      );
    },
  };

  if (existing.deleted_at === null) {
    return { id, changed: true, mutations: [updateMutation] };
  }

  const restoreMutation: EnqueueMutationInput = {
    entity: 'shopping_category_preferences',
    entityId: id,
    op: 'restore',
    payload: {
      id,
      household_id: input.householdId,
      store_id: storeId,
      deleted_at: null,
      updated_at: now,
    },
    now: nowMs,
    applyLocally: async (txn) => {
      await txn.runAsync(
        'update shopping_category_preferences set deleted_at = null, updated_at = ?, _dirty = 1 where id = ?',
        [nowMs, id],
      );
    },
  };

  return { id, changed: true, mutations: [restoreMutation, updateMutation] };
}

/** Nur die Mutationsliste fuer Aufrufer, die keine Plan-Metadaten benoetigen. */
export async function buildCategoryPreferenceMutations(
  db: SqlDatabase,
  action: CategoryPreferenceMutation,
  nowMs = Date.now(),
): Promise<readonly EnqueueMutationInput[]> {
  return (await buildCategoryPreferenceMutationPlan(db, action, nowMs)).mutations;
}

/**
 * Legt eine Haushaltspraeferenz an oder aktualisiert sie. Einzelne Aufrufe
 * bleiben rueckwaertskompatibel, nutzen intern aber denselben Batch-Writer wie
 * der Formular-Save.
 */
export async function setCategoryPreference(input: SetCategoryPreferenceInput): Promise<string> {
  const db = await getDatabase();
  const plan = await buildCategoryPreferenceMutationPlan(db, { type: 'set', input });
  await enqueueMutations(db, plan.mutations);
  return plan.id;
}

/**
 * Reverse State zu {@link setCategoryPreference}: soft-deleted die Praeferenz,
 * die Resolution faellt bei der naechsten Verwendung dieses Schluessels wieder
 * auf die automatische Klassifikation zurueck (Abschnitt 9 "Auf automatisch
 * zurücksetzen"). Ohne Wirkung, wenn keine aktive Praeferenz existiert.
 */
export async function resetCategoryPreference(input: ResetCategoryPreferenceInput): Promise<void> {
  const db = await getDatabase();
  const plan = await buildCategoryPreferenceMutationPlan(db, { type: 'reset', input });
  if (plan.mutations.length > 0) await enqueueMutations(db, plan.mutations);
}
