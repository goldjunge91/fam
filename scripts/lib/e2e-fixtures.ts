import { createClient } from '@supabase/supabase-js';

// Das Modul dient AUSSCHLIESSLICH der lokalen Entwicklung (Maestro-Fixtures).
// Selbe lokale Service-Role-Konstanten wie scripts/test-users.ts.
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface FreshUser {
  email: string;
  password: string;
  userId: string;
}

/**
 * Legt einen frisch bestaetigten Account ohne Haushalt an (eindeutige
 * E-Mail pro Aufruf). Bewusst OHNE Haushalt: household-step.tsx ueberspringt
 * die Erstellen/Beitreten-Auswahl sofort, sobald der Nutzer schon in einem
 * Haushalt ist - ein Account mit vorhandenem Haushalt koennte die
 * Household-Create/Join-Flows also gar nicht pruefen.
 */
export async function createFreshConfirmedUser(
  prefix: string,
  password = 'Passwort123!',
): Promise<FreshUser> {
  const email = `${prefix}-${Date.now()}@example.com`;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: prefix },
  });

  if (error || !data.user) {
    throw new Error(`Fixture-User ${email} konnte nicht erstellt werden: ${error?.message}`);
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({ id: data.user.id, display_name: prefix, updated_at: new Date().toISOString() });

  if (profileErr) {
    throw new Error(`Profil fuer ${email} konnte nicht angelegt werden: ${profileErr.message}`);
  }

  return { email, password, userId: data.user.id };
}

export interface InviteFixture {
  token: string;
  householdName: string;
  host: FreshUser;
}

/**
 * Legt einen Host-Account samt Haushalt und einem einmal einloesbaren
 * Invite-Token an - direkte Table-Inserts per Service-Role (RLS-Bypass),
 * weil `create_household()`/die Invite-Insert-Policy `auth.uid()` aus dem
 * JWT brauchen und ein Service-Role-Client keine echte User-Session hat.
 * Bildet exakt nach, was `create_household()` in
 * supabase/schemas/08_inventory.sql serverseitig tut (Household +
 * Admin-Mitgliedschaft + drei Standard-Lagerorte), damit der beigetretene
 * Haushalt sich nicht von einem regulaer erstellten unterscheidet.
 */
export async function createInviteFixture(householdName: string): Promise<InviteFixture> {
  const host = await createFreshConfirmedUser('maestro-e2e-host');

  const { data: household, error: householdErr } = await supabase
    .from('households')
    .insert({ name: householdName, created_by: host.userId })
    .select('id')
    .single();

  if (householdErr || !household) {
    throw new Error(`Fixture-Haushalt konnte nicht erstellt werden: ${householdErr?.message}`);
  }

  const { error: memberErr } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: host.userId, role: 'admin' });

  if (memberErr) {
    throw new Error(`Admin-Mitgliedschaft fuer den Fixture-Host schlug fehl: ${memberErr.message}`);
  }

  const { error: locationsErr } = await supabase.from('storage_locations').insert([
    { household_id: household.id, name: 'Kühlschrank', kind: 'fridge', sort_order: 0 },
    { household_id: household.id, name: 'Tiefkühltruhe', kind: 'freezer', sort_order: 1 },
    { household_id: household.id, name: 'Abstellkammer', kind: 'pantry', sort_order: 2 },
  ]);

  if (locationsErr) {
    throw new Error(
      `Standard-Lagerorte fuer den Fixture-Haushalt schlugen fehl: ${locationsErr.message}`,
    );
  }

  const { error: storesErr } = await supabase.from('stores').insert([
    { household_id: household.id, name: 'REWE', color: '#B5623F', sort_order: 0 },
    { household_id: household.id, name: 'Edeka', color: '#748C5B', sort_order: 1 },
    { household_id: household.id, name: 'Aldi', color: '#5C7396', sort_order: 2 },
  ]);

  if (storesErr) {
    throw new Error(
      `Standard-Supermärkte fuer den Fixture-Haushalt schlugen fehl: ${storesErr.message}`,
    );
  }

  const { data: invite, error: inviteErr } = await supabase
    .from('household_invites')
    .insert({
      household_id: household.id,
      created_by: host.userId,
      max_uses: 1,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('token')
    .single();

  if (inviteErr || !invite) {
    throw new Error(`Invite-Token konnte nicht erstellt werden: ${inviteErr?.message}`);
  }

  return { token: invite.token as string, householdName, host };
}
