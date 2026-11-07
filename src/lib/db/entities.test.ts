import {
  ALL_ENTITIES,
  ENTITIES,
  hasServerTombstone,
  metaOf,
  PUSH_ONLY_ENTITIES,
} from '@/lib/db/entities';
import type { Entity } from '@/lib/db/types';

describe('entities', () => {
  it('kennt alle synchronisierten Spiegeltabellen inklusive Kategoriepraeferenzen', () => {
    expect(ALL_ENTITIES).toEqual([
      'storage_locations',
      'stores',
      'purchase_receipts',
      'purchase_receipt_items',
      // transactions vor fridge_items: Empfangsbeweis fuer die
      // Reconciliation offener Mengenoperationen (fam-onu).
      'transactions',
      'fridge_items',
      'shopping_list_items',
      'shopping_category_preferences',
      'chef_conversations',
      'chef_conversation_turns',
      'chef_recipe_history',
      'products',
      'recipes',
      'recipe_components',
      'recipe_component_items',
      'recipe_steps',
      'recipe_step_images',
      'recipe_step_ingredients',
      'meal_plans',
      'meal_plan_entries',
      'favorite_brochure_stores',
      'medication_logs',
      'symptom_logs',
    ]);
  });

  // `households` ist bewusst nicht in ALL_ENTITIES (siehe Kommentar dort) und
  // taucht deshalb in der Schleife unten nie auf — steht in `expected` trotzdem
  // mit drin, damit der Typ `Record<Entity, boolean>` vollstaendig bleibt und
  // die Aussage "products UND households sind global" an einer Stelle sichtbar
  // ist (die eigentliche Zusicherung dafuer steckt im Test weiter unten).
  it('hasServerTombstone ist bei globalen und servererzeugten Tabellen false', () => {
    const expected: Record<Entity, boolean> = {
      storage_locations: true,
      stores: true,
      purchase_receipts: true,
      purchase_receipt_items: true,
      fridge_items: true,
      transactions: false,
      shopping_list_items: true,
      shopping_category_preferences: true,
      shopping_category_feedback_events: false,
      chef_conversations: false,
      chef_conversation_turns: false,
      chef_recipe_history: false,
      products: false,
      households: false,
      recipes: true,
      recipe_components: true,
      recipe_component_items: true,
      recipe_steps: true,
      recipe_step_ingredients: true,
      recipe_step_images: true,
      meal_plans: true,
      meal_plan_entries: true,
      favorite_brochure_stores: true,
      medication_logs: true,
      symptom_logs: true,
    };

    for (const entity of ALL_ENTITIES) {
      expect(hasServerTombstone(entity)).toBe(expected[entity]);
    }
  });

  it('householdScoped ist nur bei products und households false', () => {
    const expected: Record<Entity, boolean> = {
      storage_locations: true,
      stores: true,
      purchase_receipts: true,
      purchase_receipt_items: true,
      fridge_items: true,
      transactions: true,
      shopping_list_items: true,
      shopping_category_preferences: true,
      shopping_category_feedback_events: false,
      chef_conversations: true,
      chef_conversation_turns: true,
      chef_recipe_history: true,
      products: false,
      households: false,
      recipes: true,
      recipe_components: true,
      recipe_component_items: true,
      recipe_steps: true,
      recipe_step_ingredients: true,
      recipe_step_images: true,
      meal_plans: true,
      meal_plan_entries: true,
      favorite_brochure_stores: false,
      medication_logs: false,
      symptom_logs: false,
    };

    for (const entity of ALL_ENTITIES) {
      expect(ENTITIES[entity].householdScoped).toBe(expected[entity]);
    }
  });

  it('metaOf liefert dieselbe Instanz wie ENTITIES[entity]', () => {
    for (const entity of ALL_ENTITIES) {
      expect(metaOf(entity)).toBe(ENTITIES[entity]);
    }
  });

  it('jede Spaltenliste beginnt mit id und enthaelt keine Sync-Spalten', () => {
    for (const entity of ALL_ENTITIES) {
      const { columns } = metaOf(entity);
      expect(columns[0]).toBe('id');
      expect(columns).not.toContain('updated_at');
      expect(columns).not.toContain('deleted_at');
      expect(columns).not.toContain('_dirty');
    }
  });

  it('household-skalierte Entitaeten fuehren household_id in den Spalten', () => {
    for (const entity of ALL_ENTITIES) {
      const meta = metaOf(entity);
      if (meta.householdScoped) {
        expect(meta.columns).toContain('household_id');
      } else {
        expect(meta.columns).not.toContain('household_id');
      }
    }
  });

  // 'households' ist bewusst NICHT in ALL_ENTITIES (siehe Kommentar dort) —
  // deshalb hier ein eigener, expliziter Test statt eines it.each-Eintrags.
  it('households ist wie products global (kein household_id, kein Tombstone)', () => {
    expect(hasServerTombstone('households')).toBe(false);
    expect(ENTITIES.households.householdScoped).toBe(false);
    expect(ENTITIES.households.columns[0]).toBe('id');
    expect(ENTITIES.households.columns).not.toContain('household_id');
    expect(ENTITIES.households.columns).not.toContain('updated_at');
    expect(ENTITIES.households.columns).not.toContain('deleted_at');
    expect(ENTITIES.households.columns).not.toContain('_dirty');
    expect(ENTITIES.households.columns).toEqual(
      expect.arrayContaining([
        'plus_active',
        'plus_expires_at',
        'plus_updated_at',
        'ai_active',
        'ai_expires_at',
        'ai_updated_at',
        'ai_subscriber_id',
      ]),
    );
    expect(ENTITIES.households.columns).not.toEqual(
      expect.arrayContaining(['premium_active', 'premium_expires_at', 'premium_updated_at']),
    );
  });

  it('Chef-History bleibt pull-only und speichert JSON-Spalten als Text', () => {
    expect(ENTITIES.chef_conversations.serverGenerated).toBe(true);
    expect(ENTITIES.chef_conversations.appendOnly).toBeUndefined();
    expect(ENTITIES.chef_conversations.syncCursorColumn).toBeUndefined();
    expect(ENTITIES.chef_conversation_turns).toMatchObject({
      appendOnly: true,
      serverGenerated: true,
      syncCursorColumn: 'created_at',
      jsonColumns: ['request_payload', 'response_payload'],
    });
    expect(ENTITIES.chef_recipe_history).toMatchObject({
      appendOnly: true,
      serverGenerated: true,
      syncCursorColumn: 'created_at',
      jsonColumns: ['recipe_payload'],
    });
  });

  it('Feedback ist push-only und bleibt aus dem Pull-Entity-Set heraus', () => {
    expect(PUSH_ONLY_ENTITIES).toEqual(['shopping_category_feedback_events']);
    expect(ALL_ENTITIES).not.toContain('shopping_category_feedback_events');
    expect(ENTITIES.shopping_category_feedback_events.pushOnly).toBe(true);
    expect(ENTITIES.shopping_category_feedback_events.columns[0]).toBe('event_id');
  });

  it('registriert Receipts und Positionen mit Household-Scope, Tombstones und Schema-Spalten', () => {
    const expected = {
      purchase_receipts: [
        'id',
        'household_id',
        'store_id',
        'purchase_date',
        'currency',
        'total_cents',
        'processing_status',
        'created_by',
        'confirmed_by',
        'confirmed_at',
        'created_at',
      ],
      purchase_receipt_items: [
        'id',
        'receipt_id',
        'household_id',
        'position',
        'name',
        'product_id',
        'category_id',
        'quantity',
        'unit',
        'package_size',
        'package_size_unit',
        'line_total_cents',
        'review_status',
        'created_at',
      ],
    } as const;

    for (const [entity, columns] of Object.entries(expected)) {
      const meta = Object.values(ENTITIES).find((candidate) => candidate.entity === entity);

      expect(meta).toBeDefined();
      expect(meta?.hasServerTombstone).toBe(true);
      expect(meta?.householdScoped).toBe(true);
      expect(meta?.columns).toEqual(columns);
      expect(ALL_ENTITIES).toContain(entity);
    }
  });

  it('hält receipt_assets aus allen generischen Entity-Registries heraus', () => {
    expect(Object.keys(ENTITIES)).not.toContain('receipt_assets');
    expect(ALL_ENTITIES.map(String)).not.toContain('receipt_assets');
  });
});
