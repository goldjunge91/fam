import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutation, recordOutboxOutcome } from '@/lib/db/outbox';
import { type FridgeItemConflict, getFridgeItemConflicts } from '@/lib/db/outbox-conflicts';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { createInventoryQuantityCorrectionMutation } from '@/lib/sync/inventory-quantity-correction';

import { createTestDatabase } from '../../../test/node-sqlite-adapter';
import {
  discardInventoryConflict,
  reconfirmInventoryQuantityCorrection,
} from './resolve-inventory-conflict';

async function makeDbWithConflict() {
  const db = createTestDatabase();
  await runMigrations(db, MIGRATIONS);
  await runDrizzleMigrations(db);
  await db.runAsync(
    `insert into fridge_items
     (id, household_id, location_id, product_id, name, quantity, unit, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['item-1', 'hh-1', 'loc-1', 'prod-1', 'Milch', 3, 'piece', '2026-09-07T10:00:00.000Z', 0],
  );
  await enqueueMutation(
    db,
    createInventoryQuantityCorrectionMutation({
      payload: {
        operation_id: 'op-1',
        transaction_id: 'tx-1',
        item_id: 'item-1',
        household_id: 'hh-1',
        expected_quantity: 5,
        new_quantity: 3,
        created_at: '2026-09-07T10:00:00.000Z',
      },
      transaction: {
        id: 'tx-1',
        operation_id: 'op-1',
        household_id: 'hh-1',
        fridge_item_id: 'item-1',
        product_id: 'prod-1',
        actor: 'user-1',
        type: 'out',
        quantity: 2,
        location_id: 'loc-1',
        reason: null,
        previous_expiry_date: null,
        notes: '[Manual correction]',
        undone: false,
        created_at: '2026-09-07T10:00:00.000Z',
      },
      nowMs: 1,
    }),
  );
  const [row] = await db.getAllAsync<{ id: number }>('select id from outbox order by id');
  await recordOutboxOutcome(db, [row.id], {
    attempts: MAX_ATTEMPTS,
    lastError: 'Bestand veraendert',
    nextAttemptAtMs: Number.MAX_SAFE_INTEGER,
  });

  const [conflict] = await getFridgeItemConflicts(db);
  return { db, conflict };
}

function canonicalRow(quantity: number) {
  return {
    id: 'item-1',
    household_id: 'hh-1',
    location_id: 'loc-1',
    product_id: 'prod-1',
    quantity,
    name: 'Milch',
    unit: 'piece',
    package_size: null,
    package_size_unit: null,
    expiry_date: null,
    added_by: null,
    created_at: '2026-09-07T10:00:00.000Z',
    opened_at: null,
    vacuum_sealed: false,
    expiry_user_set: false,
    updated_at: '2026-09-07T12:00:00.000Z',
    deleted_at: null,
  };
}

describe('discardInventoryConflict', () => {
  it('loescht die blockierten Outbox-Zeilen und spiegelt den kanonischen Serverstand', async () => {
    const { db, conflict } = await makeDbWithConflict();
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: canonicalRow(1), error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const supabase = {
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    try {
      await discardInventoryConflict(db, supabase, conflict);

      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', ['item-1']),
      ).toBeNull();
      expect(
        await db.getFirstAsync<{ quantity: number; dirty: number }>(
          'select quantity, _dirty as dirty from fridge_items where id = ?',
          ['item-1'],
        ),
      ).toEqual({ quantity: 1, dirty: 0 });
    } finally {
      db.close();
    }
  });

  it('entfernt den Artikel lokal, wenn er serverseitig nicht mehr existiert', async () => {
    const { db, conflict } = await makeDbWithConflict();
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const supabase = {
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    try {
      await discardInventoryConflict(db, supabase, conflict);

      expect(
        await db.getFirstAsync('select id from fridge_items where id = ?', ['item-1']),
      ).toBeNull();
    } finally {
      db.close();
    }
  });
});

describe('reconfirmInventoryQuantityCorrection', () => {
  it('legt die Korrektur mit dem aktuellen Bestand als neuer Vergleichsbasis frisch in die Outbox', async () => {
    const { db, conflict } = await makeDbWithConflict();
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: canonicalRow(1), error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const supabase = {
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await reconfirmInventoryQuantityCorrection(db, supabase, conflict, {
        actor: 'user-1',
        operationId: 'op-2',
        transactionId: 'tx-2',
        nowMs: 5,
      });

      expect(result).toBe('reconfirmed');
      // Alte, gescheiterte Outbox-Zeile ist weg, dafuer eine neue mit frischer Basis.
      const rows = await db.getAllAsync<{ payload: string }>(
        "select payload from outbox where entity_id = ? and op = 'correct_quantity'",
        ['item-1'],
      );
      expect(rows).toHaveLength(1);
      const payload = JSON.parse(rows[0].payload);
      expect(payload).toMatchObject({
        item_id: 'item-1',
        expected_quantity: 1,
        new_quantity: 3,
        operation_id: 'op-2',
        transaction_id: 'tx-2',
      });
      expect(
        await db.getFirstAsync<{ quantity: number }>(
          'select quantity from fridge_items where id = ?',
          ['item-1'],
        ),
      ).toEqual({ quantity: 3 });
    } finally {
      db.close();
    }
  });

  it('raeumt nur auf, wenn der Serverbestand bereits dem Zielwert entspricht', async () => {
    const { db, conflict } = await makeDbWithConflict();
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: canonicalRow(3), error: null, status: 200 });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const supabase = {
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) }),
    } as unknown as TypedSupabaseClient;

    try {
      const result = await reconfirmInventoryQuantityCorrection(db, supabase, conflict, {
        actor: 'user-1',
        operationId: 'op-2',
        transactionId: 'tx-2',
        nowMs: 5,
      });

      expect(result).toBe('already-matches');
      expect(
        await db.getFirstAsync('select id from outbox where entity_id = ?', ['item-1']),
      ).toBeNull();
    } finally {
      db.close();
    }
  });

  it('lehnt Konflikte ohne eindeutige Korrektur ab', async () => {
    const { db, conflict } = await makeDbWithConflict();
    const supabase = {} as TypedSupabaseClient;
    const ambiguousConflict: FridgeItemConflict = { ...conflict, correction: null };

    try {
      await expect(
        reconfirmInventoryQuantityCorrection(db, supabase, ambiguousConflict, {
          actor: 'user-1',
          operationId: 'op-2',
          transactionId: 'tx-2',
        }),
      ).rejects.toThrow(/nicht.*neu bestaetigen/i);
    } finally {
      db.close();
    }
  });
});
