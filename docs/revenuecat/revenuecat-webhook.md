# RevenueCat-Webhook

Der Webhook spiegelt das Entitlement `Premium` aus RevenueCat auf den aktiven
Haushalt in Supabase. RevenueCat verwendet dabei die Haushalts-ID als
`app_user_id`; der Client bindet sie über `Purchases.logIn(activeHouseholdId)`.

## Supabase

Die Function ist unter folgender URL erreichbar:

```text
https://ivvebtqasotqpikuydov.supabase.co/functions/v1/revenuecat-webhook
```

Sie benötigt keinen Supabase-JWT. Stattdessen muss ein starkes, zufälliges
Secret als Edge-Function-Secret hinterlegt werden:

```bash
supabase secrets set REVENUECAT_WEBHOOK_SECRET='<secret>' \
  --project-ref ivvebtqasotqpikuydov
supabase functions deploy revenuecat-webhook \
  --project-ref ivvebtqasotqpikuydov \
  --no-verify-jwt
```

Das Secret darf nie als `EXPO_PUBLIC_*`-Variable oder im Repository abgelegt
werden.

## RevenueCat-Dashboard

Unter **Integrations → Webhooks** eine Konfiguration mit folgenden Werten
anlegen:

- URL: die Supabase-Function-URL oben
- Authorization header: exakt derselbe Wert wie `REVENUECAT_WEBHOOK_SECRET`
- Environment: Sandbox und Production
- Events: mindestens `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`,
  `PRODUCT_CHANGE` und `EXPIRATION`

`CANCELLATION` und `BILLING_ISSUE` dürfen zugestellt werden, ändern den Zugriff
aber nicht. RevenueCat sendet `EXPIRATION`, wenn der bezahlte Zeitraum oder die
Grace Period tatsächlich endet.

## Prüfen

Die Serverlogik läuft ohne externe Dienste:

```bash
bun run test:functions
```

Nach jedem Deployment im RevenueCat-Dashboard einen Test-Webhook für das
Entitlement `Premium` senden. Erwartet wird HTTP 200. Ein falscher oder
fehlender Authorization-Header muss HTTP 401 liefern. Ein Event für ein anderes
Entitlement wird mit HTTP 200 quittiert, darf den Haushaltsstatus aber nicht
ändern.
