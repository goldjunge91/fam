import { createHmac, randomUUID } from 'node:crypto';

import {
  createInsertInventoryOperation,
  type InventoryOperationV1,
} from '../src/features/inventory/inventory-lifecycle';

const LOCAL_SUPABASE_URLS = new Set(['127.0.0.1', 'localhost']);
const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321';
const DEFAULT_USER_ID = '2d38b587-2834-4559-a240-48a765754bd0';

export type SeedFood = {
  name: string;
  quantity: number;
  unit: string;
};

export const RANDOM_FOODS: readonly SeedFood[] = [
  { name: 'Reis', quantity: 1, unit: 'kg' },
  { name: 'Vollkornnudeln', quantity: 2, unit: 'package' },
  { name: 'Weizenmehl', quantity: 1, unit: 'kg' },
  { name: 'Zucker', quantity: 1, unit: 'kg' },
  { name: 'Haferflocken', quantity: 2, unit: 'package' },
  { name: 'Rote Linsen', quantity: 1, unit: 'package' },
  { name: 'Kichererbsen', quantity: 3, unit: 'piece' },
  { name: 'Gehackte Tomaten', quantity: 4, unit: 'piece' },
  { name: 'Passierte Tomaten', quantity: 2, unit: 'piece' },
  { name: 'Olivenöl', quantity: 1, unit: 'l' },
  { name: 'Apfelessig', quantity: 1, unit: 'piece' },
  { name: 'Jodsalz', quantity: 1, unit: 'piece' },
  { name: 'Schwarzer Pfeffer', quantity: 1, unit: 'piece' },
  { name: 'Gemüsebrühe', quantity: 1, unit: 'piece' },
  { name: 'Erdnussbutter', quantity: 1, unit: 'piece' },
  { name: 'Honig', quantity: 1, unit: 'piece' },
  { name: 'Filterkaffee', quantity: 1, unit: 'package' },
  { name: 'Kräutertee', quantity: 1, unit: 'package' },
  { name: 'Cornflakes', quantity: 1, unit: 'package' },
  { name: 'Kartoffeln', quantity: 2, unit: 'kg' },
];

type BuildInventoryOperationsInput = {
  userId: string;
  householdId: string;
  locationId: string;
  createdAt: string;
  foods: readonly SeedFood[];
};

type SupabaseConfig = {
  anonKey: string;
  jwtSecret: string;
  url: string;
};

type JsonRecord = Record<string, unknown>;

export function isLocalSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && LOCAL_SUPABASE_URLS.has(url.hostname);
  } catch {
    return false;
  }
}

export function buildInventoryOperations(
  input: BuildInventoryOperationsInput,
): InventoryOperationV1[] {
  if (input.foods.length !== 20) {
    throw new Error(`Expected exactly 20 foods, received ${input.foods.length}.`);
  }

  if (!input.userId || !input.householdId || !input.locationId) {
    throw new Error('User, household, and location IDs are required.');
  }

  const createdAtMs = new Date(input.createdAt).getTime();
  return input.foods.map((food, index) =>
    createInsertInventoryOperation({
      operation_id: randomUUID(),
      created_at: new Date(createdAtMs + index).toISOString(),
      item_id: randomUUID(),
      in_transaction_id: randomUUID(),
      household_id: input.householdId,
      quantity: food.quantity,
      product_id: null,
      name: food.name,
      unit: food.unit,
      package_size: null,
      package_size_unit: null,
      location_id: input.locationId,
      expiry_date: null,
    }),
  );
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

function resolveConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  if (!isLocalSupabaseUrl(url)) {
    throw new Error(`Refusing to seed non-local Supabase URL: ${url}`);
  }

  return {
    url,
    anonKey: requiredEnv('SUPABASE_ANON_KEY'),
    jwtSecret: requiredEnv('SUPABASE_JWT_SECRET'),
  };
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function createUserJwt(userId: string, jwtSecret: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: 'authenticated',
      exp: issuedAt + 900,
      iat: issuedAt,
      iss: 'supabase',
      sub: userId,
      role: 'authenticated',
      session_id: randomUUID(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      aal: 'aal1',
      amr: [{ method: 'password', timestamp: issuedAt }],
    }),
  );
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac('sha256', jwtSecret).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${signature}`;
}

function endpoint(config: SupabaseConfig, path: string): URL {
  return new URL(path, `${config.url.replace(/\/$/, '')}/`);
}

function requestHeaders(config: SupabaseConfig, token: string): HeadersInit {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function responsePayload(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${body.slice(0, 500)}`);
  }
  if (!body) return null;
  return JSON.parse(body) as unknown;
}

async function getRows(
  config: SupabaseConfig,
  token: string,
  resource: string,
  filters: Record<string, string>,
): Promise<JsonRecord[]> {
  const url = endpoint(config, `/rest/v1/${resource}`);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);

  const response = await fetch(url, { headers: requestHeaders(config, token) });
  const payload = await responsePayload(response);
  if (!Array.isArray(payload) || !payload.every(isJsonRecord)) {
    throw new Error(`Unexpected response from ${resource}.`);
  }
  return payload;
}

async function findTargetHousehold(
  config: SupabaseConfig,
  token: string,
  userId: string,
): Promise<string> {
  const rows = await getRows(config, token, 'household_members', {
    select: 'household_id,role',
    user_id: `eq.${userId}`,
  });
  const householdIds = rows
    .map((row) => stringField(row, 'household_id'))
    .filter((value): value is string => value !== undefined);
  if (householdIds.length !== 1) {
    throw new Error(`Expected exactly one household for user, found ${householdIds.length}.`);
  }
  return householdIds[0];
}

async function findPantryLocation(
  config: SupabaseConfig,
  token: string,
  householdId: string,
): Promise<{ id: string; name: string }> {
  const rows = await getRows(config, token, 'storage_locations', {
    select: 'id,name,kind,sort_order',
    household_id: `eq.${householdId}`,
    kind: 'eq.pantry',
    deleted_at: 'is.null',
    order: 'sort_order.asc',
  });
  const location = rows[0];
  const id = location ? stringField(location, 'id') : undefined;
  const name = location ? stringField(location, 'name') : undefined;
  if (!id || !name) throw new Error('No active pantry location exists for this household.');
  return { id, name };
}

async function applyInventoryOperation(
  config: SupabaseConfig,
  token: string,
  operation: InventoryOperationV1,
): Promise<void> {
  const response = await fetch(endpoint(config, '/rest/v1/rpc/apply_inventory_operation'), {
    method: 'POST',
    headers: requestHeaders(config, token),
    body: JSON.stringify({ p_operation: operation }),
  });
  const payload = await responsePayload(response);
  if (!isJsonRecord(payload) || stringField(payload, 'kind') !== 'applied') {
    const kind = isJsonRecord(payload) ? stringField(payload, 'kind') : undefined;
    const code = isJsonRecord(payload) ? stringField(payload, 'code') : undefined;
    throw new Error(
      `Inventory operation ${operation.operation_id} was not applied${
        kind || code ? ` (${[kind, code].filter(Boolean).join('/')})` : ''
      }.`,
    );
  }
}

async function verifySeed(
  config: SupabaseConfig,
  token: string,
  householdId: string,
  locationId: string,
  createdAt: string,
): Promise<string[]> {
  const rows = await getRows(config, token, 'fridge_items', {
    select: 'name,location_id,quantity,unit',
    household_id: `eq.${householdId}`,
    location_id: `eq.${locationId}`,
    deleted_at: 'is.null',
    created_at: `gte.${createdAt}`,
    order: 'created_at.asc',
  });
  return rows
    .map((row) => stringField(row, 'name'))
    .filter((value): value is string => value !== undefined);
}

async function main(): Promise<void> {
  const config = resolveConfig();
  const userId = process.argv[2]?.trim() || DEFAULT_USER_ID;
  const token = createUserJwt(userId, config.jwtSecret);
  const householdId = await findTargetHousehold(config, token, userId);
  const location = await findPantryLocation(config, token, householdId);
  const startedAt = new Date().toISOString();
  const operations = buildInventoryOperations({
    userId,
    householdId,
    locationId: location.id,
    createdAt: startedAt,
    foods: RANDOM_FOODS,
  });

  for (const operation of operations) await applyInventoryOperation(config, token, operation);

  const names = await verifySeed(config, token, householdId, location.id, startedAt);
  const expectedNames = new Set(RANDOM_FOODS.map((food) => food.name));
  const verifiedNames = new Set(names);
  if (names.length !== RANDOM_FOODS.length || expectedNames.size !== verifiedNames.size) {
    throw new Error(`Verification found ${names.length} seeded inventory lots instead of 20.`);
  }
  for (const name of expectedNames) {
    if (!verifiedNames.has(name)) throw new Error(`Verification missed seeded food: ${name}.`);
  }

  console.log(`✅ 20 Lebensmittel in „${location.name}“ für ${userId} angelegt und verifiziert.`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
