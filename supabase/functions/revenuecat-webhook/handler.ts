const PREMIUM_ENTITLEMENT_ID = 'Premium';

const ACTIVATION_EVENT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
]);

const RELEVANT_EVENT_TYPES = new Set([...ACTIVATION_EVENT_TYPES, 'EXPIRATION']);

export type SubscriberAttribute = {
  value: string;
  updated_at_ms?: number;
};

export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  subscriber_attributes?: Record<string, SubscriberAttribute> | null;
};

export type HouseholdPremiumUpdate = {
  premium_active: boolean;
  premium_expires_at: string | null;
  premium_updated_at: string;
};

type UpdateResult = {
  error: { message: string } | null;
  count: number | null;
};

type Dependencies = {
  expectedSecret: string | undefined;
  updateHousehold: (
    appUserId: string,
    update: HouseholdPremiumUpdate,
    subscriberAttributes?: Record<string, SubscriberAttribute> | null,
  ) => Promise<UpdateResult>;
  now?: () => Date;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isRevenueCatEvent(value: unknown): value is RevenueCatEvent {
  if (!value || typeof value !== 'object') return false;

  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    event.id.length > 0 &&
    typeof event.type === 'string' &&
    event.type.length > 0 &&
    typeof event.app_user_id === 'string' &&
    event.app_user_id.length > 0 &&
    (event.entitlement_ids == null ||
      (Array.isArray(event.entitlement_ids) &&
        event.entitlement_ids.every((entitlement) => typeof entitlement === 'string'))) &&
    (event.expiration_at_ms === undefined ||
      event.expiration_at_ms === null ||
      (typeof event.expiration_at_ms === 'number' && Number.isFinite(event.expiration_at_ms))) &&
    (event.subscriber_attributes == null ||
      (typeof event.subscriber_attributes === 'object' && !Array.isArray(event.subscriber_attributes)))
  );
}

/**
 * Baut den HTTP-Handler getrennt vom Deno-Einstiegspunkt. Dadurch lassen sich
 * Authentifizierung und Eventregeln ohne Netzwerk oder echte Datenbank testen.
 *
 * Wiederholte Zustellung desselben Events ist sicher: Jeder relevante Event
 * schreibt einen absoluten Zustand statt einen Wert inkrementell zu veraendern.
 * CANCELLATION und BILLING_ISSUE aendern bewusst nichts. RevenueCat sendet
 * EXPIRATION, sobald bezahlter Zugriff beziehungsweise die Grace Period endet.
 */
export function createRevenueCatWebhookHandler({
  expectedSecret,
  updateHousehold,
  now = () => new Date(),
}: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    if (!expectedSecret || req.headers.get('Authorization') !== expectedSecret) {
      return json({ error: 'unauthorized' }, 401);
    }

    let event: RevenueCatEvent;
    try {
      const body: unknown = await req.json();
      const candidate =
        body && typeof body === 'object' ? (body as Record<string, unknown>).event : undefined;
      if (!isRevenueCatEvent(candidate)) throw new Error('invalid event');
      event = candidate;
    } catch (error) {
      return json(
        {
          error: 'invalid_payload',
          message: error instanceof Error ? error.message : String(error),
        },
        400,
      );
    }

    if (!RELEVANT_EVENT_TYPES.has(event.type)) {
      return json({ ignored: event.type });
    }

    // Das RevenueCat-Projekt kann spaeter weitere Entitlements enthalten.
    // Ein Kauf davon darf nicht versehentlich Haushalts-Premium freischalten.
    if (!event.entitlement_ids?.includes(PREMIUM_ENTITLEMENT_ID)) {
      return json({ ignored: 'unrelated_entitlement' });
    }

    const result = await updateHousehold(
      event.app_user_id,
      {
        premium_active: ACTIVATION_EVENT_TYPES.has(event.type),
        premium_expires_at: event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null,
        premium_updated_at: now().toISOString(),
      },
      event.subscriber_attributes,
    );

    if (result.error) {
      return json({ error: 'update_failed', message: result.error.message }, 500);
    }

    // Ein geloeschter oder fuer Dashboard-Tests erfundener Haushalt ist kein
    // Retry-Fall. Die Anzahl bleibt fuer die RevenueCat-Zustellhistorie sichtbar.
    return json({ updated: result.count ?? 0 });
  };
}
