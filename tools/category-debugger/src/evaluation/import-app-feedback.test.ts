import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  type AppFeedbackEvent,
  type EvaluationImportStore,
  type ImportCursor,
  type ImportPage,
  createPseudonymizer,
  loadImportConfig,
  runImport,
  toEvaluationCrowdSignal,
} from '../../scripts/import-app-feedback';

const event: AppFeedbackEvent = {
  event_id: 'evt-01',
  schema_version: 1,
  taxonomy_version: 'placement-taxonomy-v2',
  event_type: 'manual_reassign',
  input_method: 'edit_form',
  household_id: 'household-direct-id',
  actor_user_id: 'actor-direct-id',
  shopping_list_item_id: 'item-direct-id',
  product_key_type: 'product',
  product_key: 'product-direct-id',
  product_id: 'product-direct-id',
  barcode: null,
  product_name: ' Hafer  Milch ',
  store_id: 'store-direct-id',
  preference_scope: 'store',
  old_placement_zone: 'ambient_milk_drinks',
  new_placement_zone: 'chilled_plant_based',
  predicted_placement_zone: 'ambient_milk_drinks',
  old_category_source: 'name_fallback',
  new_category_source: 'store_preference',
  predicted_product_family: 'plant_drink',
  predicted_product_form: 'chilled',
  classifier_version: 'placement-v2.0.0',
  platform: 'ios',
  app_version: '1.2.3',
  build_channel: 'alpha',
  client_created_at: '2026-08-24T12:00:00.000Z',
  created_at: '2026-08-24T12:00:01.000Z',
};

function eventAt(eventId: string, createdAt: string): AppFeedbackEvent {
  return { ...event, event_id: eventId, created_at: createdAt };
}

function fakeStore(options?: {
  writeSignals?: EvaluationImportStore['writeSignals'];
}) {
  const advances: Array<Parameters<EvaluationImportStore['advanceRun']>[0]> = [];
  const failures: Array<Parameters<EvaluationImportStore['failRun']>[0]> = [];
  const completions: Array<Parameters<EvaluationImportStore['completeRun']>[0]> = [];
  const writes: string[][] = [];
  const store: EvaluationImportStore = {
    getResumeCursor: async () => null,
    startRun: async () => undefined,
    writeSignals: options?.writeSignals ?? (async (signals) => {
      writes.push(signals.map((signal) => signal.event_id));
      return { imported: signals.length, duplicates: 0 };
    }),
    advanceRun: async (input) => {
      advances.push(input);
    },
    completeRun: async (input) => {
      completions.push(input);
    },
    failRun: async (input) => {
      failures.push(input);
    },
  };
  return { store, advances, failures, completions, writes };
}

describe('manueller App-Feedback-Import', () => {
  it('pseudonymisiert Identitäten und entfernt direkte IDs aus dem Zielpayload', () => {
    const key = 'local-test-key';
    const pseudonymizer = createPseudonymizer(key);
    const signal = toEvaluationCrowdSignal(event, pseudonymizer);
    const expectedActor = createHmac('sha256', key).update('actor\u0000actor-direct-id').digest('hex');

    expect(signal.actor_key).toBe(expectedActor);
    expect(signal.actor_key).not.toContain('actor-direct-id');
    expect(signal.household_key).not.toContain('household-direct-id');
    expect(signal.store_key).not.toContain('store-direct-id');
    expect(signal.product_key).not.toContain('product-direct-id');
    expect(signal.raw_payload).not.toHaveProperty('actor_user_id');
    expect(signal.raw_payload).not.toHaveProperty('household_id');
    expect(signal.raw_payload).not.toHaveProperty('store_id');
    expect(signal.raw_payload).not.toHaveProperty('product_id');
    expect(signal.raw_payload).not.toHaveProperty('shopping_list_item_id');
    expect(signal.raw_payload).toMatchObject({
      event_type: 'manual_reassign',
      preference_scope: 'store',
      product_key_type: 'product',
    });
  });

  it('normalisiert Namensschlüssel und behält Barcode-Schlüssel ohne direkte Profil-IDs', () => {
    const pseudonymizer = createPseudonymizer('local-test-key');
    const nameEvent: AppFeedbackEvent = {
      ...event,
      event_id: 'evt-name',
      product_key_type: 'name',
      product_key: ' Hafer  Milch ',
      product_id: null,
      barcode: null,
      store_id: null,
      preference_scope: 'household',
    };
    const barcodeEvent: AppFeedbackEvent = {
      ...event,
      event_id: 'evt-barcode',
      product_key_type: 'barcode',
      product_key: '400000000001',
      product_id: null,
      barcode: '400000000001',
    };

    expect(toEvaluationCrowdSignal(nameEvent, pseudonymizer).product_key).toBe('name:hafer milch');
    expect(toEvaluationCrowdSignal(barcodeEvent, pseudonymizer).product_key).toBe('barcode:400000000001');
  });

  it('speichert den Cursor erst nach erfolgreichem Schreiben jeder Seite', async () => {
    const pages: ImportPage[] = [
      { events: [event] },
      { events: [eventAt('evt-02', '2026-08-24T12:01:00.000Z')] },
      { events: [] },
    ];
    const observedCursors: Array<ImportCursor | null> = [];
    const { store, advances, completions, writes } = fakeStore();
    const result = await runImport({
      reader: {
        readPage: async (cursor) => {
          observedCursors.push(cursor);
          return pages.shift()!;
        },
      },
      store,
      pseudonymizer: createPseudonymizer('local-test-key'),
      pageSize: 1,
      now: () => '2026-08-24T12:02:00.000Z',
      createRunId: () => 'run-01',
    });

    expect(result).toMatchObject({ runId: 'run-01', pages: 2, eventsRead: 2, eventsImported: 2 });
    expect(writes).toEqual([['evt-01'], ['evt-02']]);
    expect(advances.map((advance) => advance.cursor.eventId)).toEqual(['evt-01', 'evt-02']);
    expect(observedCursors.map((cursor) => cursor?.eventId ?? null)).toEqual([null, 'evt-01', 'evt-02']);
    const completion = completions[0];
    if (!completion) throw new Error('Import-Run wurde nicht abgeschlossen.');
    if (!completion.cursor) throw new Error('Import-Run hat keinen Abschluss-Cursor.');
    expect(completion.cursor.eventId).toBe('evt-02');
  });

  it('setzt bei einem Seitenfehler den Run auf den letzten vollständigen Cursor zurück', async () => {
    const firstEvent = event;
    const secondEvent = eventAt('evt-02', '2026-08-24T12:01:00.000Z');
    const { store, advances, failures } = fakeStore({
      writeSignals: async (signals) => {
        if (signals[0]?.event_id === secondEvent.event_id) throw new Error('ziel nicht erreichbar');
        return { imported: signals.length, duplicates: 0 };
      },
    });
    const pages: ImportPage[] = [{ events: [firstEvent] }, { events: [secondEvent] }];

    await expect(runImport({
      reader: { readPage: async () => pages.shift()! },
      store,
      pseudonymizer: createPseudonymizer('local-test-key'),
      pageSize: 1,
      createRunId: () => 'run-02',
    })).rejects.toThrow('ziel nicht erreichbar');

    expect(advances).toHaveLength(1);
    expect(advances[0]?.cursor.eventId).toBe('evt-01');
    const failure = failures[0];
    if (!failure) throw new Error('Import-Run wurde nicht als fehlgeschlagen markiert.');
    if (!failure.cursor) throw new Error('Fehlgeschlagener Import-Run hat keinen Cursor.');
    expect(failure.cursor.eventId).toBe('evt-01');
    expect(failure.errorMessage).toBe('ziel nicht erreichbar');
  });

  it('verlangt getrennte App- und Evaluation-Secrets', () => {
    const environment = {
      APP_SUPABASE_URL: 'https://app.example',
      APP_SUPABASE_SECRET_KEY: 'app-secret',
      EVALUATION_SUPABASE_URL: 'https://eval.example',
      EVALUATION_SUPABASE_SECRET_KEY: 'eval-secret',
      CATEGORY_FEEDBACK_PSEUDONYM_KEY: 'hmac-secret',
    };

    expect(() => loadImportConfig(environment, ['--page-size=42'])).not.toThrow();
    expect(loadImportConfig(environment, ['--page-size=42']).pageSize).toBe(42);
    expect(() => loadImportConfig({ APP_SUPABASE_URL: 'https://app.example' }, [])).toThrow(/APP_SUPABASE_SECRET_KEY/);
  });
});
