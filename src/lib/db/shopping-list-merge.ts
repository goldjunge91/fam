import type { CategorySource } from '@/features/shopping-list/classification/types';
import { parseJsonArray } from '@/lib/db/json-array';
import { type EnqueueMutationInput, enqueueMutation } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { normalizeUnit } from '@/lib/units';

/**
 * Zusammenfuehren-Logik fuer `useAddShoppingItem`, ausgelagert wie
 * `product-usage.ts`: nimmt `db` und eine bereits erzeugte `id` entgegen
 * statt sie selbst zu holen (kein `expo-sqlite`/`expo-crypto`-Import), damit
 * sie unter `node:sqlite` im Integrationstest laeuft, ohne native Module zu
 * beruehren.
 *
 * Verhindert Duplikate auf der Einkaufsliste unabhaengig von der Quelle
 * (manueller Eintrag, Wochenplaner-Bedarf, Rezept): landet ein Artikel mit
 * gleichem Produkt (bzw. gleichem Namen ohne Produktverknuepfung) und
 * gleicher Einheit erneut, wird die Menge des bestehenden, noch offenen
 * Eintrags erhoeht statt eine zweite Zeile anzulegen.
 */
export type AddShoppingItemInput = {
  household_id: string;
  name: string;
  quantity: number;
  unit: string;
  package_size?: number | null;
  package_size_unit?: string | null;
  category_id?: string | null;
  category_source?: CategorySource | null;
  category_classifier_version?: string | null;
  product_id?: string | null;
  sort_index?: number;
  store_id?: string | null;
  price_estimate?: number | null;
  /** Titel der Gerichte, aus denen dieser Artikel stammt (leer bei manuellem Eintrag). */
  recipe_names?: readonly string[];
};

/** Vereinigt bestehende und neue Rezeptnamen, Reihenfolge erhalten, ohne Duplikate. */
function mergeRecipeNames(existing: readonly string[], incoming: readonly string[]): string[] {
  const merged = [...existing];
  for (const name of incoming) {
    if (!merged.includes(name)) merged.push(name);
  }
  return merged;
}

/**
 * Vertrauensrang einer Kategorie-Herkunft (`docs/issue#223_V2.md` Abschnitt
 * 10 "Merge") — hoeher gewinnt beim Zusammenfuehren. `null`/unbekannt zaehlt
 * als niedrigster Rang, nicht als Sonderfall.
 */
const CATEGORY_SOURCE_RANK: Record<string, number> = {
  user: 5,
  store_preference: 4,
  household_preference: 3,
  off_taxonomy: 2,
  name_fallback: 1,
};

function categorySourceRank(source: string | null | undefined): number {
  return source ? (CATEGORY_SOURCE_RANK[source] ?? 0) : 0;
}

/**
 * Sucht einen bereits vorhandenen, noch offenen (nicht abgehakten, nicht
 * geloeschten) Artikel derselben Einheit. Matching bevorzugt `product_id`
 * (eindeutig), faellt ohne Produktverknuepfung auf den normalisierten Namen
 * zurueck. Ein bereits abgehakter Artikel zaehlt bewusst nicht als Treffer —
 * der vorige Einkauf ist abgeschlossen, ein neuer Bedarf verdient eine neue
 * Zeile statt den Haken zu entfernen.
 */
async function findMergeableShoppingItem(
  db: SqlDatabase,
  input: {
    household_id: string;
    product_id?: string | null;
    name: string;
    unit: string;
    store_id?: string | null;
    package_size?: number | null;
    package_size_unit?: string | null;
  },
): Promise<{
  id: string;
  quantity: number;
  recipeNames: string[];
  categoryId: string | null;
  categorySource: string | null;
  categoryClassifierVersion: string | null;
} | null> {
  type Row = {
    id: string;
    quantity: number;
    recipe_names: string;
    category_id: string | null;
    category_source: string | null;
    category_classifier_version: string | null;
  };
  const SELECT_COLUMNS =
    'id, quantity, recipe_names, category_id, category_source, category_classifier_version';

  const row = input.product_id
    ? await db.getFirstAsync<Row>(
        `select ${SELECT_COLUMNS} from shopping_list_items
         where household_id = ? and deleted_at is null and checked_at is null
           and product_id = ? and unit = ?
           and coalesce(store_id, '') = coalesce(?, '')
           and coalesce(package_size, -1) = coalesce(?, -1)
           and coalesce(package_size_unit, '') = coalesce(?, '')
         limit 1`,
        [
          input.household_id,
          input.product_id,
          input.unit,
          input.store_id ?? null,
          input.package_size ?? null,
          input.package_size_unit ?? null,
        ],
      )
    : await db.getFirstAsync<Row>(
        `select ${SELECT_COLUMNS} from shopping_list_items
         where household_id = ? and deleted_at is null and checked_at is null
           and product_id is null and lower(trim(name)) = lower(trim(?)) and unit = ?
           and coalesce(store_id, '') = coalesce(?, '')
           and coalesce(package_size, -1) = coalesce(?, -1)
           and coalesce(package_size_unit, '') = coalesce(?, '')
         limit 1`,
        [
          input.household_id,
          input.name,
          input.unit,
          input.store_id ?? null,
          input.package_size ?? null,
          input.package_size_unit ?? null,
        ],
      );
  if (!row) return null;
  return {
    id: row.id,
    quantity: row.quantity,
    recipeNames: parseJsonArray<string>(row.recipe_names),
    categoryId: row.category_id,
    categorySource: row.category_source,
    categoryClassifierVersion: row.category_classifier_version,
  };
}

/**
 * Fuegt einen neuen Artikel zur Einkaufsliste hinzu (#86) — oder erhoeht,
 * falls derselbe Artikel (gleiches Produkt bzw. gleicher Name, gleiche
 * Einheit) bereits offen auf der Liste steht, dessen Menge (#131/#146).
 *
 * `newId` wird vom Aufrufer erzeugt (`Crypto.randomUUID()`), damit dieses
 * Modul frei von `expo-crypto` bleibt — dasselbe Muster wie
 * `product-usage.ts`. Bei einem Merge bleibt `newId` ungenutzt.
 */
export async function buildAddOrMergeShoppingItemMutation(
  db: SqlDatabase,
  newId: string,
  input: AddShoppingItemInput,
): Promise<EnqueueMutationInput> {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const normUnit = normalizeUnit(input.unit);
  const normPackageUnit = input.package_size_unit ? normalizeUnit(input.package_size_unit) : null;

  const existing = await findMergeableShoppingItem(db, {
    household_id: input.household_id,
    product_id: input.product_id,
    name: input.name,
    unit: normUnit,
    store_id: input.store_id,
    package_size: input.package_size,
    package_size_unit: normPackageUnit,
  });

  if (existing) {
    const mergedQuantity = existing.quantity + input.quantity;
    const mergedRecipeNames = mergeRecipeNames(existing.recipeNames, input.recipe_names ?? []);

    // Vertrauensrang statt "bestehende Kategorie bleibt immer stehen": ein
    // eingehender Wert ersetzt die bestehende Kategorie nur, wenn er einen
    // echt hoeheren Rang hat (Abschnitt 10 "Merge") — z.B. darf eine gerade
    // manuell gewaehlte Kategorie (`user`) einen automatischen
    // Namens-Fallback ueberschreiben, aber nicht umgekehrt.
    const useIncomingCategory =
      input.category_source === 'user' ||
      categorySourceRank(input.category_source) > categorySourceRank(existing.categorySource);
    const mergedCategoryId = useIncomingCategory
      ? (input.category_id ?? null)
      : existing.categoryId;
    const mergedCategorySource = useIncomingCategory
      ? (input.category_source ?? null)
      : existing.categorySource;
    const mergedCategoryClassifierVersion = useIncomingCategory
      ? (input.category_classifier_version ?? null)
      : existing.categoryClassifierVersion;

    return {
      entity: 'shopping_list_items',
      entityId: existing.id,
      op: 'update',
      payload: {
        id: existing.id,
        household_id: input.household_id,
        quantity: mergedQuantity,
        package_size: input.package_size ?? null,
        package_size_unit: normPackageUnit,
        recipe_names: mergedRecipeNames,
        category_id: mergedCategoryId,
        category_source: mergedCategorySource,
        category_classifier_version: mergedCategoryClassifierVersion,
        updated_at: now,
      },
      applyLocally: async (txn) => {
        await txn.runAsync(
          `update shopping_list_items
           set quantity = ?, package_size = ?, package_size_unit = ?, recipe_names = ?,
               category_id = ?, category_source = ?, category_classifier_version = ?,
               updated_at = ?, _dirty = 1
           where id = ?`,
          [
            mergedQuantity,
            input.package_size ?? null,
            normPackageUnit,
            JSON.stringify(mergedRecipeNames),
            mergedCategoryId,
            mergedCategorySource,
            mergedCategoryClassifierVersion,
            nowMs,
            existing.id,
          ],
        );
      },
    };
  }

  // sort_index: am Ende einfuegen
  const lastRow = await db.getFirstAsync<{ sort_index: number }>(
    'select sort_index from shopping_list_items where household_id = ? and deleted_at is null order by sort_index desc limit 1',
    [input.household_id],
  );
  const sortIndex = input.sort_index ?? (lastRow?.sort_index ?? -1) + 1;

  return {
    entity: 'shopping_list_items',
    entityId: newId,
    op: 'insert',
    payload: {
      id: newId,
      household_id: input.household_id,
      product_id: input.product_id ?? null,
      name: input.name,
      quantity: input.quantity,
      unit: normUnit,
      package_size: input.package_size ?? null,
      package_size_unit: normPackageUnit,
      category_id: input.category_id ?? null,
      category_source: input.category_source ?? null,
      category_classifier_version: input.category_classifier_version ?? null,
      sort_index: sortIndex,
      store_id: input.store_id ?? null,
      price_estimate: input.price_estimate ?? null,
      recipe_names: input.recipe_names ?? [],
      created_at: now,
      updated_at: now,
    },
    applyLocally: async (txn) => {
      await txn.runAsync(
        `insert into shopping_list_items
           (id, household_id, product_id, name, quantity, unit, package_size, package_size_unit,
            category_id, category_source, category_classifier_version,
            sort_index, store_id, price_estimate, recipe_names, created_at, updated_at, _dirty)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          newId,
          input.household_id,
          input.product_id ?? null,
          input.name,
          input.quantity,
          normUnit,
          input.package_size ?? null,
          normPackageUnit,
          input.category_id ?? null,
          input.category_source ?? null,
          input.category_classifier_version ?? null,
          sortIndex,
          input.store_id ?? null,
          input.price_estimate ?? null,
          JSON.stringify(input.recipe_names ?? []),
          now,
          nowMs,
        ],
      );
    },
  };
}

export async function addOrMergeShoppingItem(
  db: SqlDatabase,
  newId: string,
  input: AddShoppingItemInput,
): Promise<string> {
  const mutation = await buildAddOrMergeShoppingItemMutation(db, newId, input);
  await enqueueMutation(db, mutation);
  return mutation.entityId;
}
