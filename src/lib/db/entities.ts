import type { Entity } from '@/lib/db/types';

/**
 * Pro-Entity-Metadaten der Sync-Engine (#47).
 *
 * Rein: eine statische Nachschlagetabelle, kein Grund fuer Datenbank oder
 * Netzwerk. Gemeinsam genutzt von Pull, Push und Outbox-Enqueue-Aufrufern,
 * damit die Spaltenliste je Entity nur an einer Stelle steht.
 */

export type EntityMeta = {
  entity: Entity;
  /** Lokaler und entfernter Tabellenname sind identisch — deshalb derselbe Typ wie `entity`. */
  table: Entity;
  /** false bei 'products' und 'households' — dort gibt es serverseitig kein deleted_at (harte Loeschung). */
  hasServerTombstone: boolean;
  /** false bei 'products' und 'households' — beide global, kein household_id-Praefix. */
  householdScoped: boolean;
  /** Spalten ohne updated_at/deleted_at/_dirty, id zuerst. 1:1 aus migrations.ts's V1_MIRRORS. */
  columns: readonly string[];
};

export const ENTITIES: Readonly<Record<Entity, EntityMeta>> = {
  storage_locations: {
    entity: 'storage_locations',
    table: 'storage_locations',
    hasServerTombstone: true,
    householdScoped: true,
    columns: ['id', 'household_id', 'name', 'kind', 'sort_order', 'created_at'],
  },
  stores: {
    entity: 'stores',
    table: 'stores',
    hasServerTombstone: true,
    householdScoped: true,
    columns: ['id', 'household_id', 'name', 'color', 'sort_order', 'category_order', 'created_at'],
  },
  fridge_items: {
    entity: 'fridge_items',
    table: 'fridge_items',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'household_id',
      'location_id',
      'product_id',
      'name',
      'quantity',
      'unit',
      'expiry_date',
      'added_by',
      'created_at',
    ],
  },
  shopping_list_items: {
    entity: 'shopping_list_items',
    table: 'shopping_list_items',
    hasServerTombstone: true,
    householdScoped: true,
    columns: [
      'id',
      'household_id',
      'product_id',
      'name',
      'quantity',
      'unit',
      'category',
      'sort_index',
      'store_id',
      'price_estimate',
      'checked_at',
      'checked_by',
      'added_by',
      'created_at',
    ],
  },
  products: {
    entity: 'products',
    table: 'products',
    hasServerTombstone: false,
    householdScoped: false,
    columns: [
      'id',
      'barcode',
      'name',
      'brand',
      'kcal_per_100',
      'protein_g_per_100',
      'carbs_g_per_100',
      'fat_g_per_100',
      'fiber_g_per_100',
      'sugar_g_per_100',
      'salt_g_per_100',
      'serving_size_g',
      'source',
      'created_by',
      'created_at',
    ],
  },
  households: {
    entity: 'households',
    table: 'households',
    hasServerTombstone: false,
    householdScoped: false,
    columns: ['id', 'name', 'created_by', 'created_at'],
  },
};

/**
 * Default-Entity-Set fuer `pullHousehold()` — bewusst OHNE 'households'.
 *
 * `pullHousehold()` wird immer schon mit einer bekannten Haushalts-Id
 * aufgerufen (`useSyncEngine`). 'households' wird stattdessen exklusiv vom
 * nutzerscoped Bootstrap-Trigger (`household-bootstrap-sync.ts`) per
 * `entities: ['households']`-Override gepullt — sonst gaebe es einen
 * redundanten Voll-Pull bei jedem 20s-Tick jedes aktiven Haushalts.
 */
export const ALL_ENTITIES: readonly Entity[] = [
  'storage_locations',
  'stores',
  'fridge_items',
  'shopping_list_items',
  'products',
];

export function hasServerTombstone(entity: Entity): boolean {
  return ENTITIES[entity].hasServerTombstone;
}

export function metaOf(entity: Entity): EntityMeta {
  return ENTITIES[entity];
}
