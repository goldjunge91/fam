import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requireLocalUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('SUPABASE_URL ist keine gueltige URL. Erwartet wird http://127.0.0.1:54321.');
  }
  assert(
    parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'),
    `Abbruch: Dieses Skript akzeptiert ausschliesslich lokale Supabase-URLs, erhalten: ${value}`,
  );
}

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}

function uniqueEmail(): string {
  return `inventory-move-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function main(): Promise<void> {
  requireLocalUrl(url);
  assert(anonKey, 'SUPABASE_ANON_KEY oder EXPO_PUBLIC_SUPABASE_KEY fehlt.');
  assert(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY fehlt.');

  const admin = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient<Database>(url, anonKey, {
    auth: { storage: storage(), persistSession: true, autoRefreshToken: false },
  });

  const email = uniqueEmail();
  const password = 'langgenug1';
  const { error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert(!createUserError, `Testnutzer konnte nicht angelegt werden: ${createUserError?.message}`);

  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  assert(!signInError, `Testnutzer konnte sich nicht anmelden: ${signInError?.message}`);

  const { data: householdId, error: householdError } = await client.rpc('create_household', {
    household_name: `Live-Move-Test ${email}`,
  });
  assert(
    !householdError && householdId,
    `Haushalt konnte nicht angelegt werden: ${householdError?.message}`,
  );

  const { data: locations, error: locationsError } = await client
    .from('storage_locations')
    .select('id, kind')
    .eq('household_id', householdId)
    .in('kind', ['fridge', 'pantry']);
  assert(!locationsError, `Lagerorte konnten nicht gelesen werden: ${locationsError?.message}`);
  const oldLocationId = locations?.find((location) => location.kind === 'fridge')?.id;
  const newLocationId = locations?.find((location) => location.kind === 'pantry')?.id;
  assert(oldLocationId && newLocationId, 'Standard-Lagerorte fuer den Live-Test fehlen.');

  const itemId = crypto.randomUUID();
  const { error: itemError } = await client.from('fridge_items').insert({
    id: itemId,
    household_id: householdId,
    location_id: oldLocationId,
    name: 'Live-Move-Milch',
    quantity: 2,
    unit: 'piece',
  });
  assert(!itemError, `Testbestand konnte nicht angelegt werden: ${itemError?.message}`);

  const operationId = crypto.randomUUID();
  const outTransactionId = crypto.randomUUID();
  const inTransactionId = crypto.randomUUID();
  const payload = {
    p_operation_id: operationId,
    p_item_id: itemId,
    p_household_id: householdId,
    p_expected_location_id: oldLocationId,
    p_new_location_id: newLocationId,
    p_expected_quantity: 2,
    p_out_transaction_id: outTransactionId,
    p_in_transaction_id: inTransactionId,
    p_created_at: new Date().toISOString(),
  };

  const firstMove = await client.rpc('move_fridge_item', payload);
  assert(!firstMove.error, `Erster Move fehlgeschlagen: ${firstMove.error?.message}`);
  assert(firstMove.data === itemId, 'Der Move-RPC gab nicht die Bestands-ID zurueck.');

  const movedItem = await client
    .from('fridge_items')
    .select('location_id')
    .eq('id', itemId)
    .single();
  assert(
    !movedItem.error,
    `Verschobener Bestand konnte nicht gelesen werden: ${movedItem.error?.message}`,
  );
  assert(
    movedItem.data.location_id === newLocationId,
    'Der Bestand liegt nicht am neuen Lagerort.',
  );

  const ledger = await client
    .from('transactions')
    .select('id, type, operation_id')
    .eq('operation_id', operationId)
    .order('type');
  assert(!ledger.error, `Move-Ledger konnte nicht gelesen werden: ${ledger.error?.message}`);
  assert(ledger.data.length === 2, 'Der Move hat nicht genau zwei Ledgerzeilen erzeugt.');
  assert(
    ledger.data.map((row) => row.type).join(',') === 'in,out',
    'Das Move-Ledger hat nicht die erwarteten in/out-Zeilen.',
  );

  const retry = await client.rpc('move_fridge_item', payload);
  assert(!retry.error, `Idempotenz-Retry fehlgeschlagen: ${retry.error?.message}`);
  const retryLedger = await client
    .from('transactions')
    .select('id')
    .eq('operation_id', operationId);
  assert(
    !retryLedger.error && retryLedger.data.length === 2,
    'Der Retry hat Ledgerzeilen dupliziert.',
  );

  const failedOperationId = crypto.randomUUID();
  const failedMove = await client.rpc('move_fridge_item', {
    ...payload,
    p_operation_id: failedOperationId,
    p_expected_location_id: newLocationId,
    p_new_location_id: null,
    p_out_transaction_id: outTransactionId,
    p_in_transaction_id: crypto.randomUUID(),
  });
  assert(failedMove.error, 'Der absichtlich kollidierende Move wurde unerwartet akzeptiert.');

  const unchangedItem = await client
    .from('fridge_items')
    .select('location_id')
    .eq('id', itemId)
    .single();
  assert(
    !unchangedItem.error,
    `Rollback-Bestand konnte nicht gelesen werden: ${unchangedItem.error?.message}`,
  );
  assert(
    unchangedItem.data.location_id === newLocationId,
    'Der fehlgeschlagene Move hat den Bestand veraendert.',
  );
  const failedLedger = await client
    .from('transactions')
    .select('id')
    .eq('operation_id', failedOperationId);
  assert(
    !failedLedger.error && failedLedger.data.length === 0,
    'Der fehlgeschlagene Move hat Ledgerdaten hinterlassen.',
  );

  console.log('PASS: atomarer Inventory-Move, Retry und Remote-Rollback verifiziert.');
  console.log(`Haushalt: ${householdId}`);
  console.log(`Bestand: ${itemId}`);
  console.log(`Alter Lagerort: ${oldLocationId}`);
  console.log(`Neuer Lagerort: ${newLocationId}`);
  console.log(`Operation: ${operationId}`);
  console.log(`Out-Ledger: ${outTransactionId}`);
  console.log(`In-Ledger: ${inTransactionId}`);
  console.log(`Fehlgeschlagene Operation ohne Daten: ${failedOperationId}`);
  console.log('Studio: http://127.0.0.1:54323');
  console.log(
    `Studio-Abfrage Bestand: select id, location_id, quantity from public.fridge_items where id = '${itemId}';`,
  );
  console.log(
    `Studio-Abfrage Ledger: select id, operation_id, type, location_id, quantity, actor, created_at from public.transactions where operation_id = '${operationId}' order by type;`,
  );
  console.log('Die Testdaten bleiben absichtlich fuer die Studio-Pruefung bestehen.');
}

main().catch((error: unknown) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
