import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';

type PayloadEntry = { id: number; payload: string };

function createDatabaseFake({
  legacyUnitEntries = [],
  staleInventoryEntries = [],
  retryChanges = 0,
}: {
  legacyUnitEntries?: PayloadEntry[];
  staleInventoryEntries?: PayloadEntry[];
  retryChanges?: number;
} = {}) {
  const getAllAsync = jest
    .fn()
    .mockResolvedValueOnce(legacyUnitEntries)
    .mockResolvedValueOnce(staleInventoryEntries);
  const runAsync = jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: retryChanges });

  return {
    db: { getAllAsync, runAsync } as unknown as SqlDatabase,
    getAllAsync,
    runAsync,
  };
}

describe('retryFailedOutboxEntries', () => {
  it('setzt terminale Eintraege mit nowMs wieder faellig', async () => {
    const { db, getAllAsync, runAsync } = createDatabaseFake({ retryChanges: 1 });

    await expect(retryFailedOutboxEntries(db, 1234)).resolves.toBe(1);

    expect(getAllAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("entity = 'fridge_items'"),
      [MAX_ATTEMPTS],
    );
    expect(runAsync).toHaveBeenLastCalledWith(
      "update outbox set attempts = 0, next_attempt_at = ? where attempts >= ? or last_error like '%unit%'",
      [1234, MAX_ATTEMPTS],
    );
  });

  it('laesst nicht-terminale Eintraege unveraendert', async () => {
    const { db, runAsync } = createDatabaseFake();

    await expect(retryFailedOutboxEntries(db, 1234)).resolves.toBe(0);

    expect(runAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenLastCalledWith(
      "update outbox set attempts = 0, next_attempt_at = ? where attempts >= ? or last_error like '%unit%'",
      [1234, MAX_ATTEMPTS],
    );
  });

  it('verwendet Date.now als Default fuer die neue Faelligkeit', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(5678);
    const { db, runAsync } = createDatabaseFake({ retryChanges: 1 });

    try {
      await expect(retryFailedOutboxEntries(db)).resolves.toBe(1);
    } finally {
      nowSpy.mockRestore();
    }

    expect(runAsync).toHaveBeenLastCalledWith(
      "update outbox set attempts = 0, next_attempt_at = ? where attempts >= ? or last_error like '%unit%'",
      [5678, MAX_ATTEMPTS],
    );
  });

  it.each([
    ['L', 1],
    ['LITER', 2],
  ] as const)('repariert die veraltete Einheit %s sicher', async (unit, id) => {
    const payload = JSON.stringify({ id: `item-${id}`, unit });
    const { db, runAsync } = createDatabaseFake({
      legacyUnitEntries: [{ id, payload }],
    });

    await retryFailedOutboxEntries(db, 1234);

    expect(runAsync).toHaveBeenNthCalledWith(1, 'update outbox set payload = ? where id = ?', [
      JSON.stringify({ id: `item-${id}`, unit: 'l' }),
      id,
    ]);
  });

  it('entfernt alte Inventar-JOIN-Felder aus einem validen Objekt-Payload', async () => {
    const { db, runAsync } = createDatabaseFake({
      staleInventoryEntries: [
        {
          id: 7,
          payload: JSON.stringify({
            id: 'item-7',
            household_id: 'hh-1',
            expiry_date: '2026-08-29',
            location_kind: 'fridge',
            location_name: 'Kuehlschrank',
          }),
        },
      ],
    });

    await retryFailedOutboxEntries(db, 1234);

    expect(runAsync).toHaveBeenNthCalledWith(1, 'update outbox set payload = ? where id = ?', [
      JSON.stringify({ id: 'item-7', household_id: 'hh-1', expiry_date: '2026-08-29' }),
      7,
    ]);
  });

  it('ignoriert ungueltige Payload-Formen ohne die Retry-Entscheidung zu veraendern', async () => {
    const { db, runAsync } = createDatabaseFake({
      staleInventoryEntries: [
        { id: 1, payload: 'null' },
        { id: 2, payload: '[]' },
        { id: 3, payload: '{"location_kind":"fridge"' },
      ],
      retryChanges: 1,
    });

    await expect(retryFailedOutboxEntries(db, 1234)).resolves.toBe(1);

    expect(runAsync).toHaveBeenCalledTimes(1);
    expect(runAsync).toHaveBeenLastCalledWith(
      "update outbox set attempts = 0, next_attempt_at = ? where attempts >= ? or last_error like '%unit%'",
      [1234, MAX_ATTEMPTS],
    );
  });
});
