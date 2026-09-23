import type { TypedSupabaseClient } from '@/lib/backend/supabase/client';
import { debugLogEvent } from '@/lib/observability/debug-log';
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

type ReceiptAssetUploadStage = 'storage_upload' | 'metadata_upsert';

type ReceiptAssetUploadError = Error & {
  code: string;
  stage: ReceiptAssetUploadStage;
  providerCode?: string;
  status?: number;
  rawMessage?: string;
};

const RECEIPT_ASSET_PARENT_PENDING_CODE = 'receipt_asset_parent_pending';

function providerField(error: unknown, field: 'code' | 'error' | 'status' | 'statusCode'): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as Record<string, unknown>)[field];
}

function providerStatus(error: unknown): number | undefined {
  const value = providerField(error, 'status') ?? providerField(error, 'statusCode');
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/u.test(value)) return Number(value);
  return undefined;
}

function providerCode(error: unknown): string | undefined {
  const value = providerField(error, 'code') ?? providerField(error, 'error');
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  if (typeof error === 'object' && error !== null) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
  return 'Receipt asset upload failed.';
}

function isResponseParseFailure(error: unknown): boolean {
  return /parsen der antwort|parse response|response.*parse/iu.test(errorMessage(error));
}

function isReceiptAssetUploadError(error: unknown): error is ReceiptAssetUploadError {
  return (
    error instanceof Error &&
    (error as Partial<ReceiptAssetUploadError>).stage !== undefined &&
    (error as Partial<ReceiptAssetUploadError>).code !== undefined
  );
}

function friendlyStageError(
  stage: ReceiptAssetUploadStage,
  kind: 'network' | 'response_parse' | 'parent_pending' | 'request_rejected',
  providerCode?: string,
): string {
  if (kind === 'parent_pending') {
    return 'Der Kassenbon ist noch nicht synchronisiert. Der Bon wurde lokal gespeichert; die Bilder können nach der Synchronisierung erneut hochgeladen werden.';
  }

  if (stage === 'storage_upload') {
    if (kind === 'request_rejected') {
      // Storage liefert bei konfigurierbaren Ursachen einen maschinenlesbaren
      // Code (NoSuchBucket, InvalidRequest, ...). Nur dann ist die Meldung
      // eindeutig; der generische 400er-Fall bleibt bewusst vage.
      if (providerCode === 'NoSuchBucket') {
        return 'Der Bild-Speicher (Bucket) ist auf dem Server nicht eingerichtet. Bitte melde das an den Support — der Bon wurde lokal gespeichert.';
      }
      return 'Supabase Storage hat den Bild-Upload abgelehnt. Prüfe Dateiformat, Upload-Pfad und Bucket-Berechtigung.';
    }
    return kind === 'network'
      ? 'Die Verbindung zu Supabase Storage konnte nicht hergestellt werden. Prüfe die Netzwerkverbindung und versuche es erneut.'
      : 'Supabase Storage konnte die Bild-Upload-Antwort nicht bestätigen. Bitte versuche es erneut.';
  }

  if (kind === 'request_rejected') {
    return 'Supabase konnte die Bonbild-Daten nicht speichern, weil die Serveranfrage abgelehnt wurde.';
  }

  return kind === 'network'
    ? 'Die Bonbild-Daten konnten nach dem Upload nicht bestätigt werden. Prüfe die Netzwerkverbindung und versuche es erneut.'
    : 'Die Bonbild-Daten konnten nach dem Upload nicht bestätigt werden. Bitte versuche es erneut.';
}

function stageError(stage: ReceiptAssetUploadStage, error: unknown): ReceiptAssetUploadError {
  if (isReceiptAssetUploadError(error)) return error;

  const rawMessage = errorMessage(error);
  const code = providerCode(error);
  const isNetworkFailure = /network request failed|fetch failed/iu.test(rawMessage);
  const responseParseFailure = isResponseParseFailure(error);
  const isParentPending =
    code === RECEIPT_ASSET_PARENT_PENDING_CODE ||
    /receipt_assets_receipt_household_fkey/iu.test(rawMessage);
  const status = providerStatus(error);
  const requestRejected =
    status === 400 || code === 'InvalidRequest' || /bad request/iu.test(rawMessage);
  const message = isParentPending
    ? friendlyStageError(stage, 'parent_pending')
    : isNetworkFailure
      ? friendlyStageError(stage, 'network')
      : responseParseFailure
        ? friendlyStageError(stage, 'response_parse')
        : requestRejected
          ? friendlyStageError(stage, 'request_rejected', code)
          : rawMessage;
  const wrapped = new Error(message, { cause: error }) as ReceiptAssetUploadError;
  wrapped.name = 'ReceiptAssetUploadError';
  wrapped.code = `receipt_asset_${stage}_failed`;
  wrapped.stage = stage;
  wrapped.rawMessage = rawMessage;

  if (isParentPending) wrapped.providerCode = RECEIPT_ASSET_PARENT_PENDING_CODE;
  else if (code) wrapped.providerCode = code;
  else if (isNetworkFailure) wrapped.providerCode = 'network_request_failed';
  else if (responseParseFailure) wrapped.providerCode = 'response_parse_failed';
  if (status !== undefined) wrapped.status = status;
  return wrapped;
}

function shouldConfirmExistingStorageObject(error: unknown): boolean {
  return isResponseParseFailure(error) || providerStatus(error) === 400;
}

// iOS URLSession verwendet gepoolte Keep-Alive-Verbindungen wieder, die der
// Server nach Leerlauf (OCR, Parent-Sync) bereits geschlossen hat. Idempotente
// Requests wiederholt iOS selbst, einen POST mit Body nicht: Er scheitert mit
// "Netzwerkverbindung unterbrochen" (-1005) oder "Parsen der Antwort" (-1017),
// ohne den Server zu erreichen. Deterministischer Pfad + upsert machen den
// erneuten Versuch sicher.
const TRANSIENT_UPLOAD_RETRY_DELAYS_MS = [250, 1000] as const;

function isTransientTransportFailure(error: unknown): boolean {
  if (providerStatus(error) !== undefined) return false;
  return (
    isResponseParseFailure(error) ||
    /network request failed|fetch failed|verbindung wurde unterbrochen|connection (was )?lost|timed out|zeitüberschreitung/iu.test(
      errorMessage(error),
    )
  );
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function runUploadStage<T>(
  stage: ReceiptAssetUploadStage,
  details: Record<string, unknown>,
  operation: () => Promise<T>,
): Promise<T> {
  debugLogEvent('receipt.capture.asset_upload.started', { stage, ...details });
  try {
    const result = await operation();
    debugLogEvent('receipt.capture.asset_upload.completed', { stage, ...details });
    return result;
  } catch (error: unknown) {
    const wrapped = stageError(stage, error);
    debugLogEvent('receipt.capture.asset_upload.failed', {
      stage,
      ...details,
      error_type: wrapped.name,
      error_code: wrapped.code,
      ...(wrapped.providerCode ? { provider_code: wrapped.providerCode } : {}),
      ...(wrapped.status === undefined ? {} : { status: wrapped.status }),
      error_message: wrapped.message,
      ...(wrapped.rawMessage ? { raw_error_message: wrapped.rawMessage } : {}),
    });
    throw wrapped;
  }
}

async function assertReceiptParentIsRemote(
  client: TypedSupabaseClient,
  input: ReceiptAssetUploadInput,
): Promise<void> {
  const response = await client
    .from('purchase_receipts')
    .select('id, household_id')
    .eq('id', input.receiptId)
    .eq('household_id', input.householdId)
    .maybeSingle();
  if (response.error) throw response.error;
  if (response.data) return;

  const error = new Error(
    'Receipt parent is not available on the server yet; defer receipt asset upload.',
  ) as Error & { code?: string };
  error.code = RECEIPT_ASSET_PARENT_PENDING_CODE;
  throw error;
}

async function uploadStorageObject(
  client: TypedSupabaseClient,
  input: ReceiptAssetUploadInput,
): Promise<void> {
  const sessionResult = await client.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  const accessToken = sessionResult.data.session?.access_token;
  if (!accessToken) {
    const error = new Error('Supabase session is missing for receipt asset upload.') as Error & {
      code?: string;
    };
    error.code = 'receipt_asset_storage_auth_missing';
    throw error;
  }

  await assertReceiptParentIsRemote(client, input);

  const storage = client.storage.from(RECEIPT_ASSET_BUCKET);
  const upload = async () =>
    storage.upload(input.storagePath, input.bytes, {
      cacheControl: '3600',
      contentType: input.mimeType,
      upsert: true,
    });

  type UploadResult = Awaited<ReturnType<typeof upload>>;
  const attemptUpload = async (): Promise<UploadResult> => {
    try {
      return await upload();
    } catch (error: unknown) {
      // storage-js liefert Fehler meist als Result, einzelne Transportfehler
      // werden aber geworfen. Beide Wege landen im selben Result-Pfad.
      return { data: null, error } as UploadResult;
    }
  };

  let uploadResult = await attemptUpload();
  for (const delayMs of TRANSIENT_UPLOAD_RETRY_DELAYS_MS) {
    if (!uploadResult.error || !isTransientTransportFailure(uploadResult.error)) break;
    debugLogEvent('receipt.capture.asset_upload.transport_retry', {
      byte_size: input.byteSize,
      sort_order: input.sortOrder,
      delay_ms: delayMs,
      raw_error_message: errorMessage(uploadResult.error),
    });
    await wait(delayMs);
    uploadResult = await attemptUpload();
  }

  if (!uploadResult.error) return;

  if (shouldConfirmExistingStorageObject(uploadResult.error)) {
    // Recovery-Versuch: existiert das Objekt bereits (z. B. Retry nach
    // Teilfehler), ist der Upload faktisch erfolgreich. Der Check selbst ist
    // best-effort — schlaegt er fehl, zaehlt der urspruengliche Upload-Fehler,
    // nicht der Check-Fehler (sonst maskiert ein Verifikationsproblem den
    // echten Befund).
    let existsResult: Awaited<ReturnType<typeof storage.exists>>;
    try {
      existsResult = await storage.exists(input.storagePath);
    } catch {
      throw uploadResult.error;
    }
    if (existsResult.data) {
      const event = isResponseParseFailure(uploadResult.error)
        ? 'receipt.capture.asset_upload.response_parse_recovered'
        : 'receipt.capture.asset_upload.storage_object_recovered';
      debugLogEvent(event, {
        byte_size: input.byteSize,
        sort_order: input.sortOrder,
        transport: 'supabase_storage_client',
        ...(providerCode(uploadResult.error)
          ? { provider_code: providerCode(uploadResult.error) }
          : {}),
        ...(providerStatus(uploadResult.error) === undefined
          ? {}
          : { status: providerStatus(uploadResult.error) }),
      });
      return;
    }
  }

  throw uploadResult.error;
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

      await runUploadStage(
        'storage_upload',
        {
          byte_size: input.byteSize,
          mime_type: input.mimeType,
          sort_order: input.sortOrder,
          transport: 'supabase_storage_client',
        },
        () => uploadStorageObject(client, input),
      );

      const metadataResponse = await runUploadStage(
        'metadata_upsert',
        { byte_size: input.byteSize, sort_order: input.sortOrder },
        async () => {
          const response = await client
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
          if (response.error) throw response.error;
          if (!response.data?.id || !response.data.storage_path) {
            throw new Error('Supabase returned incomplete receipt asset metadata.');
          }
          return { data: response.data };
        },
      );

      const { data } = metadataResponse;
      return { assetId: data.id, storagePath: data.storage_path };
    },
  };
}
