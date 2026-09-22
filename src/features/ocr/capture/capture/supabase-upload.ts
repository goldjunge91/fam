import type { TypedSupabaseClient } from '@/lib/backend/supabase/client';
import { RECEIPT_ASSET_BUCKET } from './constants';
import type { ReceiptAssetUploadAdapter, ReceiptAssetUploadInput } from './contracts';
import {
  normalizeReceiptImageMimeType,
  RECEIPT_CANONICAL_IMAGE_MIME_TYPE,
  receiptImageExtension,
} from './mime';

function supabaseClient(): TypedSupabaseClient {
  const { getSupabase } =
    require('@/lib/backend/supabase/client') as typeof import('@/lib/backend/supabase/client');
  return getSupabase();
}

function expectedStoragePath(input: ReceiptAssetUploadInput): string {
  const mimeType = normalizeReceiptImageMimeType(input.mimeType, input.assetId);
  if (!mimeType) throw new Error('Receipt asset MIME type is not supported.');
  if (mimeType !== RECEIPT_CANONICAL_IMAGE_MIME_TYPE) {
    throw new Error('Receipt uploads require the normalized JPEG working file.');
  }
  return `${input.householdId}/${input.receiptId}/${input.assetId}.${receiptImageExtension(mimeType)}`;
}

function assertUploadInput(input: ReceiptAssetUploadInput): void {
  for (const [field, value] of [
    ['householdId', input.householdId],
    ['receiptId', input.receiptId],
    ['createdBy', input.createdBy],
    ['assetId', input.assetId],
  ] as const) {
    if (value.trim().length === 0 || value.includes('/') || value.includes('\\')) {
      throw new Error(`Invalid receipt asset ${field}.`);
    }
  }
  if (input.storagePath !== expectedStoragePath(input)) {
    throw new Error('Receipt asset storage path is outside its household receipt scope.');
  }
  if (input.byteSize !== input.bytes.byteLength || input.byteSize <= 0) {
    throw new Error('Receipt asset byte size does not match its bytes.');
  }
}

/**
 * Narrow integration seam for the current authority boundary.
 * The authority exposes asset reads/deletes, so capture owns the paired
 * Storage upload and receipt_assets metadata upsert here.
 */
export function createSupabaseReceiptAssetUploadAdapter(
  client: TypedSupabaseClient = supabaseClient(),
): ReceiptAssetUploadAdapter {
  return {
    async upload(input) {
      assertUploadInput(input);

      const { error: storageError } = await client.storage
        .from(RECEIPT_ASSET_BUCKET)
        .upload(input.storagePath, input.bytes, {
          contentType: input.mimeType,
          upsert: true,
        });
      if (storageError) throw new Error(storageError.message);

      const { data, error: metadataError } = await client
        .from('receipt_assets')
        .upsert(
          {
            id: input.assetId,
            receipt_id: input.receiptId,
            household_id: input.householdId,
            storage_path: input.storagePath,
            mime_type: input.mimeType,
            byte_size: input.byteSize,
            sort_order: input.sortOrder,
            created_by: input.createdBy,
            deleted_at: null,
          },
          { onConflict: 'storage_path' },
        )
        .select('id, storage_path')
        .single();
      if (metadataError) throw new Error(metadataError.message);
      if (!data?.id || !data.storage_path) {
        throw new Error('Supabase returned incomplete receipt asset metadata.');
      }

      return { assetId: data.id, storagePath: data.storage_path };
    },
  };
}
