import { enqueueMutation } from '@/lib/db/outbox';
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
  category?: string | null;
  product_id?: string | null;
  sort_index?: number;
  store_id?: string | null;
  price_estimate?: number | null;
};

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
  input: { household_id: string; product_id?: string | null; name: string; unit: string },
): Promise<{ id: string; quantity: number } | null> {
  const row = input.product_id
    ? await db.getFirstAsync<{ id: string; quantity: number }>(
        `select id, quantity from shopping_list_items
         where household_id = ? and deleted_at is null and checked_at is null
           and product_id = ? and unit = ?
         limit 1`,
        [input.household_id, input.product_id, input.unit],
      )
    : await db.getFirstAsync<{ id: string; quantity: number }>(
        `select id, quantity from shopping_list_items
         where household_id = ? and deleted_at is null and checked_at is null
           and product_id is null and lower(trim(name)) = lower(trim(?)) and unit = ?
         limit 1`,
        [input.household_id, input.name, input.unit],
      );
  return row ?? null;
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
export async function addOrMergeShoppingItem(
  db: SqlDatabase,
  newId: string,
  input: AddShoppingItemInput,
): Promise<string> {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const normUnit = normalizeUnit(input.unit);

  const existing = await findMergeableShoppingItem(db, {
    household_id: input.household_id,
    product_id: input.product_id,
    name: input.name,
    unit: normUnit,
  });

  if (existing) {
    const mergedQuantity = existing.quantity + input.quantity;
    await enqueueMutation(db, {
      entity: 'shopping_list_items',
      entityId: existing.id,
      op: 'update',
      payload: {
        id: existing.id,
        household_id: input.household_id,
        quantity: mergedQuantity,
        updated_at: now,
      },
      applyLocally: async (txn) => {
        await txn.runAsync(
          'update shopping_list_items set quantity = ?, updated_at = ?, _dirty = 1 where id = ?',
          [mergedQuantity, nowMs, existing.id],
        );
      },
    });
    return existing.id;
  }

  // sort_index: am Ende einfuegen
  const lastRow = await db.getFirstAsync<{ sort_index: number }>(
    'select sort_index from shopping_list_items where household_id = ? and deleted_at is null order by sort_index desc limit 1',
    [input.household_id],
  );
  const sortIndex = input.sort_index ?? (lastRow?.sort_index ?? -1) + 1;

  await enqueueMutation(db, {
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
      category: input.category ?? null,
      sort_index: sortIndex,
      store_id: input.store_id ?? null,
      price_estimate: input.price_estimate ?? null,
      created_at: now,
      updated_at: now,
    },
    applyLocally: async (txn) => {
      await txn.runAsync(
        `insert into shopping_list_items
           (id, household_id, product_id, name, quantity, unit, category, sort_index, store_id, price_estimate, created_at, updated_at, _dirty)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          newId,
          input.household_id,
          input.product_id ?? null,
          input.name,
          input.quantity,
          normUnit,
          input.category ?? null,
          sortIndex,
          input.store_id ?? null,
          input.price_estimate ?? null,
          now,
          nowMs,
        ],
      );
    },
  });

  return newId;
}
