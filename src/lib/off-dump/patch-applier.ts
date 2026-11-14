import { isSerializedSqlDatabase } from '@/lib/db/serialize';
import type { SqlDatabase } from '@/lib/db/types';
import { throwIfOffDumpAborted } from './file-ops';
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

type CleanupExec = (source: string) => Promise<void>;

async function applyPatchInWriterScope(
  db: SqlDatabase,
  cleanupExecAsync: CleanupExec,
  params: {
    patchDbPath: string;
    expectedFromVersion: string;
    expectedSchemaVersion: number;
    toVersion: string;
    attachmentMode: PlaintextAttachmentMode;
    signal?: AbortSignal;
  },
): Promise<ApplyPatchResult> {
  const {
    patchDbPath,
    expectedFromVersion,
    expectedSchemaVersion,
    toVersion,
    attachmentMode,
    signal,
  } = params;

  throwIfOffDumpAborted(signal);
  let attached = false;
  let primaryError: unknown;
  let cleanupError: unknown;
  let result: ApplyPatchResult = { ok: false, reason: 'schema_mismatch' };
  try {
    await attachPlaintextDatabase(db, patchDbPath, 'off_patch', attachmentMode);
    attached = true;
    throwIfOffDumpAborted(signal);

    const meta = await db.getFirstAsync<{ from_version: string; schema_version: number }>(
      'select from_version, schema_version from off_patch.patch_meta limit 1',
    );
    throwIfOffDumpAborted(signal);

    if (!meta || meta.schema_version !== expectedSchemaVersion) {
      result = { ok: false, reason: 'schema_mismatch' };
    } else if (meta.from_version !== expectedFromVersion) {
      result = { ok: false, reason: 'from_version_mismatch' };
    } else {
      const updateSet = PRODUCT_COLUMNS.filter((col) => col !== 'code')
        .map((col) => `${col} = excluded.${col}`)
        .join(', ');

      throwIfOffDumpAborted(signal);
      await db.withExclusiveTransactionAsync(
        async (txn) => {
          throwIfOffDumpAborted(signal);
          // Das WHERE verhindert die SQLite-Mehrdeutigkeit bei INSERT ... SELECT ... ON CONFLICT.
          await txn.execAsync(`
            insert into off_dump.products (${PRODUCT_COLUMNS.join(', ')})
            select ${PRODUCT_COLUMNS.join(', ')} from off_patch.product_upserts where true
            on conflict(code) do update set ${updateSet}
          `);
          throwIfOffDumpAborted(signal);
          await txn.execAsync(`
            delete from off_dump.products
            where code in (select code from off_patch.product_deletes)
          `);
          throwIfOffDumpAborted(signal);
          await txn.runAsync('update off_dump.dump_meta set data_version = ?', [toVersion]);
        },
        { signal },
      );

      throwIfOffDumpAborted(signal);
      result = { ok: true };
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (attached) {
      try {
        // This is cleanup for the alias acquired above. It deliberately uses
        // the held scope and never requests a new foreground writer lease.
        await cleanupExecAsync('DETACH DATABASE off_patch');
      } catch (error) {
        cleanupError = error;
      }
    }
  }

  if (primaryError === undefined && cleanupError !== undefined) throw cleanupError;
  return result;
}

export async function applyPatch(
  db: SqlDatabase,
  params: {
    patchDbPath: string;
    expectedFromVersion: string;
    expectedSchemaVersion: number;
    toVersion: string;
    attachmentMode: PlaintextAttachmentMode;
    signal?: AbortSignal;
  },
): Promise<ApplyPatchResult> {
  if (isSerializedSqlDatabase(db)) {
    return db.withWriterLeaseAsync(
      'off.patch',
      ({ db: scopedDb, cleanupExecAsync }) =>
        applyPatchInWriterScope(scopedDb, cleanupExecAsync, params),
      params.signal,
    );
  }

  return applyPatchInWriterScope(db, (source) => db.execAsync(source), params);
}
