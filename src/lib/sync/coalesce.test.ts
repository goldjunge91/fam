import type { Entity, OutboxEntry, OutboxOp } from '@/lib/db/types';
import { coalesce } from '@/lib/sync/coalesce';

/**
 * Die Outbox-Reduktion aus #49 — rein, ohne Datenbank, ohne Testdoubles.
 */

let nextId = 0;

beforeEach(() => {
  nextId = 0;
});

function entry(
  op: OutboxOp,
  payload: Record<string, unknown>,
  entityId = 'row-1',
  entity: Entity = 'fridge_items',
): OutboxEntry {
  nextId += 1;
  return {
    id: nextId,
    entity,
    entity_id: entityId,
    op,
    payload: JSON.stringify(payload),
    created_at: nextId * 1_000,
    attempts: 0,
    last_error: null,
    next_attempt_at: 0,
  };
}

describe('coalesce', () => {
  it('fasst drei Updates am selben Feld zu einem einzigen Push zusammen', () => {
    // Das woertliche Kriterium aus #49.
    const result = coalesce([
      entry('update', { quantity: 1 }),
      entry('update', { quantity: 2 }),
      entry('update', { quantity: 3 }),
    ]);

    expect(result.pushes).toHaveLength(1);
    expect(result.pushes[0].op).toBe('update');
    expect(result.pushes[0].payload).toEqual({ quantity: 3 });
    expect(result.pushes[0].sourceIds).toEqual([1, 2, 3]);
  });

  it('merged verschiedene Felder statt sie zu ueberschreiben', () => {
    const result = coalesce([entry('update', { quantity: 2 }), entry('update', { name: 'Milch' })]);

    expect(result.pushes[0].payload).toEqual({ quantity: 2, name: 'Milch' });
  });

  it('bleibt ein insert, wenn danach noch geaendert wurde', () => {
    // Der Server hat die Zeile nie gesehen; ein update darauf schluege fehl.
    const result = coalesce([
      entry('insert', { name: 'Milch', quantity: 1 }),
      entry('update', { quantity: 5 }),
    ]);

    expect(result.pushes).toHaveLength(1);
    expect(result.pushes[0].op).toBe('insert');
    expect(result.pushes[0].payload).toEqual({ name: 'Milch', quantity: 5 });
  });

  it('verwirft insert + delete vollstaendig, ohne einen Netzwerkaufruf', () => {
    const result = coalesce([entry('insert', { name: 'Milch' }), entry('delete', {})]);

    expect(result.pushes).toEqual([]);
    expect(result.discardable).toEqual([1, 2]);
  });

  it('verwirft auch insert + update + delete vollstaendig', () => {
    const result = coalesce([
      entry('insert', { name: 'Milch' }),
      entry('update', { quantity: 3 }),
      entry('delete', {}),
    ]);

    expect(result.pushes).toEqual([]);
    expect(result.discardable).toEqual([1, 2, 3]);
  });

  it('macht aus updates gefolgt von delete ein einzelnes delete', () => {
    // Hier kennt der Server die Zeile — der Tombstone muss raus.
    const result = coalesce([entry('update', { quantity: 3 }), entry('delete', {})]);

    expect(result.pushes).toHaveLength(1);
    expect(result.pushes[0].op).toBe('delete');
    expect(result.pushes[0].sourceIds).toEqual([1, 2]);
    expect(result.discardable).toEqual([]);
  });

  it('haelt verschiedene Zeilen auseinander', () => {
    const result = coalesce([
      entry('update', { quantity: 1 }, 'row-a'),
      entry('update', { quantity: 2 }, 'row-b'),
      entry('update', { quantity: 3 }, 'row-a'),
    ]);

    expect(result.pushes).toHaveLength(2);
    expect(result.pushes.map((p) => p.entityId)).toEqual(['row-a', 'row-b']);
    expect(result.pushes[0].payload).toEqual({ quantity: 3 });
  });

  it('haelt dieselbe id in verschiedenen Tabellen auseinander', () => {
    const result = coalesce([
      entry('update', { a: 1 }, 'same-id', 'fridge_items'),
      entry('update', { b: 2 }, 'same-id', 'shopping_list_items'),
    ]);

    expect(result.pushes).toHaveLength(2);
  });

  it('erhaelt medizinische Einheiten unveraendert', () => {
    const result = coalesce([
      entry('insert', { medication_name: 'Insulin', unit: 'units' }, 'med-1', 'medication_logs'),
    ]);

    expect(result.pushes[0].payload).toEqual({ medication_name: 'Insulin', unit: 'units' });
  });

  it.each([
    ['litre', 'l'],
    ['gram', 'g'],
    ['kilogramm', 'kg'],
    ['milliliter', 'ml'],
    ['stk.', 'piece'],
    ['stueck', 'piece'],
    ['pkg', 'package'],
    ['pck', 'portion'],
  ])('normalisiert die kanonische Unit-Variante %s zu %s', (input, expected) => {
    const result = coalesce([entry('insert', { name: 'Vorrat', unit: input })]);

    expect(result.pushes[0].payload).toEqual({ name: 'Vorrat', unit: expected });
  });

  it('coalesct push-only Feedback-Events niemals', () => {
    const result = coalesce([
      entry(
        'insert',
        { event_id: 'event-1', new_placement_zone: 'other' },
        'event-1',
        'shopping_category_feedback_events',
      ),
      entry(
        'update',
        { new_placement_zone: 'fresh_produce' },
        'event-1',
        'shopping_category_feedback_events',
      ),
    ]);

    expect(result.pushes).toHaveLength(2);
    expect(result.pushes.map((push) => push.op)).toEqual(['insert', 'update']);
    expect(result.pushes.map((push) => push.sourceIds)).toEqual([[1], [2]]);
  });

  it('erhaelt die zeilenuebergreifende Erstellungsreihenfolge', () => {
    // Ein fridge_item zeigt auf einen storage_location. Wird der Lagerort
    // spaeter gepusht als der Artikel, laeuft der Fremdschluessel ins Leere.
    const result = coalesce([
      entry('insert', { name: 'Kuehlschrank' }, 'loc-1', 'storage_locations'),
      entry('insert', { name: 'Milch' }, 'item-1', 'fridge_items'),
      entry('update', { name: 'Kuehlschrank oben' }, 'loc-1', 'storage_locations'),
    ]);

    expect(result.pushes.map((p) => p.entityId)).toEqual(['loc-1', 'item-1']);
  });

  it('sortiert unsortierte Eingaben nach id', () => {
    const first = entry('update', { quantity: 1 });
    const second = entry('update', { quantity: 2 });

    const result = coalesce([second, first]);

    expect(result.pushes[0].payload).toEqual({ quantity: 2 });
  });

  it('beginnt nach einem delete eine neue Gruppe', () => {
    const result = coalesce([
      entry('update', { quantity: 1 }),
      entry('delete', {}),
      entry('insert', { name: 'neu' }),
    ]);

    expect(result.pushes.map((p) => p.op)).toEqual(['delete', 'insert']);
  });

  it('verliert keinen Eintrag — jede id taucht genau einmal auf', () => {
    // Der Erfolgspfad loescht nach sourceIds. Fehlte eine id, bliebe die Zeile
    // fuer immer in der Outbox stehen und wuerde endlos erneut versucht.
    const entries = [
      entry('insert', { a: 1 }, 'row-a'),
      entry('update', { a: 2 }, 'row-a'),
      entry('update', { b: 1 }, 'row-b'),
      entry('delete', {}, 'row-b'),
      entry('insert', { c: 1 }, 'row-c'),
      entry('delete', {}, 'row-c'),
    ];

    const result = coalesce(entries);
    const covered = [...result.pushes.flatMap((p) => p.sourceIds), ...result.discardable].sort(
      (a, b) => a - b,
    );

    expect(covered).toEqual(entries.map((e) => e.id));
  });

  it('ist ein Fixpunkt — nochmal reduzieren aendert nichts', () => {
    const entries = [
      entry('insert', { name: 'Milch' }),
      entry('update', { quantity: 2 }),
      entry('update', { quantity: 3 }),
    ];

    const once = coalesce(entries);
    const asOutbox: OutboxEntry[] = once.pushes.map((push, index) => ({
      id: index + 1,
      entity: push.entity,
      entity_id: push.entityId,
      op: push.op,
      payload: JSON.stringify(push.payload),
      created_at: 0,
      attempts: 0,
      last_error: null,
      next_attempt_at: 0,
    }));
    const twice = coalesce(asOutbox);

    expect(twice.pushes.map((p) => ({ op: p.op, payload: p.payload }))).toEqual(
      once.pushes.map((p) => ({ op: p.op, payload: p.payload })),
    );
  });

  it('kommt mit einer leeren Outbox zurecht', () => {
    expect(coalesce([])).toEqual({ pushes: [], discardable: [] });
  });

  it('meldet einen Payload, der kein Objekt ist, statt ihn still zu schlucken', () => {
    const broken: OutboxEntry = { ...entry('update', {}), payload: '"nur ein string"' };

    expect(() => coalesce([broken])).toThrow(/payload/);
  });

  describe('restore (#69)', () => {
    it('macht aus insert, delete, restore einen einzelnen insert mit den urspruenglichen Daten', () => {
      // insert+delete waeren fuer sich discardable (Server hat nie davon
      // gewusst) — ein eigenstaendiger restore-Push liefe gegen eine dort nie
      // existente Zeile. Der Nettozustand ist ein normaler insert.
      const result = coalesce([
        entry('insert', { name: 'Milch', quantity: 1 }),
        entry('delete', {}),
        entry('restore', { deleted_at: null, updated_at: 123 }),
      ]);

      expect(result.discardable).toEqual([1, 2]);
      expect(result.pushes).toHaveLength(1);
      expect(result.pushes[0].op).toBe('insert');
      expect(result.pushes[0].payload).toEqual({
        name: 'Milch',
        quantity: 1,
        deleted_at: null,
        updated_at: 123,
      });
      expect(result.pushes[0].sourceIds).toEqual([3]);
    });

    it('macht aus insert, update, delete, restore ebenfalls einen insert mit allen Aenderungen', () => {
      const result = coalesce([
        entry('insert', { name: 'Milch', quantity: 1 }),
        entry('update', { quantity: 3 }),
        entry('delete', {}),
        entry('restore', { deleted_at: null }),
      ]);

      expect(result.discardable).toEqual([1, 2, 3]);
      expect(result.pushes).toHaveLength(1);
      expect(result.pushes[0].op).toBe('insert');
      expect(result.pushes[0].payload).toEqual({ name: 'Milch', quantity: 3, deleted_at: null });
    });

    it('haelt update*, delete, restore als zwei getrennte Pushes (Zeile existierte bereits auf dem Server)', () => {
      const result = coalesce([
        entry('update', { quantity: 3 }),
        entry('delete', {}),
        entry('restore', { deleted_at: null }),
      ]);

      expect(result.discardable).toEqual([]);
      expect(result.pushes.map((p) => p.op)).toEqual(['delete', 'restore']);
      expect(result.pushes[1].payload).toEqual({ deleted_at: null });
      expect(result.pushes[1].sourceIds).toEqual([3]);
    });

    it('behandelt ein eigenstaendiges restore ohne vorherige Gruppe wie jeden anderen Op', () => {
      const result = coalesce([entry('restore', { deleted_at: null })]);

      expect(result.pushes).toHaveLength(1);
      expect(result.pushes[0].op).toBe('restore');
      expect(result.discardable).toEqual([]);
    });
  });
});
