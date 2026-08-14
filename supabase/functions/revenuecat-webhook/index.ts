// @ts-nocheck deno-lint-ignore-file
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * RevenueCat-Webhook: haelt `households.premium_active` haushaltsweit
 * aktuell (#???, "echte Paywall im Essensplaner").
 *
 * `app_user_id` im Event IST die `household_id` — `premium-provider.tsx`
 * bindet RevenueCat per `Purchases.logIn(activeHouseholdId)` an den
 * Haushalt statt an die einzelne Person, sonst gaebe es keine eindeutige
 * Zuordnung von "wer hat gekauft" zu "welcher Haushalt profitiert". Deshalb
 * hier keine Lookup-Tabelle noetig, nur ein direktes `where id = app_user_id`.
 *
 * Auth: RevenueCat schickt keinen Supabase-JWT, deshalb `verify_jwt = false`
 * in config.toml — stattdessen ein geteiltes Secret im `Authorization`-
 * Header, das im RevenueCat-Dashboard unter Webhooks konfiguriert wird
 * (Projekteinstellung, kein HMAC/Signatur-Schema).
 *
 * Kein Dedupe-Speicher fuer `event.id`: Jeder Handler-Zweig schreibt einen
 * deterministischen Endzustand (`premium_active = true/false`,
 * `premium_expires_at = <Zeitpunkt aus dem Event>`) statt inkrementell zu
 * aendern — eine erneut zugestellte Kopie desselben Events landet exakt
 * beim selben Ergebnis. Ein Dedupe-Log waere hier zusaetzlicher Zustand ohne
 * zusaetzliche Korrektheit.
 *
 * CANCELLATION widerruft bewusst NICHTS: Das Abo laeuft bis zum bereits
 * bekannten `expiration_at_ms` weiter, RevenueCat schickt zu diesem
 * Zeitpunkt von selbst ein `EXPIRATION` — kein eigener Cron-Job noetig.
 * BILLING_ISSUE ist ebenfalls kein Widerruf (Grace Period/Account Hold).
 */

const RELEVANT_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'EXPIRATION',
]);

type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[];
  expiration_at_ms?: number | null;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const providedSecret = req.headers.get('Authorization');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event: RevenueCatEvent;
  try {
    const body = await req.json();
    event = body.event;
    if (!event?.app_user_id || !event?.type) throw new Error('missing app_user_id/type');
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'invalid_payload', message: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Events ausserhalb unseres Entitlements oder ohne Bezug zu unserer
  // households-Zeile (SUBSCRIBER_ALIAS, TRANSFER, TEST) quittieren wir mit
  // 200, statt sie als Fehler zu behandeln — RevenueCat wuerde einen
  // Nicht-2xx sonst als zuzustellenden Retry werten.
  if (!RELEVANT_EVENT_TYPES.has(event.type)) {
    return new Response(JSON.stringify({ ignored: event.type }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const premiumActive = event.type !== 'EXPIRATION';
  const premiumExpiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { error, count } = await adminClient
    .from('households')
    .update(
      {
        premium_active: premiumActive,
        premium_expires_at: premiumExpiresAt,
        premium_updated_at: new Date().toISOString(),
      },
      { count: 'exact' },
    )
    .eq('id', event.app_user_id);

  if (error) {
    return new Response(JSON.stringify({ error: 'update_failed', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Kein Haushalt mit dieser id — z. B. ein Test-Event aus dem Dashboard mit
  // einer erfundenen app_user_id, oder ein waehrend eines Trials geloeschter
  // Haushalt. Kein Fehler, aber sichtbar im Response-Body statt stillschweigend.
  return new Response(JSON.stringify({ updated: count ?? 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
