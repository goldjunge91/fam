import type { TypedSupabaseClient } from '@/lib/backend/supabase/client';
import { createSupabaseReceiptAssetUploadAdapter } from './supabase-upload';

const ASSET_ID = '00000000-0000-5000-8000-000000000001';
const STORAGE_PATH = `household-1/receipt-1/${ASSET_ID}.jpg`;

describe('Supabase receipt asset upload adapter', () => {
  it('stores bytes and household-scoped metadata with the deterministic asset identity', async () => {
    const stored = {
      bytes: new Uint8Array() as Uint8Array<ArrayBufferLike>,
      options: {} as Record<string, unknown>,
      metadata: {} as Record<string, unknown>,
    };
    const client = {
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, bytes: Uint8Array, options: Record<string, unknown>) => {
            expect(bucket).toBe('receipt-images');
            stored.bytes = bytes;
            stored.options = options;
            expect(path).toBe(STORAGE_PATH);
            return { data: null, error: null };
          },
        }),
      },
      from: (table: string) => {
        expect(table).toBe('receipt_assets');
        const query = {
          upsert: (metadata: Record<string, unknown>) => {
            stored.metadata = metadata;
            return query;
          },
          select: () => query,
          single: async () => ({
            data: { id: ASSET_ID, storage_path: STORAGE_PATH },
            error: null,
          }),
        };
        return query;
      },
    } as unknown as TypedSupabaseClient;

    const result = await createSupabaseReceiptAssetUploadAdapter(client).upload({
      householdId: 'household-1',
      receiptId: 'receipt-1',
      createdBy: 'user-1',
      localAssetId: ASSET_ID,
      assetId: ASSET_ID,
      storagePath: STORAGE_PATH,
      mimeType: 'image/jpeg',
      byteSize: 3,
      sortOrder: 0,
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({ assetId: ASSET_ID, storagePath: STORAGE_PATH });
    expect(Array.from(stored.bytes)).toEqual([1, 2, 3]);
    expect(stored.options).toMatchObject({ contentType: 'image/jpeg', upsert: true });
    expect(stored.metadata).toMatchObject({
      id: ASSET_ID,
      household_id: 'household-1',
      receipt_id: 'receipt-1',
      storage_path: STORAGE_PATH,
      mime_type: 'image/jpeg',
      byte_size: 3,
      sort_order: 0,
      created_by: 'user-1',
    });
  });
});
