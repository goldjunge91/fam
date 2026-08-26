import type { SqlDatabase } from '@/lib/db/types';
import { attachPlaintextDatabase, type PlaintextAttachmentMode } from './plaintext-attachment';

const PRODUCT_COLUMNS = [
  'code',
  'product_name',
  'brand',
  'quantity',
  'stores',
  'nutriscore',
  'categories_tags',
  'off_last_modified_at',
  'energy_kcal',
  'fat',
  'saturated_fat',
  'carbohydrates',
  'sugars',
  'proteins',
  'salt',
] as const;

export type ApplyPatchResult =
  | { ok: true }
  | { ok: false; reason: 'from_version_mismatch' | 'schema_mismatch' };

export async function applyPatch(
  db: SqlDatabase,
  params: {
    patchDbPath: string;
    expectedFromVersion: string;
    expectedSchemaVersion: number;
    toVersion: string;
    attachmentMode: PlaintextAttachmentMode;
  },
): Promise<ApplyPatchResult> {
  const { patchDbPath, expectedFromVersion, expectedSchemaVersion, toVersion, attachmentMode } =
    params;

  await attachPlaintextDatabase(db, patchDbPath, 'off_patch', attachmentMode);

  try {
    const meta = await db.getFirstAsync<{ from_version: string; schema_version: number }>(
      'select from_version, schema_version from off_patch.patch_meta limit 1',
    );

    if (!meta || meta.schema_version !== expectedSchemaVersion) {
      return { ok: false, reason: 'schema_mismatch' };
    }
    if (meta.from_version !== expectedFromVersion) {
      return { ok: false, reason: 'from_version_mismatch' };
    }

    const updateSet = PRODUCT_COLUMNS.filter((col) => col !== 'code')
      .map((col) => `${col} = excluded.${col}`)
      .join(', ');

    await db.withExclusiveTransactionAsync(async (txn) => {
      // Das WHERE verhindert die SQLite-Mehrdeutigkeit bei INSERT ... SELECT ... ON CONFLICT.
      await txn.execAsync(`
        insert into off_dump.products (${PRODUCT_COLUMNS.join(', ')})
        select ${PRODUCT_COLUMNS.join(', ')} from off_patch.product_upserts where true
        on conflict(code) do update set ${updateSet}
      `);
      await txn.execAsync(`
        delete from off_dump.products
        where code in (select code from off_patch.product_deletes)
      `);
      await txn.runAsync('update off_dump.dump_meta set data_version = ?', [toVersion]);
    });

    return { ok: true };
  } finally {
    await db.execAsync('DETACH DATABASE off_patch');
  }
}
