import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import type { ShoppingCategoryId } from '../classification/shopping-category-id';
import type { CategoryClassification, CategoryClassifierInput } from '../classification/types';
import { normalizePreferenceName } from './normalize-preference-name';
import { preferenceId } from './preference-identity.expo';
import { resolveCategory } from './resolve-category';

export type CategoryPreferenceKeyType = 'product' | 'name';

/** Lokal gespiegelte Zeile aus `shopping_category_preferences` (aktiv, nicht geloescht). */
export type CategoryPreference = {
  id: string;
  household_id: string;
  key_type: CategoryPreferenceKeyType;
  normalized_key_value: string;
  category_id: ShoppingCategoryId | null;
  created_by: string | null;
  created_at: string | null;
};

type LocalPreferenceRow = CategoryPreference & { deleted_at: number | null };

const SELECT_COLUMNS =
  'id, household_id, key_type, normalized_key_value, category_id, created_by, created_at, deleted_at';

function toPublicRow(row: LocalPreferenceRow): CategoryPreference {
  const { deleted_at: _deleted_at, ...rest } = row;
  return rest;
}

/** Aktive (nicht geloeschte) Produkt-Praeferenz einer `product_id`, falls vorhanden. */
export async function findProductPreference(
  householdId: string,
  productId: string,
): Promise<CategoryPreference | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalPreferenceRow>(
    `select ${SELECT_COLUMNS} from shopping_category_preferences
     where household_id = ? and key_type = 'product' and normalized_key_value = ? and deleted_at is null`,
    [householdId, productId.toLowerCase()],
  );
  return row ? toPublicRow(row) : null;
}

/** Aktive (nicht geloeschte) Namens-Praeferenz eines Freitextnamens, falls vorhanden. */
export async function findNamePreference(
  householdId: string,
  name: string,
): Promise<CategoryPreference | null> {
  const normalized = normalizePreferenceName(name);
  if (!normalized) return null;

  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalPreferenceRow>(
    `select ${SELECT_COLUMNS} from shopping_category_preferences
     where household_id = ? and key_type = 'name' and normalized_key_value = ? and deleted_at is null`,
    [householdId, normalized],
  );
  return row ? toPublicRow(row) : null;
}

export type ResolveCategoryForItemInput = CategoryClassifierInput & {
  householdId: string;
  /** `product_id` des aktuell gewaehlten Produkts, falls per Barcode/Suche hinzugefuegt. */
  productId?: string | null;
};

/**
 * Laedt die lokal bekannten Praeferenzen fuer `householdId`/`productId`/`name`
 * und delegiert die eigentliche Auflösung an das reine `resolveCategory()`.
 * Der Punkt, an dem `preferences/` und `classification/` zusammenlaufen
 * (Schritte 1–6 der Auflösungsreihenfolge, siehe `resolve-category.ts`).
 */
export async function resolveCategoryForItem(
  input: ResolveCategoryForItemInput,
): Promise<CategoryClassification> {
  const productPreference = input.productId
    ? await findProductPreference(input.householdId, input.productId)
    : null;
  const namePreference = productPreference
    ? null
    : await findNamePreference(input.householdId, input.name);

  return resolveCategory({
    name: input.name,
    categoryTags: input.categoryTags,
    source: input.source,
    dataVersion: input.dataVersion,
    productPreference: productPreference ? { categoryId: productPreference.category_id } : null,
    namePreference: namePreference ? { categoryId: namePreference.category_id } : null,
  });
}

export type SetCategoryPreferenceInput = {
  householdId: string;
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

/**
 * Legt eine Haushaltspraeferenz an oder aktualisiert sie — manuelle Korrektur
 * im Formular (Abschnitt 9 "Schreiben"). Die deterministische UUIDv5 macht das
 * zu einem echten Upsert nach natuerlicher Identitaet: derselbe Aufruf
 * adressiert immer dieselbe Zeile, auch bei paralleler Offline-Anlage auf
 * zwei Geraeten (kein `23505` im Normalpfad — und falls doch, faengt
 * `push.ts`s insert→update-Fallback ihn ab).
 *
 * Eine lokal bekannte, soft-deletete Zeile (zuvor auf "Automatisch"
 * zurueckgesetzt) wird reaktiviert: `restore` gefolgt von `update`, siehe
 * Kommentar am `restore`-Zweig in `push.ts`.
 */
export async function setCategoryPreference(input: SetCategoryPreferenceInput): Promise<string> {
  const normalizedKeyValue = canonicalKeyValueOf(input);
  const id = await preferenceId({
    householdId: input.householdId,
    keyType: input.keyType,
    normalizedKeyValue,
  });

  const db = await getDatabase();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const existing = await db.getFirstAsync<{ id: string; deleted_at: number | null }>(
    'select id, deleted_at from shopping_category_preferences where id = ?',
    [id],
  );

  if (!existing) {
    await enqueueMutation(db, {
      entity: 'shopping_category_preferences',
      entityId: id,
      op: 'insert',
      payload: {
        id,
        household_id: input.householdId,
        key_type: input.keyType,
        normalized_key_value: normalizedKeyValue,
        category_id: input.categoryId,
        created_by: input.createdBy,
        created_at: now,
        updated_at: now,
      },
      applyLocally: async (txn) => {
        await txn.runAsync(
          `insert into shopping_category_preferences
             (id, household_id, key_type, normalized_key_value, category_id, created_by, created_at, updated_at, _dirty)
           values (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            id,
            input.householdId,
            input.keyType,
            normalizedKeyValue,
            input.categoryId,
            input.createdBy,
            now,
            nowMs,
          ],
        );
      },
    });
    return id;
  }

  if (existing.deleted_at !== null) {
    await enqueueMutation(db, {
      entity: 'shopping_category_preferences',
      entityId: id,
      op: 'restore',
      payload: { id, household_id: input.householdId, deleted_at: null, updated_at: now },
      applyLocally: async (txn) => {
        await txn.runAsync(
          'update shopping_category_preferences set deleted_at = null, updated_at = ?, _dirty = 1 where id = ?',
          [nowMs, id],
        );
      },
    });
  }

  await enqueueMutation(db, {
    entity: 'shopping_category_preferences',
    entityId: id,
    op: 'update',
    payload: {
      id,
      household_id: input.householdId,
      category_id: input.categoryId,
      updated_at: now,
    },
    applyLocally: async (txn) => {
      await txn.runAsync(
        'update shopping_category_preferences set category_id = ?, updated_at = ?, _dirty = 1 where id = ?',
        [input.categoryId, nowMs, id],
      );
    },
  });

  return id;
}

export type ResetCategoryPreferenceInput = {
  householdId: string;
  keyType: CategoryPreferenceKeyType;
  keyValue: string;
};

/**
 * Reverse State zu {@link setCategoryPreference}: soft-deleted die Praeferenz,
 * die Resolution faellt bei der naechsten Verwendung dieses Schluessels wieder
 * auf die automatische Klassifikation zurueck (Abschnitt 9 "Auf automatisch
 * zurücksetzen"). Ohne Wirkung, wenn keine aktive Praeferenz existiert.
 */
export async function resetCategoryPreference(input: ResetCategoryPreferenceInput): Promise<void> {
  const normalizedKeyValue = canonicalKeyValueOf(input);
  const id = await preferenceId({
    householdId: input.householdId,
    keyType: input.keyType,
    normalizedKeyValue,
  });

  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ deleted_at: number | null }>(
    'select deleted_at from shopping_category_preferences where id = ?',
    [id],
  );
  if (!existing || existing.deleted_at !== null) return;

  const now = new Date().toISOString();
  const nowMs = Date.now();

  await enqueueMutation(db, {
    entity: 'shopping_category_preferences',
    entityId: id,
    op: 'delete',
    payload: { id, household_id: input.householdId, deleted_at: now, updated_at: now },
    applyLocally: async (txn) => {
      await txn.runAsync(
        'update shopping_category_preferences set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
        [nowMs, nowMs, id],
      );
    },
  });
}
