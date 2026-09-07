#!/usr/bin/env bun
/**
 * Testbestand fuer ChefKoch. Aufruf im Projektordner:
 *   bun scripts/seed-household-inventory.ts --preview
 *   bun scripts/seed-household-inventory.ts --list
 *   bun scripts/seed-household-inventory.ts --household <uuid> --dry-run
 *   bun scripts/seed-household-inventory.ts --household <uuid>
 *
 * Liest standardmaessig .env.local. Benoetigt SUPABASE_SECRET_KEY oder
 * SUPABASE_SERVICE_ROLE_KEY. Der Emulator-Host 10.0.2.2 wird fuer das
 * Desktop-Skript zu 127.0.0.1. Wiederholungen bewahren auch verbrauchte,
 * bearbeitete und geloeschte Seed-Eintraege. Keine Produktkatalog-Schreibzugriffe.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'dotenv';

import type { Database } from '../src/lib/database.types';

type StorageKind = 'fridge' | 'pantry' | 'freezer';
type Food = readonly [
  name: string,
  quantity: number,
  unit: 'g' | 'kg' | 'ml' | 'l' | 'piece',
  storage: StorageKind,
  expiresInDays: number | null,
];

// Fiktive Haltbarkeiten fuer Testdaten, relativ zum Tag des ersten Imports.
const foods: readonly Food[] = [
  ['Zucchini', 2, 'piece', 'fridge', 2],
  ['Paprika', 3, 'piece', 'fridge', 4],
  ['Brokkoli', 500, 'g', 'fridge', 2],
  ['Champignons', 250, 'g', 'fridge', 1],
  ['Karotten', 1, 'kg', 'fridge', 10],
  ['Babyspinat', 200, 'g', 'fridge', 1],
  ['Eier', 10, 'piece', 'fridge', 14],
  ['Vollmilch', 1, 'l', 'fridge', 5],
  ['Naturjoghurt', 500, 'g', 'fridge', 3],
  ['Feta', 200, 'g', 'fridge', 7],
  ['Gouda', 250, 'g', 'fridge', 12],
  ['Butter', 250, 'g', 'fridge', 21],
  ['Tofu', 400, 'g', 'fridge', 6],
  ['Kartoffeln', 2, 'kg', 'pantry', 14],
  ['Zwiebeln', 5, 'piece', 'pantry', 21],
  ['Knoblauch', 2, 'piece', 'pantry', 30],
  ['Tomaten', 500, 'g', 'pantry', 3],
  ['Spaghetti', 500, 'g', 'pantry', 180],
  ['Basmatireis', 1, 'kg', 'pantry', 180],
  ['Rote Linsen', 500, 'g', 'pantry', 180],
  ['Kichererbsen, gekocht', 400, 'g', 'pantry', 180],
  ['Passierte Tomaten', 500, 'g', 'pantry', 120],
  ['Haferflocken', 500, 'g', 'pantry', 120],
  ['Olivenöl', 500, 'ml', 'pantry', 180],
  ['Salz', 500, 'g', 'pantry', null],
  ['Pfeffer', 50, 'g', 'pantry', null],
  ['Äpfel', 6, 'piece', 'pantry', 10],
  ['TK-Erbsen', 450, 'g', 'freezer', 90],
  ['TK-Beeren', 300, 'g', 'freezer', 90],
  ['Hähnchenbrust', 500, 'g', 'freezer', 60],
];

const storageNames = {
  fridge: 'Kühlschrank',
  pantry: 'Vorratsschrank',
  freezer: 'Tiefkühler',
} satisfies Record<StorageKind, string>;

function seedId(householdId: string, name: string): string {
  const hash = createHash('sha256')
    .update(`fam-inventory-seed:v1:${householdId}:${name}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function expiryDate(days: number | null): string | null {
  if (days === null) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      env: { type: 'string', default: '.env.local' },
      household: { type: 'string' },
      list: { type: 'boolean' },
      preview: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(`Lebensmittel-Testbestand für einen bestehenden Haushalt

bun scripts/seed-household-inventory.ts [Optionen]
  --env <datei>       Konfiguration (Standard: .env.local)
  --preview          Lebensmittel anzeigen, ohne Serververbindung
  --list             Haushaltsnamen und IDs anzeigen
  --household <uuid>  Zielhaushalt (Pflicht für Import und --dry-run)
  --dry-run          Ziel und fehlende Einträge prüfen, ohne zu schreiben

Benötigt SUPABASE_URL oder EXPO_PUBLIC_SUPABASE_URL und
SUPABASE_SECRET_KEY oder SUPABASE_SERVICE_ROLE_KEY.
Vorhandene Seed-Einträge werden niemals überschrieben oder wiederhergestellt.
Nach dem Import die App online synchronisieren lassen.`);
    return;
  }
  if (values.preview) {
    console.table(
      foods.map(([name, quantity, unit, storage, days]) => ({
        Lebensmittel: name,
        Menge: quantity,
        Einheit: unit,
        Lagerort: storageNames[storage],
        Haltbarkeit: expiryDate(days) ?? 'ohne Datum',
      })),
    );
    return;
  }

  const householdId = values.household?.trim();
  if (!values.list && !householdId) {
    throw new Error('--household <uuid> ist erforderlich. Verfügbare Haushalte zeigt --list.');
  }

  const config = { ...process.env, ...parse(readFileSync(values.env)) };
  const rawUrl = config.SUPABASE_URL?.trim() || config.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = config.SUPABASE_SECRET_KEY?.trim() || config.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key)
    throw new Error('Supabase-URL oder serverseitiger Schlüssel fehlt. Siehe --help.');
  const url = new URL(rawUrl);
  if (url.hostname === '10.0.2.2') url.hostname = '127.0.0.1';
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Eine HTTP(S)-Supabase-URL ohne eingebettete Zugangsdaten wird benötigt.');
  }
  console.log(`Supabase: ${url.origin}`);
  const supabase = createClient<Database>(url.toString(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let query = supabase.from('households').select('id, name').order('name').limit(100);
  if (householdId) query = query.eq('id', householdId);
  const { data: households, error: householdError } = await query;
  if (householdError) throw householdError;
  if (values.list) {
    console.table(households);
    return;
  }
  if (households.length !== 1) {
    console.table(households);
    throw new Error(
      'Der angegebene Haushalt wurde nicht gefunden. Verfügbare Haushalte zeigt --list.',
    );
  }
  const household = households[0];
  console.log(`Haushalt: ${household.name} (${household.id})`);

  const ids = foods.map(([name]) => seedId(household.id, name));
  const { data: existing, error: existingError } = await supabase
    .from('fridge_items')
    .select('id')
    .eq('household_id', household.id)
    .in('id', ids);
  if (existingError) throw existingError;
  const existingIds = new Set(existing.map((item) => item.id));
  const missing = foods.filter(([name]) => !existingIds.has(seedId(household.id, name)));
  console.log(`${missing.length} neue Lebensmittel, ${existing.length} bereits importiert.`);
  if (values['dry-run']) {
    console.table(
      missing.map(([name, quantity, unit, storage]) => ({ name, quantity, unit, storage })),
    );
    return;
  }

  const rows: Database['public']['Tables']['fridge_items']['Insert'][] = [];
  if (missing.length > 0) {
    const { data: locations, error } = await supabase
      .from('storage_locations')
      .select('id, kind')
      .eq('household_id', household.id)
      .is('deleted_at', null)
      .order('sort_order')
      .order('id');
    if (error) throw error;
    for (const kind of ['fridge', 'pantry', 'freezer'] as const) {
      const matchingFoods = missing.filter((food) => food[3] === kind);
      if (matchingFoods.length === 0) continue;
      let locationId = locations.find((location) => location.kind === kind)?.id;
      if (!locationId) {
        locationId = randomUUID();
        const { error: locationError } = await supabase.from('storage_locations').insert({
          id: locationId,
          household_id: household.id,
          name: storageNames[kind],
          kind,
          sort_order: Object.keys(storageNames).indexOf(kind),
        });
        if (locationError) throw locationError;
      }
      for (const [name, quantity, unit, , days] of matchingFoods) {
        rows.push({
          id: seedId(household.id, name),
          household_id: household.id,
          location_id: locationId,
          name,
          quantity,
          unit,
          expiry_date: expiryDate(days),
          expiry_user_set: days !== null,
        });
      }
    }
    const { error: insertError } = await supabase
      .from('fridge_items')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (insertError) throw insertError;
  }

  // Separater Ledger-Schritt ist wiederholbar, auch nach einem abgebrochenen Import.
  const { data: seeded, error: verifyError } = await supabase
    .from('fridge_items')
    .select('id, name, location_id, created_at')
    .eq('household_id', household.id)
    .in('id', ids);
  if (verifyError) throw verifyError;
  if (seeded.length !== foods.length)
    throw new Error('Bestand konnte nicht vollständig verifiziert werden.');
  const transactions = foods.map(([name, quantity]) => {
    const item = seeded.find((row) => row.id === seedId(household.id, name));
    if (!item) throw new Error(`Import fehlt: ${name}`);
    return {
      id: seedId(household.id, `transaction:${name}`),
      household_id: household.id,
      fridge_item_id: item.id,
      location_id: item.location_id,
      type: 'in',
      quantity,
      notes: 'Lebensmittel-Testbestand',
      created_at: item.created_at,
    } satisfies Database['public']['Tables']['transactions']['Insert'];
  });
  const { error: transactionError } = await supabase
    .from('transactions')
    .upsert(transactions, { onConflict: 'id', ignoreDuplicates: true });
  if (transactionError) throw transactionError;
  console.log(
    `Import geprüft: ${seeded.length} Seed-Einträge vorhanden. App online synchronisieren lassen.`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : 'Unbekannter Fehler';
  console.error(`Lebensmittel-Import fehlgeschlagen: ${message}`);
  process.exitCode = 1;
});
