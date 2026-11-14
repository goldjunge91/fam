import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { getRequiredServiceRoleKey } from './service-role-key';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const TEST_USER_ID = '9d4fb230-d05d-4aae-9e91-9e62c2127e47';
const TEST_USER_EMAIL = 'm.tozzi91@icloud.com';
const HOUSEHOLD_IDS = new Set([
  '4a8d2140-db15-46c6-8567-40dfab9adb23',
  '31230b06-a1d7-45dd-84cf-c3e785413d98',
]);

type Row = Record<string, unknown>;
type HouseholdSeed = {
  version: number;
  userId: string;
  householdIds: string[];
  profile: Row;
  households: Row[];
  memberships: Row[];
  products: Row[];
  storageLocations: Row[];
  stores: Row[];
  fridgeItems: Row[];
  shoppingListItems: Row[];
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localEnvPath = resolve(projectRoot, '.env.development.local');
const seedPath = resolve(projectRoot, '.env.local-household-seed.json');
config({ path: localEnvPath });

const password = process.env.LOCAL_TEST_USER_PASSWORD?.trim();
if (!password || password.length < 12) {
  throw new Error(
    `Set a password of at least 12 characters in ${localEnvPath} as LOCAL_TEST_USER_PASSWORD.`,
  );
}

const localUrl = new URL(LOCAL_SUPABASE_URL);
if (localUrl.hostname !== '127.0.0.1' || localUrl.port !== '54321') {
  throw new Error('Refusing to run unless the target is the local Supabase API.');
}

const supabase = createClient(LOCAL_SUPABASE_URL, getRequiredServiceRoleKey(), {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

function loadHouseholdSeed(): HouseholdSeed {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as HouseholdSeed;
  const configuredIds = [...HOUSEHOLD_IDS].sort();

  if (
    seed.version !== 1 ||
    seed.userId !== TEST_USER_ID ||
    seed.profile.id !== TEST_USER_ID ||
    JSON.stringify([...seed.householdIds].sort()) !== JSON.stringify(configuredIds)
  ) {
    throw new Error('Local household seed does not match the configured test user and households.');
  }

  if (
    seed.households.some((row) => !HOUSEHOLD_IDS.has(String(row.id))) ||
    seed.memberships.some(
      (row) => row.user_id !== TEST_USER_ID || !HOUSEHOLD_IDS.has(String(row.household_id)),
    )
  ) {
    throw new Error('Local household seed contains an unexpected membership.');
  }

  for (const rows of [
    seed.storageLocations,
    seed.stores,
    seed.fridgeItems,
    seed.shoppingListItems,
  ]) {
    if (rows.some((row) => !HOUSEHOLD_IDS.has(String(row.household_id)))) {
      throw new Error('Local household seed contains an unexpected household ID.');
    }
  }

  const productIds = new Set(seed.products.map((row) => String(row.id)));
  for (const row of [...seed.fridgeItems, ...seed.shoppingListItems]) {
    if (row.product_id && !productIds.has(String(row.product_id))) {
      throw new Error('Local household seed is missing a referenced product.');
    }
  }

  return seed;
}

async function ensureLocalTestUser() {
  const { data, error } = await supabase.auth.admin.getUserById(TEST_USER_ID);

  if (error && error.status !== 404) {
    throw new Error(`Local Auth lookup failed (${error.status ?? 'unknown status'}).`);
  }

  if (!error && data.user.email?.toLowerCase() !== TEST_USER_EMAIL.toLowerCase()) {
    throw new Error('The fixed user ID belongs to a different local email; no changes were made.');
  }

  if (error) {
    const { error: createError } = await supabase.auth.admin.createUser({
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      password,
      email_confirm: true,
    });

    if (createError) {
      throw new Error(`Local Auth create failed (${createError.status ?? 'unknown status'}).`);
    }
  } else {
    const { error: updateError } = await supabase.auth.admin.updateUserById(TEST_USER_ID, {
      password,
      email_confirm: true,
    });

    if (updateError) {
      throw new Error(`Local Auth update failed (${updateError.status ?? 'unknown status'}).`);
    }
  }
}

async function upsert(
  table:
    | 'profiles'
    | 'products'
    | 'households'
    | 'household_members'
    | 'storage_locations'
    | 'stores'
    | 'fridge_items'
    | 'shopping_list_items',
  rows: Row[],
  onConflict: string,
) {
  if (rows.length === 0) return;

  const { error } = await supabase.from(table).upsert(rows as never, { onConflict });
  if (error) {
    throw new Error(`Local ${table} restore failed (${error.code ?? 'unknown error'}).`);
  }
}

async function main() {
  const seed = loadHouseholdSeed();
  await ensureLocalTestUser();

  await upsert('profiles', [seed.profile], 'id');
  await upsert('products', seed.products, 'id');
  await upsert('households', seed.households, 'id');
  await upsert('household_members', seed.memberships, 'household_id,user_id');
  await upsert('storage_locations', seed.storageLocations, 'id');
  await upsert('stores', seed.stores, 'id');
  await upsert('fridge_items', seed.fridgeItems, 'id');
  await upsert('shopping_list_items', seed.shoppingListItems, 'id');

  console.log(
    `Ensured the local test user and restored ${seed.households.length} households, ${seed.fridgeItems.length} fridge items, and ${seed.shoppingListItems.length} shopping-list items.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown local restore error.';
  console.error(`Could not restore the local test data: ${message}`);
  process.exitCode = 1;
});
