# RevenueCat-Webhook

Die Supabase Edge Function `revenuecat-webhook` projiziert die beiden
RevenueCat-Entitlements `Plus` und `AI` auf den serverseitigen Haushaltsstatus.
Der Client entscheidet nicht über den haushaltsweiten Premiumzugriff.

```text
RevenueCat
  -> signierter POST
  -> Supabase Edge Function
  -> service-role RPC
  -> households.plus_active / households.ai_active
```

## Datenmodell und Identität

- RevenueCat-`app_user_id` ist die UUID des angemeldeten Supabase-Nutzers.
  Die App setzt sie über `Purchases.logIn(session.user.id)`. Die Haushalts-ID
  darf hier nicht verwendet werden.
- `entitlement_ids` enthält `Plus`, `AI` oder beide. Die Entitlements werden
  unabhängig voneinander verarbeitet.
- Das Subscriber-Attribut `household_id` bezeichnet den Haushalt, auf den ein
  neues Entitlement projiziert werden soll. Die Function prüft vor jedem
  Schreibzugriff, ob der Nutzer Mitglied dieses Haushalts ist.
- Fehlt `household_id`, wird der zuletzt beigetretene Haushalt des Nutzers als
  Fallback verwendet.
- `households.plus_active` und `households.ai_active` sind die gemeinsam
  lesbare Projektion für alle Haushaltsmitglieder. Die kanonischen Zuordnungen
  liegen in `revenuecat_plus_assignments` und `revenuecat_ai_assignments`.

Anonyme RevenueCat-IDs sind für diesen Webhook nicht zulässig. Käufe müssen an
einen angemeldeten Nutzer gebunden sein, bevor ein Webhook den Haushaltsstatus
ändern kann.

## Komplett neu aufsetzen

Die Reihenfolge für ein neues RevenueCat-/Supabase-Setup ist:

1. In App Store Connect und Google Play die Produkte anlegen und anschließend
   in RevenueCat importieren. Die App erwartet diese Produkt-IDs:

   | Entitlement | Offering | Produkte |
   | --- | --- | --- |
   | `Plus` | `plus` | `fam_plus_monthly`, `fam_plus_yearly` |
   | `AI` | `ai` | `fam_ai_monthly`, `fam_ai_yearly` |

2. In RevenueCat die Entitlements `Plus` und `AI` sowie die Offerings `plus`
   und `ai` mit den jeweiligen Monats-/Jahrespaketen anlegen. Für iOS muss die
   App-ID `com.goldjunge91.fam1`, für Android `com.goldjunge91.fam` hinterlegt
   sein.
3. Für die Entwicklung einen Test-Store-Key (`test_`) verwenden. Er gehört in
   `.env.development.local` als
   `EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY`. Für Release-Builds gehören die
   öffentlichen Plattform-Keys in die jeweilige Umgebung:
   `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (`appl_`) und
   `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` (`goog_`).
4. Das deklarative Supabase-Schema in das verknüpfte Projekt pushen und die
   Edge Function deployen:

   ```bash
   supabase link --project-ref ivvebtqasotqpikuydov
   bun run db:push
   supabase secrets set REVENUECAT_WEBHOOK_SECRET='<starkes-zufälliges-secret>' \
     --project-ref ivvebtqasotqpikuydov
   supabase functions deploy revenuecat-webhook \
     --project-ref ivvebtqasotqpikuydov \
     --no-verify-jwt
   ```

5. Im RevenueCat-Dashboard den signierten Webhook mit der Function-URL und dem
   HMAC-Secret einrichten. Die Details stehen in den folgenden Abschnitten.
6. Mit dem Test Store einen erfolgreichen, abgebrochenen und fehlgeschlagenen
   Kauf durchspielen. Vor einem Release zusätzlich mindestens einen Sandbox-
   Kauf über den echten Store testen.

## Endpoint und Authentifizierung

Die Function ist unter dieser URL erreichbar:

```text
https://ivvebtqasotqpikuydov.supabase.co/functions/v1/revenuecat-webhook
```

In `supabase/config.toml` ist `verify_jwt = false` gesetzt, weil RevenueCat
keinen Supabase-JWT mitsendet. Die Function authentifiziert jeden Request mit
RevenueCats HMAC-Signatur:

```text
X-RevenueCat-Webhook-Signature: t=<unix_timestamp>,v1=<hmac_sha256_hex>
```

RevenueCat signiert `<timestamp>.<raw_json_body>` mit dem Webhook-Secret. Der
Handler prüft den unveränderten Request-Body vor dem JSON-Parsing, akzeptiert
mehrere `v1`-Signaturen während einer Secret-Rotation und verwirft Signaturen,
deren Zeitstempel mehr als fünf Minuten abweicht.

Ein fehlender oder ungültiger HMAC-Header liefert `401`. Ein gültig signierter,
aber strukturell ungültiger Payload liefert `400`. Ein Fehler beim Schreiben in
Supabase liefert `500`, damit RevenueCat die Zustellung erneut versucht.

## Supabase konfigurieren

Das HMAC-Secret wird ausschließlich als Edge-Function-Secret hinterlegt:

```bash
supabase secrets set REVENUECAT_WEBHOOK_SECRET='<starkes-zufälliges-secret>' \
  --project-ref ivvebtqasotqpikuydov

supabase functions deploy revenuecat-webhook \
  --project-ref ivvebtqasotqpikuydov \
  --no-verify-jwt
```

Das Secret darf weder im Repository noch in einer `EXPO_PUBLIC_*`-Variable
stehen. Für den Handler werden zusätzlich `SUPABASE_URL` und
`SUPABASE_SERVICE_ROLE_KEY` benötigt. Diese Werte werden von Supabase für die
Function bereitgestellt und dürfen ebenfalls nicht in den Mobile-Client
gelangen.

## RevenueCat-Dashboard konfigurieren

Unter **Integrations → Webhooks → Add new configuration**:

1. Die Endpoint-URL oben eintragen.
2. **HMAC webhook signing** aktivieren.
3. Das dabei angezeigte Signing-Secret als `REVENUECAT_WEBHOOK_SECRET` in
   Supabase hinterlegen. RevenueCat zeigt das Secret nur bei Erstellung oder
   Rotation an.
4. Sandbox und Production aktivieren.
5. Die Function auf die betroffene App beschränken, falls das Projekt mehrere
   Apps enthält.
6. Mindestens diese Eventtypen aktivieren:

   - `INITIAL_PURCHASE`
   - `RENEWAL`
   - `UNCANCELLATION`
   - `PRODUCT_CHANGE`
   - `EXPIRATION`

Ein Authorization-Header ist in RevenueCat optional, wird von dieser Function
aber nicht zur Authentifizierung verwendet. Die Sicherheit dieses Endpoints
beruht auf HMAC. Der Header allein ersetzt die HMAC-Signatur nicht.

## Verarbeitete Events

| Event | Wirkung |
| --- | --- |
| `INITIAL_PURCHASE` | Entitlement aktivieren |
| `RENEWAL` | Entitlement aktiv halten und Ablaufzeit aktualisieren |
| `UNCANCELLATION` | Entitlement wieder aktivieren |
| `PRODUCT_CHANGE` | Entitlement aktiv halten und Ablaufzeit aktualisieren |
| `EXPIRATION` | Entitlement deaktivieren |
| `CANCELLATION` | Wird quittiert, ändert den Zugriff nicht |
| `BILLING_ISSUE` | Wird quittiert, ändert den Zugriff nicht |
| Andere Events | Werden quittiert und ignoriert |

`CANCELLATION` und `BILLING_ISSUE` widerrufen den Zugriff bewusst nicht sofort.
RevenueCat sendet `EXPIRATION`, wenn der bezahlte Zeitraum beziehungsweise die
Grace Period tatsächlich endet.

## Idempotenz und Reihenfolge

- Jedes `(event_id, entitlement_id)` wird in
  `revenuecat_processed_events` nur einmal verarbeitet.
- Die Datenbankfunktionen schreiben Dedup-Eintrag und Projektion atomar. Bei
  einem Fehler wird auch der Dedup-Eintrag zurückgerollt.
- Ältere, verspätete Events können keinen neueren Zustand überschreiben.
- Plus bleibt nach der ersten erfolgreichen Zuordnung an den Kaufhaushalt
  gebunden.
- AI hat pro Subscriber höchstens eine aktive Haushaltszuordnung. Inaktive
  Zuordnungen bleiben als Tombstone für Reihenfolge und monatliches
  Wechsel-Cooldown erhalten.

## Prüfen

Die Handler- und Signaturtests laufen ohne externe Dienste:

```bash
bun run test:functions
```

Nach jedem Deployment:

1. Im RevenueCat-Dashboard einen Test-Webhook mit einem gültigen HMAC senden.
2. HTTP `200` und einen `updated`-Wert größer als null erwarten, zum Beispiel
   `{"updated":1}` für ein oder `{"updated":2}` für zwei Entitlements.
3. Einen wiederholten Versand desselben Events prüfen. Er muss weiterhin `200`
   liefern, darf aber nichts ein zweites Mal schreiben.
4. Einen fehlenden oder falschen HMAC-Header prüfen. Erwartet wird `401`.
5. Im Dashboard **Customers** und **Events** kontrollieren, dass der
   `app_user_id` die Supabase-User-UUID ist und `Plus` beziehungsweise `AI`
   im Payload steht.
6. Anschließend den projizierten Haushaltsstatus in der App prüfen. Der
   Haushalts-Bootstrap synchronisiert Änderungen im laufenden Betrieb per
   Polling, Reconnect und App-Resume.

Die lokalen Tests decken außerdem Erfolg, Ablauf, doppelte Zustellung,
Out-of-Order-Events, unbekannte Entitlements sowie `CANCELLATION` und
`BILLING_ISSUE` ab.

## Sicherheitsprüfung vor Release

- **Schlüssel:** Im Client dürfen nur öffentliche `appl_`-/`goog_`-Keys oder
  der nicht produktive `test_`-Key liegen. Ein RevenueCat-REST-Key (`sk_`) und
  `REVENUECAT_WEBHOOK_SECRET` gehören ausschließlich in Server-Secrets. Beide
  dürfen nicht in Git oder `EXPO_PUBLIC_*`-Variablen auftauchen.
- **Identität:** In RevenueCat muss `app_user_id` die Supabase-User-UUID sein.
  Der Haushalt kommt nur aus `subscriber_attributes.household_id` und wird
  serverseitig gegen `household_members` geprüft.
- **Signatur:** Fehlender/falscher HMAC, veränderter Body und ein Zeitstempel
  außerhalb des Fünf-Minuten-Fensters müssen `401` liefern. Ein wiederholtes
  Event muss `200` mit `updated: 0` liefern.
- **Serverautorität:** Premiumzugriff wird aus den Supabase-Haushaltsfeldern
  gelesen, nicht aus einem vom Client gesendeten Entitlement. Die internen
  RevenueCat-Zuordnungstabellen und RPCs sind nur für `service_role` zugänglich.
- **Datenbankrechte:** Gegen das verknüpfte Supabase-Projekt prüfen, dass keine
  öffentlichen Tabellen-/RPC-Rechte oder fehlendes RLS übrig sind:

  ```bash
  bun run db:check -- --linked
  ```

  Der Check muss ohne Rechteverstöße durchlaufen.
- **SDK-Verifikation:** Der Client ist aktuell auf
  `ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL` gestellt und verwirft
  `CustomerInfo` bei `VERIFICATION_RESULT.FAILED`. Diese Prüfung ergänzt die
  serverseitige Autorität, ersetzt sie aber nicht.

Für einen schnellen Scan der versionierten Dateien (keine Ausgabe bedeutet
keine Treffer; die lokalen `.env`-Dateien zusätzlich nicht committen):

```bash
git grep -nE 'sk_[A-Za-z0-9]{20,}|REVENUECAT_WEBHOOK_SECRET=[^$[:space:]]+|SUPABASE_SERVICE_ROLE_KEY=[^$[:space:]]+' -- \
  . ':(exclude)docs/**' ':(exclude).agents/**' ':(exclude).claude/**'
```

## Fehlersuche

| Symptom | Wahrscheinliche Ursache |
| --- | --- |
| `401 unauthorized` | HMAC nicht aktiviert, Secret stimmt nicht überein, Request-Body wurde vor der Prüfung verändert oder Zeitstempel ist älter als fünf Minuten |
| `400 invalid_payload` | Pflichtfelder im signierten Event fehlen oder haben den falschen Typ |
| `500 update_failed` | Supabase-RPC, Membership-Prüfung oder Service-Role-Konfiguration fehlgeschlagen |
| `200 {"updated":0}` | Event wurde bereits verarbeitet, war veraltet oder es gab keine tatsächliche Zustandsänderung |
| Offerings laden, aber `ui_config` warnt | Separate RevenueCat-Remote-UI-/Workflow-Konfiguration; kein Beleg für einen Fehler beim Laden der Produkte oder beim Webhook |

Referenzen: [RevenueCat Webhooks](https://www.revenuecat.com/docs/integrations/webhooks)
und [Eventtypen und Felder](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).
