// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Account- und Datenloeschung (#98). Der Client kann `auth.users` nicht
 * selbst loeschen — nur die Admin-API mit Service-Role kann das
 * (`supabase.auth.admin.deleteUser`). Deshalb eine Edge Function statt eines
 * einfachen RPCs.
 *
 * Ablauf:
 *  1. Anrufer per Authorization-Header identifizieren (Standard-JWT-
 *     Verifikation der Edge Runtime laeuft davor bereits, `verify_jwt` steht
 *     nicht in config.toml auf `false`).
 *  2. `public.prepare_account_deletion()` als der Nutzer selbst aufrufen
 *     (SECURITY DEFINER, arbeitet ausschliesslich auf auth.uid()) — raeumt
 *     Haushaltsbezuege auf oder bricht mit `last_admin_with_members` ab, wenn
 *     der Nutzer irgendwo der letzte Admin mit weiteren Mitgliedern ist.
 *     Client bekommt diesen Fall als 409 zurueck und muss vorher Admin
 *     uebertragen oder den Haushalt loeschen (siehe members-screen.tsx).
 *  3. Erst danach `auth.admin.deleteUser()` mit Service-Role — kaskadiert
 *     ueber `profiles.id references auth.users(id) on delete cascade` auf
 *     Profil, Tagebuch, Gewicht, Ziele und die eigene household_members-Zeile.
 */
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client "als der Nutzer" — respektiert RLS/auth.uid(), fuer den Aufruf des
  // vorbereitenden RPCs.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error: prepareError } = await userClient.rpc('prepare_account_deletion');

  if (prepareError) {
    if (prepareError.message?.includes('last_admin_with_members')) {
      return new Response(
        JSON.stringify({
          error: 'last_admin_with_members',
          message: prepareError.message,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: 'prepare_failed', message: prepareError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Erst jetzt Service-Role — nur fuer den einen Schritt, den RLS grundsaetzlich
  // nicht erlauben kann.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return new Response(JSON.stringify({ error: 'delete_failed', message: deleteError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
