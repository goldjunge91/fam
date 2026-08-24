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
      'fridge_items',
      'shopping_list_items',
      'shopping_category_preferences',
      'products',
      'recipes',
      'recipe_components',
      'recipe_component_items',
      'recipe_steps',
      'recipe_step_ingredients',
      'meal_plans',
      'meal_plan_entries',
    ]);
  });

  // `households` ist bewusst nicht in ALL_ENTITIES (siehe Kommentar dort) und
  // taucht deshalb in der Schleife unten nie auf — steht in `expected` trotzdem
  // mit drin, damit der Typ `Record<Entity, boolean>` vollstaendig bleibt und
  // die Aussage "products UND households sind global" an einer Stelle sichtbar
  // ist (die eigentliche Zusicherung dafuer steckt im Test weiter unten).
  it('hasServerTombstone ist nur bei products und households false', () => {
    const expected: Record<Entity, boolean> = {
      storage_locations: true,
      stores: true,
      fridge_items: true,
      shopping_list_items: true,
      shopping_category_preferences: true,
      shopping_category_feedback_events: false,
      products: false,
      households: false,
      recipes: true,
      recipe_components: true,
      recipe_component_items: true,
      recipe_steps: true,
      recipe_step_ingredients: true,
      meal_plans: true,
      meal_plan_entries: true,
    };

    for (const entity of ALL_ENTITIES) {
      expect(hasServerTombstone(entity)).toBe(expected[entity]);
    }
  });

  it('householdScoped ist nur bei products und households false', () => {
    const expected: Record<Entity, boolean> = {
      storage_locations: true,
      stores: true,
      fridge_items: true,
      shopping_list_items: true,
      shopping_category_preferences: true,
      shopping_category_feedback_events: false,
      products: false,
      households: false,
      recipes: true,
      recipe_components: true,
      recipe_component_items: true,
      recipe_steps: true,
      recipe_step_ingredients: true,
      meal_plans: true,
      meal_plan_entries: true,
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
  });

  it('Feedback ist push-only und bleibt aus dem Pull-Entity-Set heraus', () => {
    expect(PUSH_ONLY_ENTITIES).toEqual(['shopping_category_feedback_events']);
    expect(ALL_ENTITIES).not.toContain('shopping_category_feedback_events');
    expect(ENTITIES.shopping_category_feedback_events.pushOnly).toBe(true);
    expect(ENTITIES.shopping_category_feedback_events.columns[0]).toBe('event_id');
  });
});
