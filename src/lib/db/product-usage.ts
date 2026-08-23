import type { SqlDatabase } from '@/lib/db/types';

/** Rein lokale Nutzungshistorie ohne Outbox oder Server-Gegenstueck. */
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
  usedAt?: string;
};

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

/** Dedupliziert vor dem Limit, damit ein oft genutztes Produkt das Fenster nicht fuellt. */
export async function getFrequentProductUsage(
  db: SqlDatabase,
  params: {
    userId: string;
    feature: ProductUsageFeature;
    mealType?: MealType | null;
    limit?: number;
    mode?: 'frequent' | 'recent';
  },
): Promise<ProductUsageRow[]> {
  const { userId, feature, mealType = null, limit = 200, mode = 'frequent' } = params;
  const orderBy = mode === 'recent' ? 'used_at desc' : 'freq desc, used_at desc';
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
     order by ${orderBy}
     limit ?`,
    [userId, feature, mealType, mealType, limit],
  );
}
