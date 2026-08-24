import type { ForeignKeyViolationResolver } from '@/lib/db/entities';

/**
 * FK-Reparatur fuer `fridge_items` (#192): ein lokal existierender, aber noch
 * nicht gepushter Lagerort (`location_id`) laesst den Push mit 23503
 * scheitern. Push den Lagerort zuerst nach, oder — falls er lokal gar nicht
 * (mehr) existiert — setze `location_id` auf `null`, damit das Lebensmittel
 * nicht dauerhaft in der Outbox haengen bleibt.
 *
 * Registriert bei `fridge_items` in `entities.ts`, aufgerufen von der
 * generischen Push-Engine (`push.ts`) — die kennt weder `fridge_items` noch
 * `location_id` noch `storage_locations`.
 */
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
