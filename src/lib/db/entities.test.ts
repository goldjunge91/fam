import { ALL_ENTITIES, ENTITIES, hasServerTombstone, metaOf } from '@/lib/db/entities';
import type { Entity } from '@/lib/db/types';

describe('entities', () => {
  it('kennt genau die vier Spiegeltabellen aus #45', () => {
    expect(ALL_ENTITIES).toEqual([
      'storage_locations',
      'fridge_items',
      'shopping_list_items',
      'products',
    ]);
  });

  it('hasServerTombstone ist nur bei products false', () => {
    const expected: Record<Entity, boolean> = {
      storage_locations: true,
      fridge_items: true,
      shopping_list_items: true,
      products: false,
    };

    for (const entity of ALL_ENTITIES) {
      expect(hasServerTombstone(entity)).toBe(expected[entity]);
    }
  });

  it('householdScoped ist nur bei products false', () => {
    const expected: Record<Entity, boolean> = {
      storage_locations: true,
      fridge_items: true,
      shopping_list_items: true,
      products: false,
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
});
