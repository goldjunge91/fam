import type { ForeignKeyViolationResolver } from '@/lib/db/entities';
import { throwIfSyncAborted } from '@/lib/sync/cancellation';

export const repairFridgeItemForeignKeyViolation: ForeignKeyViolationResolver = async (
  { db, supabase, signal },
  payload,
  error,
) => {
  throwIfSyncAborted(signal);
  const isLocationForeignKeyViolation =
    error.code === '23503' || error.message?.includes('location_id_fkey');
  if (!isLocationForeignKeyViolation || !payload.location_id) return null;

  const locationId = String(payload.location_id);
  const location = await db.getFirstAsync<Record<string, unknown>>(
    'select * from storage_locations where id = ?',
    [locationId],
  );
  throwIfSyncAborted(signal);

  if (location) {
    const SYNC_COLUMNS = new Set(['updated_at', 'deleted_at', '_dirty']);
    const insertPayload = Object.fromEntries(
      Object.entries(location).filter(([key]) => !SYNC_COLUMNS.has(key)),
    );
    let request = supabase
      .from('storage_locations')
      .insert(insertPayload as never)
      .select();
    if (signal) request = request.abortSignal(signal);
    await request;
    throwIfSyncAborted(signal);
    return payload;
  }

  // FK-Fehler veraendern keine Absicht: existiert der Lagerort lokal nicht,
  // darf der Payload nicht still veraendert werden.
  return null;
};
