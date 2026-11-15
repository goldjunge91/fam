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
  lesbare Projektion für alle Haushaltsmitglieder. Die maßgeblichen Zuordnungen
  liegen in `revenuecat_plus_assignments` und `revenuecat_ai_assignments`.

Anonyme RevenueCat-IDs sind für reguläre Lifecycle-Events nicht zulässig. Käufe
müssen an einen angemeldeten Nutzer gebunden sein, bevor ein Webhook den
Haushaltsstatus ändern kann. `TRANSFER` ist die Ausnahme: Dieses Event kann ohne
`app_user_id` eintreffen und enthält die beteiligten IDs stattdessen in
`transferred_from` und `transferred_to`.

## Produktions- und Sandbox-Grenze

Der hier beschriebene Endpoint ist ausschließlich für Production-Ereignisse.
Reguläre Lifecycle-Events verändern den Haushaltsstatus nur mit
`environment: "PRODUCTION"`. `SANDBOX`, ein fehlendes oder unbekanntes
`environment` und Dashboard-Events vom Typ `TEST` werden quittiert, ohne eine
Berechtigung zu verändern.

RevenueCat führt Sandbox- und Production-Daten innerhalb eines Projekts. Für
Sandbox-Tests wird deshalb ein isolierter Backend-Stack mit eigener
Endpoint-URL, eigenen Secrets und eigener Datenbank verwendet. Der produktive
Endpoint wird im RevenueCat-Dashboard nur für Production aktiviert. Sandbox-
Ereignisse dürfen nicht zu Testzwecken an die produktive Datenbank gesendet
werden.

`TRANSFER` besitzt laut RevenueCat ein optionales `environment`. Ein explizit
nicht produktives oder unbekanntes Environment wird ignoriert. Bei
`PRODUCTION` oder fehlendem Environment liest die Function den aktuellen
Status aller eindeutigen `transferred_from`- und `transferred_to`-IDs über die
RevenueCat REST API. Nur dort bestätigte, nicht als Sandbox markierte Käufe
werden als aktiv projiziert. UUID-förmige IDs werden zusätzlich gegen wirklich
vorhandene lokale Profile aufgelöst, bevor ein Datenbankzugriff erfolgt.

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
   Im lokalen Test-Store verwendet die lokale Edge Function das vom SDK
   zurückgegebene CustomerInfo. Dafür wird kein privater RevenueCat-Key und
   keine lokale `supabase/functions/.env` benötigt. Gehostete Environments
   lesen den Abo-Status weiterhin serverseitig mit `REVENUECAT_SECRET_API_KEY`.
4. Das deklarative Supabase-Schema in das verknüpfte Projekt pushen und die
   Edge Function deployen. Neben dem HMAC-Secret benötigt die Function für
   bestätigte Transfer-Statusreads einen geheimen RevenueCat API-v1-Key:

   ```bash
   supabase link --project-ref ivvebtqasotqpikuydov
   bun run db:push
   supabase secrets set \
     REVENUECAT_WEBHOOK_SECRET='<starkes-zufälliges-secret>' \
     REVENUECAT_SECRET_API_KEY='<geheimer-revenuecat-api-v1-key>' \
     --project-ref ivvebtqasotqpikuydov
   supabase functions deploy revenuecat-webhook \
     --project-ref ivvebtqasotqpikuydov \
     --no-verify-jwt
   ```

5. Im RevenueCat-Dashboard den signierten Production-Webhook mit der
   Function-URL und dem HMAC-Secret einrichten. Die Details stehen in den
   folgenden Abschnitten.
6. Mit dem Test Store einen erfolgreichen, abgebrochenen und fehlgeschlagenen
   Kauf gegen den isolierten Sandbox-Backend-Stack durchspielen. Vor einem
   Release zusätzlich mindestens einen Sandbox-Kauf über den echten Store
   testen, ebenfalls ohne den produktiven Endpoint zu verwenden.

## Endpoint und Authentifizierung

Die produktive Function ist unter dieser URL erreichbar:

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
Statusreads für `TRANSFER` beginnen erst nach erfolgreicher HMAC-Prüfung.

## Supabase konfigurieren

Beide RevenueCat-Secrets werden ausschließlich als Edge-Function-Secrets
hinterlegt:

```bash
supabase secrets set \
  REVENUECAT_WEBHOOK_SECRET='<starkes-zufälliges-secret>' \
  REVENUECAT_SECRET_API_KEY='<geheimer-revenuecat-api-v1-key>' \
  --project-ref ivvebtqasotqpikuydov

supabase functions deploy revenuecat-webhook \
  --project-ref ivvebtqasotqpikuydov \
  --no-verify-jwt
```

`REVENUECAT_WEBHOOK_SECRET` prüft die HMAC-Signatur.
`REVENUECAT_SECRET_API_KEY` autorisiert serverseitige
`GET /v1/subscribers/{app_user_id}`-Statusreads. Beide RevenueCat-Secrets
dürfen weder im Repository noch in einer `EXPO_PUBLIC_*`-Variable stehen. Für
Adminzugriffe verwendet der Handler den von Supabase bereitgestellten
`SUPABASE_SECRET_KEYS['default']`-Key und unterstützt zusätzlich die Legacy-
Variablen `SUPABASE_SERVICE_ROLE_KEY` und `SUPABASE_SECRET_KEY`. Supabase
reserviert den Präfix `SUPABASE_` für selbst bereitgestellte Variablen; eigene
Keys wie der RevenueCat-Key müssen daher einen anderen Präfix haben.

## RevenueCat-Dashboard konfigurieren

Unter **Integrations → Webhooks → Add new configuration**:

1. Die produktive Endpoint-URL oben eintragen.
2. **HMAC webhook signing** aktivieren.
3. Das dabei angezeigte Signing-Secret als `REVENUECAT_WEBHOOK_SECRET` in
   Supabase hinterlegen. RevenueCat zeigt das Secret nur bei Erstellung oder
   Rotation an.
4. Für diese Konfiguration ausschließlich Production aktivieren. Sandbox wird
   nur an die isolierte Sandbox-Endpoint-Konfiguration gesendet.
5. Die Function auf die betroffene App beschränken, falls das Projekt mehrere
   Apps enthält.
6. Mindestens diese Eventtypen aktivieren:

   - `INITIAL_PURCHASE`
   - `RENEWAL`
   - `UNCANCELLATION`
   - `PRODUCT_CHANGE`
   - `EXPIRATION`
   - `TRANSFER`

Ein Authorization-Header ist in RevenueCat optional, wird von dieser Function
aber nicht zur Authentifizierung verwendet. Die Sicherheit dieses Endpoints
beruht auf HMAC. Der Header allein ersetzt die HMAC-Signatur nicht.

## Verarbeitete Events

Nur bestätigte Production-Zustände dürfen die Projektion verändern.

| Event | Wirkung |
| --- | --- |
| `INITIAL_PURCHASE` | Entitlement bei `environment: "PRODUCTION"` aktivieren |
| `RENEWAL` | Production-Entitlement aktiv halten und Ablaufzeit aktualisieren |
| `UNCANCELLATION` | Production-Entitlement wieder aktivieren |
| `PRODUCT_CHANGE` | Production-Entitlement aktiv halten und Ablaufzeit aktualisieren |
| `EXPIRATION` | Production-Entitlement deaktivieren |
| `TRANSFER` | Alle beteiligten IDs über den aktuellen RevenueCat-Produktionsstatus abgleichen |
| `CANCELLATION` | Wird quittiert, ändert den Zugriff nicht |
| `BILLING_ISSUE` | Wird quittiert, ändert den Zugriff nicht |
| `TEST` | Wird quittiert, ändert den Zugriff nicht |
| Andere Events | Werden quittiert und ignoriert |

`CANCELLATION` und `BILLING_ISSUE` widerrufen den Zugriff bewusst nicht sofort.
RevenueCat sendet `EXPIRATION`, wenn der bezahlte Zeitraum beziehungsweise die
Grace Period tatsächlich endet.

## Idempotenz und Reihenfolge

- Jedes `(event_id, entitlement_id)` wird in
  `revenuecat_processed_events` nur einmal verarbeitet.
- Transfer-Projektionen verwenden pro lokalem Profil und Event eine stabile
  abgeleitete Event-ID.
- Die Datenbankfunktionen schreiben Dedup-Eintrag und Projektion atomar. Bei
  einem Fehler wird auch der Dedup-Eintrag zurückgerollt.
- Ältere, verspätete Events können keinen neueren Zustand überschreiben.
- Plus bleibt nach der ersten erfolgreichen Zuordnung an den Kaufhaushalt
  gebunden.
- AI hat pro Subscriber höchstens eine aktive Haushaltszuordnung. Inaktive
  Zuordnungen bleiben als Tombstone für Reihenfolge und monatliches
  Wechsel-Cooldown erhalten.

## Prüfen

Die Handler-, Signatur- und Statusread-Tests laufen ohne externe Dienste:

```bash
bun run test:functions
```

Nach jedem Deployment:

1. Im RevenueCat-Dashboard einen `TEST`-Webhook senden. Er prüft Transport und
   HMAC, muss `200` liefern und darf keine Projektion ändern.
2. Sandbox-Lifecycle- und Transfer-Fälle ausschließlich am isolierten
   Sandbox-Backend prüfen. Dort dürfen keine Daten der produktiven Datenbank
   sichtbar oder veränderbar sein.
3. Einen produktiven Lifecycle- oder Transfer-Vorgang nur im freigegebenen
   Betriebsablauf prüfen. Ein tatsächlich neuer Zustand liefert `updated`
   größer null; Replay oder veraltete Zustände liefern `updated: 0`.
4. Einen fehlenden oder falschen HMAC-Header prüfen. Erwartet wird `401`, und
   bei `TRANSFER` darf kein Statusread stattfinden.
5. Im Dashboard **Customers** und **Events** kontrollieren, dass reguläre
   Lifecycle-Events die Supabase-User-UUID als `app_user_id` und `Plus`
   beziehungsweise `AI` im Payload tragen. Bei `TRANSFER` sind stattdessen
   `transferred_from` und `transferred_to` maßgeblich.
6. Anschließend den projizierten Haushaltsstatus in der App prüfen. Der
   Haushalts-Bootstrap synchronisiert Änderungen im laufenden Betrieb per
   Polling, Reconnect und App-Resume.

Die lokalen Tests decken außerdem Production, Sandbox, fehlende und unbekannte
Umgebungen, Erfolg, Ablauf, doppelte Zustellung, Out-of-Order-Events,
unbekannte Entitlements, `TEST`, `CANCELLATION`, `BILLING_ISSUE` sowie
Transfer-Replay, veraltete Transfers und API-Fehler ab.

## Sicherheitsprüfung vor Release

- **Schlüssel:** Im Client dürfen nur öffentliche `appl_`-/`goog_`-Keys oder
  der nicht produktive `test_`-Key liegen. `REVENUECAT_SECRET_API_KEY` und
  `REVENUECAT_WEBHOOK_SECRET` gehören ausschließlich in Server-Secrets. Beide
  dürfen nicht in Git oder `EXPO_PUBLIC_*`-Variablen auftauchen.
- **Umgebung:** Der produktive Dashboard-Webhook empfängt nur Production.
  Sandbox besitzt einen isolierten Endpoint und Backend-Stack. Ein fehlendes
  Transfer-Environment ist nur zusammen mit dem bestätigten Produktionsstatus
  aller beteiligten IDs sicher.
- **Identität:** In RevenueCat muss `app_user_id` für Lifecycle-Events die
  Supabase-User-UUID sein. Der Haushalt kommt nur aus
  `subscriber_attributes.household_id` und wird serverseitig gegen
  `household_members` geprüft. Transfer-IDs werden vor der Projektion gegen
  lokale Profile aufgelöst.
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
git grep -nE 'sk_[A-Za-z0-9]{20,}|REVENUECAT_WEBHOOK_SECRET=[^$[:space:]]+|REVENUECAT_SECRET_API_KEY=[^$[:space:]]+|SUPABASE_SECRET_KEY=[^$[:space:]]+' -- \
  . ':(exclude)docs/**' ':(exclude).agents/**' ':(exclude).claude/**'
```

## Fehlersuche

| Symptom | Wahrscheinliche Ursache |
| --- | --- |
| `401 unauthorized` | HMAC nicht aktiviert, Secret stimmt nicht überein, Request-Body wurde vor der Prüfung verändert oder Zeitstempel ist älter als fünf Minuten |
| `400 invalid_payload` | Pflichtfelder im signierten Event fehlen oder haben den falschen Typ |
| `502 subscriber_status_lookup_failed` | RevenueCat API nicht erreichbar, geheimer API-Key ungültig oder Customer-Antwort ungültig |
| `503 subscriber_status_unavailable` | `REVENUECAT_SECRET_API_KEY` ist nicht als Function-Secret gesetzt |
| `500 update_failed` | Supabase-RPC, Membership-Prüfung oder Service-Role-Konfiguration fehlgeschlagen |
| `200 {"ignored":"non_production"}` | Sandbox, unbekanntes oder unzulässig fehlendes Environment wurde sicher ignoriert |
| `200 {"updated":0}` | Event wurde bereits verarbeitet, war veraltet oder es gab keine tatsächliche Zustandsänderung |
| Offerings laden, aber `ui_config` warnt | Separate RevenueCat-Remote-UI-/Workflow-Konfiguration; kein Beleg für einen Fehler beim Laden der Produkte oder beim Webhook |

Referenzen: [RevenueCat Webhooks](https://www.revenuecat.com/docs/integrations/webhooks),
[Eventtypen und Felder](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
[Umgebungsstrategien](https://www.revenuecat.com/docs/guides/environment-strategies)
und [Customer API v1](https://www.revenuecat.com/docs/api-v1/customers).
