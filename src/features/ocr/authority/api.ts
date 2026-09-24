import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TypedSupabaseClient } from '@/lib/backend/supabase/client';
import type { Database } from '@/lib/database.types';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation, enqueueMutationStepsInExclusiveTransaction } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import type { ReceiptItemReviewStatus, ReceiptProcessingStatus } from './domain/status';
import {
  canTransitionReceiptItemReviewStatus,
  canTransitionReceiptStatus,
  receiptItemReviewStatusAfterCorrection,
  receiptStatusAfterCorrection,
} from './domain/status';
import { assertEuroCents, RECEIPT_CURRENCY } from './domain/types';

const RECEIPT_ASSET_BUCKET = 'receipt-images';
export const RECEIPT_ASSET_SIGNED_URL_TTL_SECONDS = 60 * 60;

export type LocalReceiptRow = {
  id: string;
  household_id: string;
  store_id: string | null;
  store_name: string | null;
  purchase_date: string | null;
  currency: string;
  total_cents: number | null;
  processing_status: ReceiptProcessingStatus;
  created_by: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: number;
  deleted_at: number | null;
  _dirty: number;
};

export type LocalReceiptItemRow = {
  id: string;
  receipt_id: string;
  household_id: string;
  position: number;
  name: string;
  product_id: string | null;
  category_id: string | null;
  quantity: number | null;
  unit: string | null;
  package_size: number | null;
  package_size_unit: string | null;
  line_total_cents: number | null;
  review_status: ReceiptItemReviewStatus;
  created_at: string;
  updated_at: number;
  deleted_at: number | null;
  _dirty: number;
};

export type LocalConfirmedReceiptItemRow = LocalReceiptItemRow & {
  product_name: string | null;
  product_brand: string | null;
};

export type ReceiptAssetRow = Database['public']['Tables']['receipt_assets']['Row'];

export type ReceiptApiDependencies = {
  db?: SqlDatabase;
  supabase?: TypedSupabaseClient;
  now?: () => Date;
};

export type CreateReceiptInput = {
  id: string;
  householdId: string;
  createdBy: string;
  currency?: typeof RECEIPT_CURRENCY;
  storeId?: string | null;
  purchaseDate?: string | null;
  totalCents?: number | null;
  processingStatus?: ReceiptProcessingStatus;
};

export type UpdateReceiptInput = {
  householdId: string;
  receiptId: string;
  changes: {
    storeId?: string | null;
    purchaseDate?: string | null;
    totalCents?: number | null;
  };
};

export type CreateReceiptItemInput = {
  id: string;
  receiptId: string;
  householdId: string;
  position: number;
  name: string;
  productId?: string | null;
  categoryId?: string | null;
  quantity?: number | null;
  unit?: string | null;
  packageSize?: number | null;
  packageSizeUnit?: string | null;
  lineTotalCents?: number | null;
  reviewStatus?: ReceiptItemReviewStatus;
};

export type UpdateReceiptItemInput = {
  householdId: string;
  itemId: string;
  changes: {
    position?: number;
    name?: string;
    productId?: string | null;
    categoryId?: string | null;
    quantity?: number | null;
    unit?: string | null;
    packageSize?: number | null;
    packageSizeUnit?: string | null;
    lineTotalCents?: number | null;
  };
};

export type ReceiptReference = {
  householdId: string;
  receiptId: string;
};

export type ReceiptItemReference = {
  householdId: string;
  itemId: string;
};

export type ConfirmReceiptInput = ReceiptReference & { confirmedBy: string };

export type SaveReceiptReviewInput = {
  receipt: CreateReceiptInput;
  items: readonly CreateReceiptItemInput[];
  confirmedBy: string;
};

export type SaveReceiptReviewResult = {
  receipt: LocalReceiptRow;
  itemIds: readonly string[];
};

export type ReceiptAssetReference = {
  householdId: string;
  receiptId: string;
};

export type ReceiptAssetSignedUrlInput = ReceiptAssetReference & { storagePath: string };

export type DeleteReceiptAssetInput = ReceiptAssetSignedUrlInput & { assetId: string };

export function receiptsQueryKey(householdId: string | undefined) {
  return ['receipt-authority', 'receipts', householdId] as const;
}

export function confirmedReceiptsQueryKey(householdId: string | undefined) {
  return ['receipt-authority', 'confirmed-receipts', householdId] as const;
}

export function receiptQueryKey(householdId: string | undefined, receiptId: string | undefined) {
  return ['receipt-authority', 'receipt', householdId, receiptId] as const;
}

export function receiptItemsQueryKey(
  householdId: string | undefined,
  receiptId: string | undefined,
) {
  return ['receipt-authority', 'receipt-items', householdId, receiptId] as const;
}

export function receiptAssetsQueryKey(
  householdId: string | undefined,
  receiptId: string | undefined,
) {
  return ['receipt-authority', 'receipt-assets', householdId, receiptId] as const;
}

export function receiptAssetSignedUrlQueryKey(
  householdId: string | undefined,
  receiptId: string | undefined,
  assetId: string,
) {
  return [...receiptAssetsQueryKey(householdId, receiptId), 'signed-url', assetId] as const;
}

function timestamps(deps: ReceiptApiDependencies): { iso: string; milliseconds: number } {
  const date = deps.now?.() ?? new Date();
  const milliseconds = date.getTime();
  if (!Number.isFinite(milliseconds)) throw new Error('Ein gültiger Zeitstempel ist erforderlich.');
  return { iso: date.toISOString(), milliseconds };
}

async function databaseFor(deps: ReceiptApiDependencies): Promise<SqlDatabase> {
  return deps.db ?? getDatabase();
}

function supabaseFor(deps: ReceiptApiDependencies): TypedSupabaseClient {
  if (deps.supabase) return deps.supabase;
  // Die Supabase-Client-Datei importiert React-Native-AppState. Der Receipt-
  // API-Port bleibt deshalb fuer Node-/SQLite-Integrationstests bis zum
  // tatsächlichen Online-Zugriff frei von nativen Ladezeit-Abhängigkeiten.
  const { getSupabase } =
    require('@/lib/backend/supabase/client') as typeof import('@/lib/backend/supabase/client');
  return getSupabase();
}

function requireText(value: string, field: string): string {
  if (value.trim().length === 0) throw new Error(`${field} ist erforderlich.`);
  return value;
}

function requireCents(value: number | null | undefined, field: string): void {
  if (value !== null && value !== undefined) assertEuroCents(value, field);
}

function requirePosition(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Position muss eine nichtnegative Ganzzahl sein.');
  }
}

function requirePositiveNumber(value: number | null | undefined, field: string): void {
  if (value !== null && value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error(`${field} muss positiv sein.`);
  }
}

async function enqueueStructuredMutation(
  db: SqlDatabase,
  input: {
    entity: 'purchase_receipts' | 'purchase_receipt_items';
    entityId: string;
    op: 'insert' | 'update' | 'delete' | 'restore';
    payload: Record<string, unknown>;
    now: { iso: string; milliseconds: number };
  },
): Promise<void> {
  await enqueueMutation(db, {
    entity: input.entity,
    entityId: input.entityId,
    op: input.op,
    payload: input.payload,
    now: input.now.milliseconds,
    applyLocally: (txn) =>
      applyLocalMirrorWrite(txn, input.entity, input.op, input.payload, input.now.milliseconds),
  });
}

function structuredMutation(input: {
  entity: 'purchase_receipts' | 'purchase_receipt_items';
  entityId: string;
  op: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  now: { iso: string; milliseconds: number };
}) {
  return {
    entity: input.entity,
    entityId: input.entityId,
    op: input.op,
    payload: input.payload,
    now: input.now.milliseconds,
    applyLocally: (txn: SqlDatabase) =>
      applyLocalMirrorWrite(txn, input.entity, input.op, input.payload, input.now.milliseconds),
  } as const;
}

export async function getReceipts(
  db: SqlDatabase,
  householdId: string,
): Promise<LocalReceiptRow[]> {
  requireText(householdId, 'Haushalt');
  return db.getAllAsync<LocalReceiptRow>(
    `select r.id, r.household_id, r.store_id, s.name as store_name,
            r.purchase_date, r.currency, r.total_cents, r.processing_status,
            r.created_by, r.confirmed_by, r.confirmed_at, r.created_at,
            r.updated_at, r.deleted_at, r._dirty
       from purchase_receipts r
       left join stores s
         on s.id = r.store_id
        and s.household_id = r.household_id
        and s.deleted_at is null
      where r.household_id = ? and r.deleted_at is null
      order by r.purchase_date desc, r.created_at desc, r.id asc`,
    [householdId],
  );
}

export async function getConfirmedReceipts(
  db: SqlDatabase,
  householdId: string,
): Promise<LocalReceiptRow[]> {
  requireText(householdId, 'Haushalt');
  return db.getAllAsync<LocalReceiptRow>(
    `select r.id, r.household_id, r.store_id, s.name as store_name,
            r.purchase_date, r.currency, r.total_cents, r.processing_status,
            r.created_by, r.confirmed_by, r.confirmed_at, r.created_at,
            r.updated_at, r.deleted_at, r._dirty
       from purchase_receipts r
       left join stores s
         on s.id = r.store_id
        and s.household_id = r.household_id
        and s.deleted_at is null
      where r.household_id = ?
        and r.processing_status = 'confirmed'
        and r.deleted_at is null
      order by r.purchase_date desc, r.created_at desc, r.id asc`,
    [householdId],
  );
}

export async function getReceipt(
  db: SqlDatabase,
  householdId: string,
  receiptId: string,
): Promise<LocalReceiptRow | null> {
  requireText(householdId, 'Haushalt');
  requireText(receiptId, 'Receipt');
  return db.getFirstAsync<LocalReceiptRow>(
    `select r.id, r.household_id, r.store_id, s.name as store_name,
            r.purchase_date, r.currency, r.total_cents, r.processing_status,
            r.created_by, r.confirmed_by, r.confirmed_at, r.created_at,
            r.updated_at, r.deleted_at, r._dirty
       from purchase_receipts r
       left join stores s
         on s.id = r.store_id
        and s.household_id = r.household_id
        and s.deleted_at is null
      where r.household_id = ? and r.id = ? and r.deleted_at is null`,
    [householdId, receiptId],
  );
}

export async function getReceiptItems(
  db: SqlDatabase,
  householdId: string,
  receiptId: string,
): Promise<LocalReceiptItemRow[]> {
  requireText(householdId, 'Haushalt');
  requireText(receiptId, 'Receipt');
  return db.getAllAsync<LocalReceiptItemRow>(
    `select id, receipt_id, household_id, position, name, product_id, category_id,
            quantity, unit, package_size, package_size_unit, line_total_cents,
            review_status, created_at, updated_at, deleted_at, _dirty
       from purchase_receipt_items
      where household_id = ? and receipt_id = ? and deleted_at is null
      order by position asc, created_at asc`,
    [householdId, receiptId],
  );
}

export async function getConfirmedReceiptItems(
  db: SqlDatabase,
  householdId: string,
  receiptId: string,
): Promise<LocalConfirmedReceiptItemRow[]> {
  requireText(householdId, 'Haushalt');
  requireText(receiptId, 'Receipt');
  return db.getAllAsync<LocalConfirmedReceiptItemRow>(
    `select i.id, i.receipt_id, i.household_id, i.position, i.name,
            i.product_id, i.category_id, i.quantity, i.unit, i.package_size,
            i.package_size_unit, i.line_total_cents, i.review_status,
            i.created_at, i.updated_at, i.deleted_at, i._dirty,
            p.name as product_name, p.brand as product_brand
       from purchase_receipt_items i
       left join products p on p.id = i.product_id and p.deleted_at is null
      where i.household_id = ?
        and i.receipt_id = ?
        and i.review_status = 'confirmed'
        and i.deleted_at is null
      order by i.position asc, i.created_at asc, i.id asc`,
    [householdId, receiptId],
  );
}

export async function createReceipt(
  input: CreateReceiptInput,
  deps: ReceiptApiDependencies = {},
): Promise<LocalReceiptRow> {
  requireText(input.id, 'Receipt-ID');
  requireText(input.householdId, 'Haushalt');
  requireText(input.createdBy, 'Ersteller');
  if (input.currency !== undefined && input.currency !== RECEIPT_CURRENCY) {
    throw new Error('Receipts verwenden ausschließlich EUR.');
  }
  requireCents(input.totalCents, 'total_cents');
  const now = timestamps(deps);
  const payload = {
    id: input.id,
    household_id: input.householdId,
    store_id: input.storeId ?? null,
    purchase_date: input.purchaseDate ?? null,
    currency: RECEIPT_CURRENCY,
    total_cents: input.totalCents ?? null,
    processing_status: input.processingStatus ?? 'draft',
    created_by: input.createdBy,
    confirmed_by: null,
    confirmed_at: null,
    created_at: now.iso,
  } satisfies Record<string, unknown>;

  await enqueueStructuredMutation(await databaseFor(deps), {
    entity: 'purchase_receipts',
    entityId: input.id,
    op: 'insert',
    payload,
    now,
  });

  const row = await getReceipt(await databaseFor(deps), input.householdId, input.id);
  if (!row) throw new Error('Receipt konnte lokal nicht angelegt werden.');
  return row;
}

export async function updateReceipt(
  input: UpdateReceiptInput,
  deps: ReceiptApiDependencies = {},
): Promise<LocalReceiptRow> {
  const db = await databaseFor(deps);
  const current = await getReceipt(db, input.householdId, input.receiptId);
  if (!current) throw new Error('Receipt wurde im Haushalt nicht gefunden.');

  const changes: Record<string, unknown> = {};
  if (input.changes.storeId !== undefined) changes.store_id = input.changes.storeId;
  if (input.changes.purchaseDate !== undefined) changes.purchase_date = input.changes.purchaseDate;
  if (input.changes.totalCents !== undefined) {
    requireCents(input.changes.totalCents, 'total_cents');
    changes.total_cents = input.changes.totalCents;
  }
  if (Object.keys(changes).length === 0)
    throw new Error('Mindestens eine Receipt-Änderung ist erforderlich.');

  const nextStatus = receiptStatusAfterCorrection(current.processing_status);
  if (nextStatus !== current.processing_status) {
    changes.processing_status = nextStatus;
    changes.confirmed_by = null;
    changes.confirmed_at = null;
  }
  const now = timestamps(deps);
  await enqueueStructuredMutation(db, {
    entity: 'purchase_receipts',
    entityId: input.receiptId,
    op: 'update',
    payload: { id: input.receiptId, household_id: input.householdId, ...changes },
    now,
  });

  const row = await getReceipt(db, input.householdId, input.receiptId);
  if (!row) throw new Error('Receipt konnte lokal nicht aktualisiert werden.');
  return row;
}

export async function confirmReceipt(
  input: ConfirmReceiptInput,
  deps: ReceiptApiDependencies = {},
): Promise<LocalReceiptRow> {
  requireText(input.confirmedBy, 'Bestätigendes Mitglied');
  const db = await databaseFor(deps);
  const current = await getReceipt(db, input.householdId, input.receiptId);
  if (!current) throw new Error('Receipt wurde im Haushalt nicht gefunden.');
  if (!canTransitionReceiptStatus(current.processing_status, 'confirmed')) {
    throw new Error(`Receipt kann aus ${current.processing_status} nicht bestätigt werden.`);
  }

  const now = timestamps(deps);
  await enqueueStructuredMutation(db, {
    entity: 'purchase_receipts',
    entityId: input.receiptId,
    op: 'update',
    payload: {
      id: input.receiptId,
      household_id: input.householdId,
      processing_status: 'confirmed',
      confirmed_by: input.confirmedBy,
      confirmed_at: now.iso,
    },
    now,
  });

  const row = await getReceipt(db, input.householdId, input.receiptId);
  if (!row) throw new Error('Receipt konnte lokal nicht bestätigt werden.');
  return row;
}

/**
 * Saves one reviewed receipt as a single local-first mutation batch. The
 * mirror rows and all matching outbox entries commit or roll back together,
 * so a retry cannot observe a half-written review.
 */
export async function saveReceiptReview(
  input: SaveReceiptReviewInput,
  deps: ReceiptApiDependencies = {},
): Promise<SaveReceiptReviewResult> {
  const receiptId = requireText(input.receipt.id, 'Receipt-ID');
  const householdId = requireText(input.receipt.householdId, 'Haushalt');
  const createdBy = requireText(input.receipt.createdBy, 'Ersteller');
  const confirmedBy = requireText(input.confirmedBy, 'Bestätigendes Mitglied');
  if (input.items.length === 0) throw new Error('Ein Receipt benötigt mindestens ein Item.');
  if (input.receipt.currency !== undefined && input.receipt.currency !== RECEIPT_CURRENCY) {
    throw new Error('Receipts verwenden ausschließlich EUR.');
  }
  requireCents(input.receipt.totalCents, 'total_cents');

  const itemIds = new Set<string>();
  for (const item of input.items) {
    if (requireText(item.receiptId, 'Receipt') !== receiptId) {
      throw new Error('Alle Receipt-Items müssen zum Receipt gehören.');
    }
    if (requireText(item.householdId, 'Haushalt') !== householdId) {
      throw new Error('Alle Receipt-Items müssen zum Haushalt gehören.');
    }
    const itemId = requireText(item.id, 'Item-ID');
    if (itemIds.has(itemId)) throw new Error(`Doppelte Item-ID: ${itemId}.`);
    itemIds.add(itemId);
    requireText(item.name, 'Item-Name');
    requirePosition(item.position);
    requirePositiveNumber(item.quantity, 'quantity');
    requirePositiveNumber(item.packageSize, 'package_size');
    requireCents(item.lineTotalCents, 'line_total_cents');
  }

  const db = await databaseFor(deps);
  const existing = await getReceipt(db, householdId, receiptId);
  if (existing) {
    const existingItems = await getReceiptItems(db, householdId, receiptId);
    const isComplete =
      existing.processing_status === 'confirmed' &&
      existingItems.length === input.items.length &&
      input.items.every((item) =>
        existingItems.some(
          (existingItem) =>
            existingItem.id === item.id && existingItem.review_status === 'confirmed',
        ),
      );
    if (isComplete) return { receipt: existing, itemIds: input.items.map((item) => item.id) };
    throw new Error(
      'Der Receipt existiert bereits in einem nicht abschließend gespeicherten Zustand.',
    );
  }

  const now = timestamps(deps);
  const receiptPayload = {
    id: receiptId,
    household_id: householdId,
    store_id: input.receipt.storeId ?? null,
    purchase_date: input.receipt.purchaseDate ?? null,
    currency: RECEIPT_CURRENCY,
    total_cents: input.receipt.totalCents ?? null,
    processing_status: 'needs_review',
    created_by: createdBy,
    confirmed_by: null,
    confirmed_at: null,
    created_at: now.iso,
  } satisfies Record<string, unknown>;
  const itemPayloads = input.items.map(
    (item) =>
      ({
        id: item.id,
        receipt_id: receiptId,
        household_id: householdId,
        position: item.position,
        name: item.name.trim(),
        product_id: item.productId ?? null,
        category_id: item.categoryId ?? null,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        package_size: item.packageSize ?? null,
        package_size_unit: item.packageSizeUnit ?? null,
        line_total_cents: item.lineTotalCents ?? null,
        review_status: 'needs_review',
        created_at: now.iso,
      }) satisfies Record<string, unknown>,
  );

  await enqueueMutationStepsInExclusiveTransaction(db, async (_txn, append) => {
    await append(
      structuredMutation({
        entity: 'purchase_receipts',
        entityId: receiptId,
        op: 'insert',
        payload: receiptPayload,
        now,
      }),
    );
    for (const payload of itemPayloads) {
      await append(
        structuredMutation({
          entity: 'purchase_receipt_items',
          entityId: String(payload.id),
          op: 'insert',
          payload,
          now,
        }),
      );
    }
    for (const item of input.items) {
      await append(
        structuredMutation({
          entity: 'purchase_receipt_items',
          entityId: item.id,
          op: 'update',
          payload: {
            id: item.id,
            household_id: householdId,
            review_status: 'confirmed',
          },
          now,
        }),
      );
    }
    await append(
      structuredMutation({
        entity: 'purchase_receipts',
        entityId: receiptId,
        op: 'update',
        payload: {
          id: receiptId,
          household_id: householdId,
          processing_status: 'confirmed',
          confirmed_by: confirmedBy,
          confirmed_at: now.iso,
        },
        now,
      }),
    );
  });

  const receipt = await getReceipt(db, householdId, receiptId);
  if (!receipt) throw new Error('Receipt konnte lokal nicht gespeichert werden.');
  return { receipt, itemIds: input.items.map((item) => item.id) };
}

export async function reopenReceipt(
  input: ReceiptReference,
  deps: ReceiptApiDependencies = {},
): Promise<LocalReceiptRow> {
  const db = await databaseFor(deps);
  const current = await getReceipt(db, input.householdId, input.receiptId);
  if (!current) throw new Error('Receipt wurde im Haushalt nicht gefunden.');
  if (!canTransitionReceiptStatus(current.processing_status, 'needs_review')) {
    throw new Error(`Receipt kann aus ${current.processing_status} nicht erneut geöffnet werden.`);
  }

  const now = timestamps(deps);
  await enqueueStructuredMutation(db, {
    entity: 'purchase_receipts',
    entityId: input.receiptId,
    op: 'update',
    payload: {
      id: input.receiptId,
      household_id: input.householdId,
      processing_status: 'needs_review',
      confirmed_by: null,
      confirmed_at: null,
    },
    now,
  });

  const row = await getReceipt(db, input.householdId, input.receiptId);
  if (!row) throw new Error('Receipt konnte nicht erneut geöffnet werden.');
  return row;
}

export async function createReceiptItem(
  input: CreateReceiptItemInput,
  deps: ReceiptApiDependencies = {},
): Promise<LocalReceiptItemRow> {
  requireText(input.id, 'Item-ID');
  requireText(input.receiptId, 'Receipt');
  requireText(input.householdId, 'Haushalt');
  requireText(input.name, 'Item-Name');
  requirePosition(input.position);
  requirePositiveNumber(input.quantity, 'quantity');
  requirePositiveNumber(input.packageSize, 'package_size');
  requireCents(input.lineTotalCents, 'line_total_cents');
  const now = timestamps(deps);
  const payload = {
    id: input.id,
    receipt_id: input.receiptId,
    household_id: input.householdId,
    position: input.position,
    name: input.name.trim(),
    product_id: input.productId ?? null,
    category_id: input.categoryId ?? null,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    package_size: input.packageSize ?? null,
    package_size_unit: input.packageSizeUnit ?? null,
    line_total_cents: input.lineTotalCents ?? null,
    review_status: input.reviewStatus ?? 'needs_review',
    created_at: now.iso,
  } satisfies Record<string, unknown>;

  const db = await databaseFor(deps);
  await enqueueStructuredMutation(db, {
    entity: 'purchase_receipt_items',
    entityId: input.id,
    op: 'insert',
    payload,
    now,
  });

  const row = await db.getFirstAsync<LocalReceiptItemRow>(
    `select id, receipt_id, household_id, position, name, product_id, category_id,
            quantity, unit, package_size, package_size_unit, line_total_cents,
            review_status, created_at, updated_at, deleted_at, _dirty
       from purchase_receipt_items
      where id = ? and household_id = ? and deleted_at is null`,
    [input.id, input.householdId],
  );
  if (!row) throw new Error('Receipt-Item konnte lokal nicht angelegt werden.');
  return row;
}

export async function updateReceiptItem(
  input: UpdateReceiptItemInput,
  deps: ReceiptApiDependencies = {},
): Promise<LocalReceiptItemRow> {
  const db = await databaseFor(deps);
  const current = await db.getFirstAsync<LocalReceiptItemRow>(
    'select * from purchase_receipt_items where id = ? and household_id = ? and deleted_at is null',
    [input.itemId, input.householdId],
  );
  if (!current) throw new Error('Receipt-Item wurde im Haushalt nicht gefunden.');

  const changes: Record<string, unknown> = {};
  if (input.changes.position !== undefined) {
    requirePosition(input.changes.position);
    changes.position = input.changes.position;
  }
  if (input.changes.name !== undefined) {
    requireText(input.changes.name, 'Item-Name');
    changes.name = input.changes.name.trim();
  }
  if (input.changes.productId !== undefined) changes.product_id = input.changes.productId;
  if (input.changes.categoryId !== undefined) changes.category_id = input.changes.categoryId;
  if (input.changes.quantity !== undefined) {
    requirePositiveNumber(input.changes.quantity, 'quantity');
    changes.quantity = input.changes.quantity;
  }
  if (input.changes.unit !== undefined) changes.unit = input.changes.unit;
  if (input.changes.packageSize !== undefined) {
    requirePositiveNumber(input.changes.packageSize, 'package_size');
    changes.package_size = input.changes.packageSize;
  }
  if (input.changes.packageSizeUnit !== undefined) {
    changes.package_size_unit = input.changes.packageSizeUnit;
  }
  if (input.changes.lineTotalCents !== undefined) {
    requireCents(input.changes.lineTotalCents, 'line_total_cents');
    changes.line_total_cents = input.changes.lineTotalCents;
  }
  if (Object.keys(changes).length === 0)
    throw new Error('Mindestens eine Item-Änderung ist erforderlich.');

  const nextReviewStatus = receiptItemReviewStatusAfterCorrection(current.review_status);
  if (nextReviewStatus !== current.review_status) changes.review_status = nextReviewStatus;
  const now = timestamps(deps);
  await enqueueStructuredMutation(db, {
    entity: 'purchase_receipt_items',
    entityId: input.itemId,
    op: 'update',
    payload: { id: input.itemId, household_id: input.householdId, ...changes },
    now,
  });

  const row = await db.getFirstAsync<LocalReceiptItemRow>(
    'select * from purchase_receipt_items where id = ? and household_id = ? and deleted_at is null',
    [input.itemId, input.householdId],
  );
  if (!row) throw new Error('Receipt-Item konnte lokal nicht aktualisiert werden.');
  return row;
}

export async function confirmReceiptItem(
  input: ReceiptItemReference,
  deps: ReceiptApiDependencies = {},
): Promise<LocalReceiptItemRow> {
  const db = await databaseFor(deps);
  const current = await db.getFirstAsync<LocalReceiptItemRow>(
    'select * from purchase_receipt_items where id = ? and household_id = ? and deleted_at is null',
    [input.itemId, input.householdId],
  );
  if (!current) throw new Error('Receipt-Item wurde im Haushalt nicht gefunden.');
  if (!canTransitionReceiptItemReviewStatus(current.review_status, 'confirmed')) {
    throw new Error(`Receipt-Item kann aus ${current.review_status} nicht bestätigt werden.`);
  }
  const now = timestamps(deps);
  await enqueueStructuredMutation(db, {
    entity: 'purchase_receipt_items',
    entityId: input.itemId,
    op: 'update',
    payload: {
      id: input.itemId,
      household_id: input.householdId,
      review_status: 'confirmed',
    },
    now,
  });
  const row = await db.getFirstAsync<LocalReceiptItemRow>(
    'select * from purchase_receipt_items where id = ? and household_id = ? and deleted_at is null',
    [input.itemId, input.householdId],
  );
  if (!row) throw new Error('Receipt-Item konnte nicht bestätigt werden.');
  return row;
}

async function changeDeletedState(
  entity: 'purchase_receipts' | 'purchase_receipt_items',
  id: string,
  householdId: string,
  op: 'delete' | 'restore',
  deps: ReceiptApiDependencies,
): Promise<void> {
  requireText(id, 'ID');
  requireText(householdId, 'Haushalt');
  const now = timestamps(deps);
  await enqueueStructuredMutation(await databaseFor(deps), {
    entity,
    entityId: id,
    op,
    payload: {
      id,
      household_id: householdId,
      deleted_at: op === 'delete' ? now.iso : null,
    },
    now,
  });
}

const RECEIPT_ASSET_DELETE_BATCH_SIZE = 1000;

async function purgeReceiptAssets(
  input: ReceiptReference,
  deletedAt: string,
  deps: ReceiptApiDependencies,
): Promise<void> {
  const supabase = supabaseFor(deps);
  const { data: assets, error: assetsError } = await supabase
    .from('receipt_assets')
    .select('storage_path')
    .eq('household_id', input.householdId)
    .eq('receipt_id', input.receiptId);
  if (assetsError) throw new Error(assetsError.message);

  const storagePaths = (assets ?? []).map((asset) => {
    assertReceiptAssetPath({ ...input, storagePath: asset.storage_path });
    return asset.storage_path;
  });

  const storage = supabase.storage.from(RECEIPT_ASSET_BUCKET);
  for (let start = 0; start < storagePaths.length; start += RECEIPT_ASSET_DELETE_BATCH_SIZE) {
    const paths = storagePaths.slice(start, start + RECEIPT_ASSET_DELETE_BATCH_SIZE);
    const { error: storageError } = await storage.remove(paths);
    if (storageError) throw new Error(storageError.message);
  }

  if (storagePaths.length === 0) return;

  const { error: metadataError } = await supabase
    .from('receipt_assets')
    .update({ deleted_at: deletedAt })
    .eq('household_id', input.householdId)
    .eq('receipt_id', input.receiptId)
    .is('deleted_at', null);
  if (metadataError) throw new Error(metadataError.message);
}

export function deleteReceipt(
  input: ReceiptReference,
  deps: ReceiptApiDependencies = {},
): Promise<void> {
  return changeDeletedState(
    'purchase_receipts',
    input.receiptId,
    input.householdId,
    'delete',
    deps,
  );
}

/**
 * Deletes a receipt's private images before queueing the receipt and all of
 * its local items as sync tombstones. Storage cleanup is idempotent, so a
 * retry is safe after a failure between the remote and local writes.
 */
export async function deleteReceiptPermanently(
  input: ReceiptReference,
  deps: ReceiptApiDependencies = {},
): Promise<void> {
  const householdId = requireText(input.householdId, 'Haushalt');
  const receiptId = requireText(input.receiptId, 'Receipt');
  const db = await databaseFor(deps);
  const items = await getReceiptItems(db, householdId, receiptId);
  const now = timestamps(deps);

  await purgeReceiptAssets({ householdId, receiptId }, now.iso, deps);

  await enqueueMutationStepsInExclusiveTransaction(db, async (_txn, append) => {
    await append(
      structuredMutation({
        entity: 'purchase_receipts',
        entityId: receiptId,
        op: 'delete',
        payload: { id: receiptId, household_id: householdId, deleted_at: now.iso },
        now,
      }),
    );

    for (const item of items) {
      await append(
        structuredMutation({
          entity: 'purchase_receipt_items',
          entityId: item.id,
          op: 'delete',
          payload: { id: item.id, household_id: householdId, deleted_at: now.iso },
          now,
        }),
      );
    }
  });
}

export function restoreReceipt(
  input: ReceiptReference,
  deps: ReceiptApiDependencies = {},
): Promise<void> {
  return changeDeletedState(
    'purchase_receipts',
    input.receiptId,
    input.householdId,
    'restore',
    deps,
  );
}

export function deleteReceiptItem(
  input: ReceiptItemReference,
  deps: ReceiptApiDependencies = {},
): Promise<void> {
  return changeDeletedState(
    'purchase_receipt_items',
    input.itemId,
    input.householdId,
    'delete',
    deps,
  );
}

export function restoreReceiptItem(
  input: ReceiptItemReference,
  deps: ReceiptApiDependencies = {},
): Promise<void> {
  return changeDeletedState(
    'purchase_receipt_items',
    input.itemId,
    input.householdId,
    'restore',
    deps,
  );
}

export const softDeleteReceipt = deleteReceipt;
export const softDeleteReceiptItem = deleteReceiptItem;

export async function listReceiptAssets(
  input: ReceiptAssetReference,
  deps: ReceiptApiDependencies = {},
): Promise<ReceiptAssetRow[]> {
  requireText(input.householdId, 'Haushalt');
  requireText(input.receiptId, 'Receipt');
  const { data, error } = await supabaseFor(deps)
    .from('receipt_assets')
    .select('*')
    .eq('household_id', input.householdId)
    .eq('receipt_id', input.receiptId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function assertReceiptAssetPath(input: ReceiptAssetSignedUrlInput): void {
  const prefix = `${input.householdId}/${input.receiptId}/`;
  if (
    !input.storagePath.startsWith(prefix) ||
    input.storagePath.includes('..') ||
    input.storagePath.endsWith('/')
  ) {
    throw new Error('Receipt-Asset-Pfad gehört nicht zum Receipt-Haushalt.');
  }
}

export async function createReceiptAssetSignedUrl(
  input: ReceiptAssetSignedUrlInput,
  deps: ReceiptApiDependencies = {},
): Promise<string> {
  requireText(input.householdId, 'Haushalt');
  requireText(input.receiptId, 'Receipt');
  requireText(input.storagePath, 'Storage-Pfad');
  assertReceiptAssetPath(input);
  const { data, error } = await supabaseFor(deps)
    .storage.from(RECEIPT_ASSET_BUCKET)
    .createSignedUrl(input.storagePath, RECEIPT_ASSET_SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error('Supabase lieferte keine Signed URL.');
  return data.signedUrl;
}

export const getReceiptAssetSignedUrl = createReceiptAssetSignedUrl;

export async function deleteReceiptAsset(
  input: DeleteReceiptAssetInput,
  deps: ReceiptApiDependencies = {},
): Promise<void> {
  requireText(input.assetId, 'Asset-ID');
  assertReceiptAssetPath(input);
  const supabase = supabaseFor(deps);
  const { error: storageError } = await supabase.storage
    .from(RECEIPT_ASSET_BUCKET)
    .remove([input.storagePath]);
  if (storageError) throw new Error(storageError.message);

  const { data, error } = await supabase
    .from('receipt_assets')
    .update({ deleted_at: (deps.now?.() ?? new Date()).toISOString() })
    .eq('id', input.assetId)
    .eq('receipt_id', input.receiptId)
    .eq('household_id', input.householdId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Receipt-Asset wurde im Haushalt nicht gefunden.');
}

export const removeReceiptAsset = deleteReceiptAsset;

function invalidateReceiptQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string,
  receiptId?: string,
  options: { invalidateAssets?: boolean } = {},
): void {
  void queryClient.invalidateQueries({ queryKey: receiptsQueryKey(householdId) });
  void queryClient.invalidateQueries({ queryKey: confirmedReceiptsQueryKey(householdId) });
  if (receiptId) {
    void queryClient.invalidateQueries({ queryKey: receiptQueryKey(householdId, receiptId) });
    void queryClient.invalidateQueries({ queryKey: receiptItemsQueryKey(householdId, receiptId) });
    if (options.invalidateAssets !== false) {
      void queryClient.invalidateQueries({
        queryKey: receiptAssetsQueryKey(householdId, receiptId),
      });
    }
  }
  void queryClient.invalidateQueries({ queryKey: ['sync-status'] });
}

async function cancelReceiptAssetQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string,
  receiptId: string,
): Promise<void> {
  const queryKey = receiptAssetsQueryKey(householdId, receiptId);
  return queryClient.cancelQueries({ queryKey });
}

async function discardReceiptAssetQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string,
  receiptId: string,
): Promise<void> {
  const queryKey = receiptAssetsQueryKey(householdId, receiptId);
  await cancelReceiptAssetQueries(queryClient, householdId, receiptId);
  queryClient.removeQueries({ queryKey });
}

function invalidateReceiptAssetQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  householdId: string,
  receiptId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: receiptAssetsQueryKey(householdId, receiptId),
    exact: true,
  });
}

export function useReceipts(householdId: string | undefined) {
  return useQuery({
    queryKey: receiptsQueryKey(householdId),
    queryFn: async () => getReceipts(await getDatabase(), householdId as string),
    enabled: !!householdId,
  });
}

export function useConfirmedReceipts(householdId: string | undefined) {
  return useQuery({
    queryKey: confirmedReceiptsQueryKey(householdId),
    queryFn: async () => getConfirmedReceipts(await getDatabase(), householdId as string),
    enabled: !!householdId,
  });
}

export function useReceipt(householdId: string | undefined, receiptId: string | undefined) {
  return useQuery({
    queryKey: receiptQueryKey(householdId, receiptId),
    queryFn: async () =>
      getReceipt(await getDatabase(), householdId as string, receiptId as string),
    enabled: !!householdId && !!receiptId,
  });
}

export function useReceiptItems(householdId: string | undefined, receiptId: string | undefined) {
  return useQuery({
    queryKey: receiptItemsQueryKey(householdId, receiptId),
    queryFn: async () =>
      getReceiptItems(await getDatabase(), householdId as string, receiptId as string),
    enabled: !!householdId && !!receiptId,
  });
}

export function useConfirmedReceiptItems(
  householdId: string | undefined,
  receiptId: string | undefined,
) {
  return useQuery({
    queryKey: receiptItemsQueryKey(householdId, receiptId),
    queryFn: async () =>
      getConfirmedReceiptItems(await getDatabase(), householdId as string, receiptId as string),
    enabled: !!householdId && !!receiptId,
  });
}

export function useReceiptAssets(householdId: string | undefined, receiptId: string | undefined) {
  return useQuery({
    queryKey: receiptAssetsQueryKey(householdId, receiptId),
    queryFn: () =>
      listReceiptAssets({ householdId: householdId as string, receiptId: receiptId as string }),
    enabled: !!householdId && !!receiptId,
  });
}

export function useDeleteReceiptAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteReceiptAssetInput) => deleteReceiptAsset(input),
    onMutate: async (input) => {
      await cancelReceiptAssetQueries(queryClient, input.householdId, input.receiptId);
    },
    onSuccess: (_, input) => {
      const assetsQueryKey = receiptAssetsQueryKey(input.householdId, input.receiptId);
      queryClient.setQueryData<ReceiptAssetRow[] | undefined>(assetsQueryKey, (assets) =>
        assets?.filter((asset) => asset.id !== input.assetId),
      );
      queryClient.removeQueries({
        queryKey: receiptAssetSignedUrlQueryKey(input.householdId, input.receiptId, input.assetId),
        exact: true,
      });
      invalidateReceiptAssetQueries(queryClient, input.householdId, input.receiptId);
    },
    onError: (_, input) => {
      void queryClient.invalidateQueries({
        queryKey: receiptAssetsQueryKey(input.householdId, input.receiptId),
      });
    },
  });
}

export function useCreateReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReceiptInput) => createReceipt(input),
    onSuccess: (receipt) => invalidateReceiptQueries(queryClient, receipt.household_id, receipt.id),
  });
}

export function useUpdateReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateReceiptInput) => updateReceipt(input),
    onSuccess: (receipt) => invalidateReceiptQueries(queryClient, receipt.household_id, receipt.id),
  });
}

export function useConfirmReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmReceiptInput) => confirmReceipt(input),
    onSuccess: (receipt) => invalidateReceiptQueries(queryClient, receipt.household_id, receipt.id),
  });
}

export function useReopenReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptReference) => reopenReceipt(input),
    onSuccess: (receipt) => invalidateReceiptQueries(queryClient, receipt.household_id, receipt.id),
  });
}

export function useDeleteReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptReference) => deleteReceiptPermanently(input),
    onMutate: (input) => cancelReceiptAssetQueries(queryClient, input.householdId, input.receiptId),
    onSuccess: async (_, input) => {
      await discardReceiptAssetQueries(queryClient, input.householdId, input.receiptId);
      invalidateReceiptQueries(queryClient, input.householdId, input.receiptId, {
        invalidateAssets: false,
      });
    },
  });
}

export function useRestoreReceiptMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptReference) => restoreReceipt(input),
    onSuccess: (_, input) =>
      invalidateReceiptQueries(queryClient, input.householdId, input.receiptId),
  });
}

export function useUpdateReceiptItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateReceiptItemInput) => updateReceiptItem(input),
    onSuccess: (item) => invalidateReceiptQueries(queryClient, item.household_id, item.receipt_id),
  });
}

export function useConfirmReceiptItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptItemReference) => confirmReceiptItem(input),
    onSuccess: (item) => invalidateReceiptQueries(queryClient, item.household_id, item.receipt_id),
  });
}

export function useDeleteReceiptItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptItemReference) => deleteReceiptItem(input),
    onSuccess: (_, input) => invalidateReceiptQueries(queryClient, input.householdId),
  });
}

export function useRestoreReceiptItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptItemReference) => restoreReceiptItem(input),
    onSuccess: (_, input) => invalidateReceiptQueries(queryClient, input.householdId),
  });
}
