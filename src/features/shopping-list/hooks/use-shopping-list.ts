import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';
import { parseJsonArray } from '@/lib/db/json-array';
import { effectiveSortOrder, UNCATEGORIZED_LABEL } from '../domain-logik/shopping-categories';

export type LocalShoppingItem = {
  id: string;
  household_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  package_size: number | null;
  package_size_unit: string | null;
  category: string | null;
  store_id: string | null;
  price_estimate: number | null;
  /** Titel der Gerichte, aus denen dieser Artikel stammt (leer bei manuellem Eintrag). */
  recipe_names: string[];
  checked_at: string | null;
  checked_by: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

/** Rohzeile aus SQLite: `recipe_names` (Server-`text[]`) kommt lokal als JSON-Text an. */
type LocalShoppingItemRow = Omit<LocalShoppingItem, 'recipe_names'> & { recipe_names: string };

export type GroupedShoppingItems = {
  category: string;
  items: LocalShoppingItem[];
};

/**
 * Gruppiert Artikel nach Kategorie und sortiert die Gruppen nach der
 * Supermarkt-Laufstrecke (`shopping-categories.ts`) statt nach
 * Insertion-Order. Unkategorisierte Artikel ("Sonstiges") sinken ans Ende.
 * `customOrderIds` ist eine per Drag&Drop editierte, marktspezifische
 * Laufstrecke (Kategorie-IDs) — fehlt sie, gilt die Standardreihenfolge.
 *
 * Eigenstaendig exportiert, damit z.B. eine markt-gefilterte Ansicht dieselbe
 * Gruppierung client-seitig auf eine Teilmenge anwenden kann.
 */
export function groupByCategory(
  items: LocalShoppingItem[],
  customOrderIds?: readonly string[] | null,
): GroupedShoppingItems[] {
  const groupMap = new Map<string, LocalShoppingItem[]>();
  for (const item of items) {
    const cat = item.category ?? UNCATEGORIZED_LABEL;
    if (!groupMap.has(cat)) {
      groupMap.set(cat, []);
    }
    groupMap.get(cat)?.push(item);
  }

  return Array.from(groupMap.entries())
    .map(([category, groupItems]) => ({ category, items: groupItems }))
    .sort(
      (a, b) =>
        effectiveSortOrder(a.category, customOrderIds) -
        effectiveSortOrder(b.category, customOrderIds),
    );
}

/**
 * Liest alle aktiven Einkaufslisten-Artikel fuer den Haushalt aus SQLite (#85).
 *
 * Artikel mit `deleted_at` werden herausgefiltert — Soft-Deletes erscheinen
 * nicht in der UI. Gecheckte Artikel (`checked_at IS NOT NULL`) werden ans
 * Ende der Kategorie-Gruppe sortiert, bleiben aber sichtbar (ausgegraut),
 * damit der Nutzer sieht was er bereits eingepackt hat.
 */
export function useShoppingList(householdId: string | undefined) {
  return useQuery({
    queryKey: ['shopping_list_items', householdId],
    queryFn: async (): Promise<GroupedShoppingItems[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      const rows = await db.getAllAsync<LocalShoppingItemRow>(
        `select id, household_id, product_id, name, quantity, unit,
                package_size, package_size_unit, category,
                store_id, price_estimate, recipe_names,
                checked_at, checked_by, sort_index, created_at, updated_at
         from shopping_list_items
         where household_id = ? and deleted_at is null
         order by
           case when checked_at is null then 0 else 1 end asc,
           sort_index asc,
           name asc`,
        [householdId],
      );
      const items = rows.map((row) => ({
        ...row,
        recipe_names: parseJsonArray<string>(row.recipe_names),
      }));

      return groupByCategory(items);
    },
    enabled: !!householdId,
  });
}

/** Alle gecheckte Artikel (fuer den Transfer-Sheet). */
export function useCheckedShoppingItems(householdId: string | undefined) {
  return useQuery({
    queryKey: ['shopping_list_items', householdId, 'checked'],
    queryFn: async (): Promise<LocalShoppingItem[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      const rows = await db.getAllAsync<LocalShoppingItemRow>(
        `select id, household_id, product_id, name, quantity, unit,
                package_size, package_size_unit, category,
                store_id, price_estimate, recipe_names,
                checked_at, checked_by, sort_index, created_at, updated_at
         from shopping_list_items
         where household_id = ? and deleted_at is null and checked_at is not null
         order by name asc`,
        [householdId],
      );
      return rows.map((row) => ({
        ...row,
        recipe_names: parseJsonArray<string>(row.recipe_names),
      }));
    },
    enabled: !!householdId,
  });
}
