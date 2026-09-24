import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import { createSupabaseReceiptAssetUploadAdapter } from './supabase-upload';

jest.mock('@/lib/observability/debug-log', () => ({
  debugLogEvent: jest.fn(),
}));

const { debugLogEvent: mockDebugLogEvent } = jest.requireMock('@/lib/observability/debug-log') as {
  debugLogEvent: jest.Mock;
};

const ASSET_ID = '00000000-0000-5000-8000-000000000001';
const STORAGE_PATH = `household-1/receipt-1/${ASSET_ID}.jpg`;

function createStorageMock(options?: {
  uploadResult?: { data: unknown; error: unknown };
  existsResult?: { data: boolean; error: unknown };
}) {
  const upload = jest.fn().mockResolvedValue(
    options?.uploadResult ?? {
      data: { id: ASSET_ID, path: STORAGE_PATH, fullPath: `receipt-images/${STORAGE_PATH}` },
      error: null,
    },
  );
  const exists = jest.fn().mockResolvedValue(options?.existsResult ?? { data: false, error: null });
  return {
    upload,
    exists,
    storage: { from: jest.fn(() => ({ upload, exists })) },
  };
}

function createUploadClient(storage: {
  from: (bucket: string) => { upload: unknown; exists: unknown };
}): TypedSupabaseClient {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'access-token' } },
        error: null,
      }),
    },
    storage,
    from: (table: string) => {
      if (table === 'purchase_receipts') {
        const parentQuery = {
          select: () => parentQuery,
          eq: () => parentQuery,
          maybeSingle: async () => ({
            data: { id: 'receipt-1', household_id: 'household-1' },
            error: null,
          }),
        };
        return parentQuery;
      }
      const query = {
        upsert: () => query,
        select: () => query,
        single: async () => ({
          data: { id: ASSET_ID, storage_path: STORAGE_PATH },
          error: null,
        }),
      };
      return query;
    },
  } as unknown as TypedSupabaseClient;
}

describe('Supabase receipt asset upload adapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockDebugLogEvent.mockClear();
  });

  it('uses the Supabase Storage client transport for receipt images', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response);
    const storageUpload = jest.fn().mockResolvedValue({
      data: { id: ASSET_ID, path: STORAGE_PATH, fullPath: `receipt-images/${STORAGE_PATH}` },
      error: null,
    });
    const storageExists = jest.fn();
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      storage: {
        from: (bucket: string) => {
          expect(bucket).toBe('receipt-images');
          return { upload: storageUpload, exists: storageExists };
        },
      },
      from: (table: string) => {
        if (table === 'purchase_receipts') {
          const parentQuery = {
            select: () => parentQuery,
            eq: () => parentQuery,
            maybeSingle: async () => ({
              data: { id: 'receipt-1', household_id: 'household-1' },
              error: null,
            }),
          };
          return parentQuery;
        }
        const query = {
          upsert: () => query,
          select: () => query,
          single: async () => ({
            data: { id: ASSET_ID, storage_path: STORAGE_PATH },
            error: null,
          }),
        };
        return query;
      },
    } as unknown as TypedSupabaseClient;

    await createSupabaseReceiptAssetUploadAdapter(client).upload({
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

    expect(storageUpload).toHaveBeenCalledWith(STORAGE_PATH, expect.any(Uint8Array), {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(storageExists).not.toHaveBeenCalled();
  });

  it('recovers a native response-parse failure when Storage confirms the object exists', async () => {
    const storage = createStorageMock({
      uploadResult: {
        data: null,
        error: new Error('Parsen der Antwort nicht möglich'),
      },
      existsResult: { data: true, error: null },
    });
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      storage: storage.storage,
      from: (table: string) => {
        if (table === 'purchase_receipts') {
          const parentQuery = {
            select: () => parentQuery,
            eq: () => parentQuery,
            maybeSingle: async () => ({
              data: { id: 'receipt-1', household_id: 'household-1' },
              error: null,
            }),
          };
          return parentQuery;
        }
        const query = {
          upsert: () => query,
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
    expect(storage.exists).toHaveBeenCalledWith(STORAGE_PATH);
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'receipt.capture.asset_upload.response_parse_recovered',
      expect.objectContaining({ transport: 'supabase_storage_client' }),
    );
  });

  it('recovers a Storage bad request when the deterministic object already exists', async () => {
    const storage = createStorageMock({
      uploadResult: {
        data: null,
        error: Object.assign(new Error('Bad Request'), {
          error: 'Duplicate',
          statusCode: '400',
        }),
      },
      existsResult: { data: true, error: null },
    });
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      storage: storage.storage,
      from: (table: string) => {
        if (table === 'purchase_receipts') {
          const parentQuery = {
            select: () => parentQuery,
            eq: () => parentQuery,
            maybeSingle: async () => ({
              data: { id: 'receipt-1', household_id: 'household-1' },
              error: null,
            }),
          };
          return parentQuery;
        }
        const query = {
          upsert: () => query,
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
    expect(storage.exists).toHaveBeenCalledWith(STORAGE_PATH);
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'receipt.capture.asset_upload.storage_object_recovered',
      expect.objectContaining({ provider_code: 'Duplicate', status: 400 }),
    );
  });

  it('preserves structured Storage bad-request diagnostics when the object is absent', async () => {
    const storage = createStorageMock({
      uploadResult: {
        data: null,
        error: Object.assign(new Error('Bad Request'), {
          error: 'InvalidRequest',
          statusCode: '400',
        }),
      },
      existsResult: { data: false, error: null },
    });
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      storage: storage.storage,
      from: (table: string) => {
        if (table === 'purchase_receipts') {
          const parentQuery = {
            select: () => parentQuery,
            eq: () => parentQuery,
            maybeSingle: async () => ({
              data: { id: 'receipt-1', household_id: 'household-1' },
              error: null,
            }),
          };
          return parentQuery;
        }
        const query = {
          upsert: () => query,
          select: () => query,
          single: async () => ({
            data: { id: ASSET_ID, storage_path: STORAGE_PATH },
            error: null,
          }),
        };
        return query;
      },
    } as unknown as TypedSupabaseClient;

    const upload = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

    await expect(upload).rejects.toMatchObject({
      code: 'receipt_asset_storage_upload_failed',
      stage: 'storage_upload',
      providerCode: 'InvalidRequest',
      status: 400,
    });
    await expect(upload).rejects.toThrow(
      'Supabase Storage hat den Bild-Upload abgelehnt. Prüfe Dateiformat, Upload-Pfad und Bucket-Berechtigung.',
    );
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'receipt.capture.asset_upload.failed',
      expect.objectContaining({
        stage: 'storage_upload',
        provider_code: 'InvalidRequest',
        status: 400,
      }),
    );
  });

  it('reports the original upload failure when the existence check itself fails', async () => {
    // Recovery-Szenario aus der Praxis: Upload meldet 400, der best-effort
    // Existenz-Check schlaegt ebenfalls fehl (z. B. RLS/Netzwerk). Der Check
    // ist kein neuer Befund — der urspruengliche Upload-Fehler muss durchreichen.
    const storage = createStorageMock({
      uploadResult: {
        data: null,
        error: Object.assign(new Error('Bad Request'), {
          error: 'InvalidRequest',
          statusCode: '400',
        }),
      },
      existsResult: { data: false, error: new Error('existence check failed') },
    });
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      storage: storage.storage,
      from: (table: string) => {
        if (table === 'purchase_receipts') {
          const parentQuery = {
            select: () => parentQuery,
            eq: () => parentQuery,
            maybeSingle: async () => ({
              data: { id: 'receipt-1', household_id: 'household-1' },
              error: null,
            }),
          };
          return parentQuery;
        }
        const query = {
          upsert: () => query,
          select: () => query,
          single: async () => ({
            data: { id: ASSET_ID, storage_path: STORAGE_PATH },
            error: null,
          }),
        };
        return query;
      },
    } as unknown as TypedSupabaseClient;

    const upload = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

    await expect(upload).rejects.toMatchObject({
      code: 'receipt_asset_storage_upload_failed',
      stage: 'storage_upload',
      providerCode: 'InvalidRequest',
      status: 400,
    });
    expect(storage.exists).toHaveBeenCalledWith(STORAGE_PATH);
  });

  it('stores bytes and household-scoped metadata with the deterministic asset identity', async () => {
    const storage = createStorageMock();
    const stored = {
      metadata: {} as Record<string, unknown>,
    };
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      from: (table: string) => {
        if (table === 'purchase_receipts') {
          const parentQuery = {
            select: () => parentQuery,
            eq: () => parentQuery,
            maybeSingle: async () => ({
              data: { id: 'receipt-1', household_id: 'household-1' },
              error: null,
            }),
          };
          return parentQuery;
        }
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
      storage: storage.storage,
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
    expect(storage.upload).toHaveBeenCalledWith(STORAGE_PATH, expect.any(Uint8Array), {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: true,
    });
    expect(storage.upload.mock.calls[0]?.[1]).toEqual(new Uint8Array([1, 2, 3]));
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

  it('marks a native/network failure at the storage stage', async () => {
    const storage = createStorageMock();
    storage.upload.mockRejectedValue(new Error('fetch failed: UnexpectedException'));
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      from: () => {
        const parentQuery = {
          select: () => parentQuery,
          eq: () => parentQuery,
          maybeSingle: async () => ({
            data: { id: 'receipt-1', household_id: 'household-1' },
            error: null,
          }),
        };
        return parentQuery;
      },
      storage: storage.storage,
    } as unknown as TypedSupabaseClient;

    const upload = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

    await expect(upload).rejects.toThrow(
      'Die Verbindung zu Supabase Storage konnte nicht hergestellt werden',
    );
    await expect(upload).rejects.toMatchObject({
      code: 'receipt_asset_storage_upload_failed',
      stage: 'storage_upload',
      providerCode: 'network_request_failed',
    });
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'receipt.capture.asset_upload.failed',
      expect.objectContaining({
        stage: 'storage_upload',
        transport: 'supabase_storage_client',
        provider_code: 'network_request_failed',
        error_message: expect.stringContaining('Supabase Storage'),
        raw_error_message: 'fetch failed: UnexpectedException',
      }),
    );
  });

  it('retries a transient transport failure and succeeds on the second attempt', async () => {
    // Live-Befund: Expo-Fetch liefert gelegentlich "Parsen der Antwort nicht
    // moeglich" bei binaeren Responses. Der deterministische Pfad + upsert
    // machen den erneuten Versuch sicher; der Retry muss den Upload retten.
    jest.useFakeTimers();
    try {
      const storage = createStorageMock();
      storage.upload
        .mockRejectedValueOnce(new Error('fetch failed: Parsen der Antwort nicht möglich'))
        .mockResolvedValueOnce({
          data: { id: ASSET_ID, path: STORAGE_PATH, fullPath: `receipt-images/${STORAGE_PATH}` },
          error: null,
        });
      const client = createUploadClient(storage.storage);

      const uploadPromise = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

      const result = await jest.runAllTimersAsync().then(() => uploadPromise);

      expect(result).toEqual({ assetId: ASSET_ID, storagePath: STORAGE_PATH });
      expect(storage.upload).toHaveBeenCalledTimes(2);
      expect(mockDebugLogEvent).toHaveBeenCalledWith(
        'receipt.capture.asset_upload.transport_retry',
        expect.objectContaining({ delay_ms: 250 }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not retry a deterministic bad request', async () => {
    // Ein 400er ist deterministisch: Retry wuerde dreimal dieselbe Ablehnung
    // produzieren und nur Wartezeit kosten. Der Fehler muss sofort durchreichen.
    const storage = createStorageMock();
    storage.upload.mockRejectedValue(Object.assign(new Error('Bad Request'), { statusCode: 400 }));
    const client = createUploadClient(storage.storage);

    const upload = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

    await expect(upload).rejects.toMatchObject({
      code: 'receipt_asset_storage_upload_failed',
      stage: 'storage_upload',
      status: 400,
    });
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(mockDebugLogEvent).not.toHaveBeenCalledWith(
      'receipt.capture.asset_upload.transport_retry',
      expect.anything(),
    );
  });

  it('exhausts transport retries and reports the last failure', async () => {
    // Bleibt der Transport dauerhaft gestoert, muss der letzte Versuch den
    // Fehler liefern — nicht haengen, nicht still Erfolg melden.
    jest.useFakeTimers();
    try {
      const storage = createStorageMock();
      storage.upload.mockRejectedValue(
        new Error('fetch failed: Die Netzwerkverbindung wurde unterbrochen'),
      );
      const client = createUploadClient(storage.storage);

      const uploadPromise = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

      // rejects() muss die Promise sofort attachen, sonst entkommt die
      // Rejection als unhandled rejection, bevor runAllTimersAsync sie faengt.
      const assertion = expect(uploadPromise).rejects.toMatchObject({
        code: 'receipt_asset_storage_upload_failed',
        stage: 'storage_upload',
        providerCode: 'network_request_failed',
      });
      await jest.runAllTimersAsync();
      await assertion;
      expect(storage.upload).toHaveBeenCalledTimes(3);
      expect(mockDebugLogEvent).toHaveBeenCalledWith(
        'receipt.capture.asset_upload.transport_retry',
        expect.objectContaining({ delay_ms: 1000 }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('defers the asset upload while the receipt parent is still pending remote sync', async () => {
    const storage = createStorageMock();
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      from: (table: string) => {
        expect(table).toBe('purchase_receipts');
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return query;
      },
      storage: storage.storage,
    } as unknown as TypedSupabaseClient;

    const upload = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

    await expect(upload).rejects.toMatchObject({
      code: 'receipt_asset_storage_upload_failed',
      stage: 'storage_upload',
      providerCode: 'receipt_asset_parent_pending',
    });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(mockDebugLogEvent).toHaveBeenCalledWith(
      'receipt.capture.asset_upload.failed',
      expect.objectContaining({
        error_code: 'receipt_asset_storage_upload_failed',
        provider_code: 'receipt_asset_parent_pending',
      }),
    );
  });

  it('marks a metadata failure separately after storage succeeds', async () => {
    const storage = createStorageMock();
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      from: (table: string) => {
        if (table === 'purchase_receipts') {
          const parentQuery = {
            select: () => parentQuery,
            eq: () => parentQuery,
            maybeSingle: async () => ({
              data: { id: 'receipt-1', household_id: 'household-1' },
              error: null,
            }),
          };
          return parentQuery;
        }
        const query = {
          upsert: () => query,
          select: () => query,
          single: async () => {
            throw new Error('metadata response could not be parsed');
          },
        };
        return query;
      },
      storage: storage.storage,
    } as unknown as TypedSupabaseClient;

    const upload = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

    await expect(upload).rejects.toThrow(
      'Die Bonbild-Daten konnten nach dem Upload nicht bestätigt werden',
    );
    await expect(upload).rejects.toMatchObject({
      code: 'receipt_asset_metadata_upsert_failed',
      stage: 'metadata_upsert',
    });
  });

  it('classifies a receipt parent foreign-key race as pending sync', async () => {
    const storage = createStorageMock();
    const client = {
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'access-token' } },
          error: null,
        }),
      },
      from: (table: string) => {
        if (table === 'purchase_receipts') {
          const parentQuery = {
            select: () => parentQuery,
            eq: () => parentQuery,
            maybeSingle: async () => ({
              data: { id: 'receipt-1', household_id: 'household-1' },
              error: null,
            }),
          };
          return parentQuery;
        }
        const query = {
          upsert: () => query,
          select: () => query,
          single: async () => ({
            data: null,
            error: {
              code: '23503',
              message:
                'insert or update on table "receipt_assets" violates foreign key constraint "receipt_assets_receipt_household_fkey"',
            },
          }),
        };
        return query;
      },
      storage: storage.storage,
    } as unknown as TypedSupabaseClient;

    const upload = createSupabaseReceiptAssetUploadAdapter(client).upload({
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

    await expect(upload).rejects.toThrow('Der Kassenbon ist noch nicht synchronisiert');
    await expect(upload).rejects.toMatchObject({
      code: 'receipt_asset_metadata_upsert_failed',
      stage: 'metadata_upsert',
      providerCode: 'receipt_asset_parent_pending',
    });
  });
});
