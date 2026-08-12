import type { SqlDatabase } from '@/lib/db/types';

/**
 * Wo ein Produkt verwendet wurde (#79). Rein lokal, wie `shopping_history` —
 * kein `_dirty`, keine Outbox, kein Server-Gegenstueck.
 *
 * Nimmt `db` explizit entgegen statt selbst `getDatabase()` aufzurufen (wie
 * `enqueueMutation` in `outbox.ts`) — nur so laeuft es unter `node:sqlite` im
 * Test, ohne `expo-sqlite` zu beruehren. Aus demselben Grund erzeugt dieses
 * Modul die `id` nicht selbst (kein `expo-crypto`-Import, dasselbe Muster wie
 * `outbox.ts`/`enqueueMutation`) — der Aufrufer liefert sie, in der App via
 * `Crypto.randomUUID()` wie bei `use-complete-shopping-run.ts`.
 */
export type ProductUsageFeature = 'fridge' | 'shopping_list' | 'diary';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type ProductUsageEntry = {
  id: string;
  userId: string;
  householdId?: string | null;
  feature: ProductUsageFeature;
  mealType?: MealType | null;
  productId?: string | null;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  unit?: string | null;
  quantity?: number | null;
  kcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  /** ISO-Zeitstempel; default `new Date().toISOString()`. Ueberschreibbar fuer Tests. */
  usedAt?: string;
};

/**
 * Protokolliert eine Produktverwendung. Wird direkt nach erfolgreichem
 * Speichern in Vorrat/Einkaufsliste/Tagebuch aufgerufen — bewusst append-only
 * und ohne Rueckgabewert, ein fehlgeschlagener Tracking-Insert darf das
 * eigentliche Speichern nie beeinflussen (Aufrufer fangen Fehler selbst ab).
 */
export async function recordProductUsage(db: SqlDatabase, entry: ProductUsageEntry): Promise<void> {
  await db.runAsync(
    `insert into product_usage
       (id, user_id, household_id, feature, meal_type, product_id, name, brand, barcode, unit, quantity, kcal, protein_g, carbs_g, fat_g, used_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.userId,
      entry.householdId ?? null,
      entry.feature,
      entry.mealType ?? null,
      entry.productId ?? null,
      entry.name,
      entry.brand ?? null,
      entry.barcode ?? null,
      entry.unit ?? null,
      entry.quantity ?? null,
      entry.kcal ?? null,
      entry.proteinG ?? null,
      entry.carbsG ?? null,
      entry.fatG ?? null,
      entry.usedAt ?? new Date().toISOString(),
    ],
  );
}

export type ProductUsageRow = {
  name: string;
  brand: string | null;
  barcode: string | null;
  product_id: string | null;
  unit: string | null;
  quantity: number | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  used_at: string;
};

/**
 * Rohdaten fuer die Haeufig-genutzt-Anzeige, ein Eintrag je Name (case-
 * insensitiv), absteigend nach Haeufigkeit sortiert — bei Gleichstand bleibt
 * die juengste Fundstelle vorn. Dedupe/Ranking laeuft in SQL (statt beim
 * Aufrufer wie zuvor), damit `limit` distinkte Produkte begrenzt statt
 * Rohzeilen: sonst kann ein einzelnes, oft protokolliertes Produkt (z. B.
 * taeglicher Kaffee) das ganze `limit`-Fenster fuellen, bevor die
 * JS-seitige Dedupe (`dedupeRecentFoods`/`rankFrequentFoods` in
 * `food-history.ts`) ueberhaupt zum Zug kommt. Diese Funktionen bleiben
 * bestehen, werden mit bereits deduplizierten Zeilen aber zu einer
 * Durchreiche.
 *
 * `mealType: null` liefert alle Mahlzeitarten (fuer `fridge`/`shopping_list`,
 * die keine kennen); ein gesetzter Wert schraenkt fuer `diary` ein (#79 AC:
 * "Auf die Mahlzeitart eingeschraenkt").
 */
export async function getFrequentProductUsage(
  db: SqlDatabase,
  params: {
    userId: string;
    feature: ProductUsageFeature;
    mealType?: MealType | null;
    limit?: number;
  },
): Promise<ProductUsageRow[]> {
  const { userId, feature, mealType = null, limit = 200 } = params;
  return db.getAllAsync<ProductUsageRow>(
    `with ranked as (
       select *,
              row_number() over (partition by lower(name) order by used_at desc) as rn,
              count(*) over (partition by lower(name)) as freq
       from product_usage
       where user_id = ? and feature = ? and (? is null or meal_type = ?)
     )
     select name, brand, barcode, product_id, unit, quantity, kcal, protein_g, carbs_g, fat_g, used_at
     from ranked
     where rn = 1
     order by freq desc, used_at desc
     limit ?`,
    [userId, feature, mealType, mealType, limit],
  );
}
