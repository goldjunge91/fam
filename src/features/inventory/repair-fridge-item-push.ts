import type { ForeignKeyViolationResolver } from '@/lib/db/entities';

export const repairFridgeItemForeignKeyViolation: ForeignKeyViolationResolver = async (
  { db, supabase },
  payload,
  error,
) => {
  const isLocationForeignKeyViolation =
    error.code === '23503' || error.message?.includes('location_id_fkey');
  if (!isLocationForeignKeyViolation || !payload.location_id) return null;

  const locationId = String(payload.location_id);
  const location = await db.getFirstAsync<Record<string, unknown>>(
    'select * from storage_locations where id = ?',
    [locationId],
  );

  if (location) {
    const SYNC_COLUMNS = new Set(['updated_at', 'deleted_at', '_dirty']);
    const insertPayload = Object.fromEntries(
      Object.entries(location).filter(([key]) => !SYNC_COLUMNS.has(key)),
    );
    await supabase
      .from('storage_locations')
      .insert(insertPayload as never)
      .select();
    return payload;
  }

  return { ...payload, location_id: null };
};
