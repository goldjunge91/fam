# PostHog-Integrationsvertrag

## Zweck

Dieser Vertrag beschreibt die Datenminimierung und die Abnahmegrenzen der
PostHog-Integration in der mobilen App. Die technische Implementierung liegt
in `src/lib/observability/providers/posthog.tsx`, `src/lib/telemetry/` und
`src/constants/analytics.ts`.

## Mobile Datenverarbeitung

- PostHog startet mit `defaultOptIn: false`.
- Die App speichert den Status `pending`, `granted` oder `denied` lokal auf dem
  Gerät. `pending` und `denied` blockieren den vollständigen PostHog-Fan-out.
- Die Datenschutzseite bietet Einwilligung und Widerruf. Ein Widerruf ruft
  `optOut()` und `reset()` auf.
- Touch-Autocapture, automatische JavaScript-Fehlererfassung und automatische
  native Crash-Erfassung bleiben deaktiviert.
- Die App identifiziert einen Account über die technische Supabase-ID. Nach
  erteilter PostHog-Einwilligung wird die E-Mail zusätzlich als
  Feature-Flag-Auswertungseigenschaft übermittelt, damit nutzerbezogene
  Freigaben ausgewertet werden können. Sie wird über
  `setPersonPropertiesForFlags` nur für Flag-Auswertungen gesetzt und nicht als
  Analyseereignis oder dauerhaftes Profilmerkmal geschrieben.
- Screen-Telemetrie nutzt eine statische Allowlist. Dynamische IDs, private
  Ernährungs-/Gewichtsrouten, Haushaltsdetails und unbekannte Pfade werden
  verworfen.
- Aus Analyseereignissen werden E-Mail-Adressen, URLs, UUIDs, freie
  Fehlermeldungen, Haushalts- und Identitätsfelder entfernt. Die E-Mail wird
  ausschließlich nach Einwilligung in Flag-Auswertungsanfragen übermittelt.
  Sentry bleibt der vollständige Fehlerdiagnose-Zielort.
- Der Runtime-Host fällt auf `https://eu.i.posthog.com` zurück. Eine
  Produktionsumgebung muss den Host und den öffentlichen Projekt-Key trotzdem
  explizit in EAS prüfen.

## Account-Löschung

Die Edge Function `delete-account` hält die bestehende Reihenfolge ein:

1. `prepare_account_deletion()` räumt die Supabase-Haushaltsbezüge unter
   `auth.uid()` auf.
2. Die PostHog-Prüfung liest oder erzeugt den serverseitigen Checkpoint und
   verifiziert die Löschanforderung.
3. Erst bei `not_found` oder `verified` löscht die Function den Supabase-
   Auth-Nutzer.

Der Checkpoint `public.account_deletion_requests` enthält nur die für einen
Retry nötigen PostHog-Person-IDs und die Zeitpunkte für Anforderung, Annahme
und Verifikation. Er ist RLS-geschützt, nur für `service_role` zugänglich und
wird mit dem `auth.users`-Datensatz per Cascade entfernt. Die Tabelle gehört
nicht in die mobile SQLite-Synchronisation.

Die Statusmaschine ist fail-closed:

| Status | Beleg | Supabase-Verhalten |
| --- | --- | --- |
| `not_found` | Eine strikt validierte Personenabfrage für die Distinct-ID ist leer und es gibt keinen Checkpoint. | Auth-Löschung darf fortfahren. Dieser Status behauptet keine nachträgliche Löschung von Events oder Recordings. |
| `accepted` | PostHog hat die Bulk-Anforderung mit HTTP 202 angenommen oder der bounded `deletion_status`-Poll bleibt `pending`. | Checkpoint bleibt erhalten. Der Handler antwortet lesbar mit HTTP 202 und `analytics_delete_pending`; `deleteUser` läuft nicht. |
| `verified` | Für jede gespeicherte Person-ID liefert `deletion_status` `completed` mit parsebarem `delete_verified_at`, und die abschließende Personenabfrage ist leer. | Auth-Löschung darf fortfahren. Die Antwort nennt ausdrücklich `analyticsDeletion: verified`. |
| Fehler oder unbekannt | Timeout, Netzwerkfehler, ungültiger Status, ungültiges JSON, abgeschnittene Pagination, widersprüchliche Zähler oder ein verbleibender Datensatz. | Stabiler redigierter Fehler; kein Auth-Löschen. |

Der Bulk-Aufruf verwendet `ids`, `delete_events: true`,
`delete_recordings: true` und `keep_person: false`. Wiederholungen lesen den
Checkpoint auch dann, wenn die Person bereits aus der sichtbaren Liste
verschwunden ist. Neue gefundene IDs werden mit den gespeicherten IDs vereinigt;
der Checkpoint wird vor dem externen Löschaufruf geschrieben. Wenn die HTTP-202-
Antwort nach einer providerseitigen Annahme verloren geht, prüft ein Retry zuerst
`deletion_status` und sendet den Bulk-Aufruf nur ohne aktuellen Status erneut.
Jeder externe Request hat ein Timeout, das Fetch und Response-Body umfasst. Das
Polling hat zusätzlich eine feste Gesamtfrist.

Personen- und Statusantworten werden nur akzeptiert, wenn der dokumentierte
Umschlag vollständig ist: `next` muss explizit `null` sein. Die aktuelle
cursorbasierte Personenliste darf `count` weglassen; wenn das Feld vorhanden
ist, muss es der Ergebnisanzahl entsprechen. Der Status-Endpunkt verlangt
weiterhin `count` passend zur Ergebnisanzahl. Personen-IDs müssen gültig und
eindeutig sein, und ein Statusdatensatz muss ein gültiges `created_at`
enthalten. Aus der Statushistorie zählt nur genau ein Eintrag, dessen
`created_at` zwischen der lokal gespeicherten Anforderung und HTTP-202-Annahme
liegt; ein fehlender oder mehrdeutiger aktueller Eintrag stoppt fail-closed.
`delete_verified_at` muss bei
`completed` mindestens so neu wie `created_at` sein. Die Bulk-Zähler müssen die
gesamte angeforderte ID-Menge abdecken; Teilabdeckung, `deletion_errors` und
provider-kontrollierte Response-Felder führen zu einem stabilen redigierten
Fehler. Kein externer Response-Body wird als interner Fehler oder Log-Code
übernommen.

`verified` ist der stärkste Abschluss, den der dokumentierte
Personenlöschlauf für Personen- und Eventdaten liefert. PostHog dokumentiert
die Event-Löschung als asynchron und stellt dafür `deletion_status` mit
`pending`, `completed` und `delete_verified_at` bereit. Der Bulk-Aufruf fordert
die Recording-Löschung mit an, aber die dokumentierte Personen-API liefert
keinen unabhängigen Recording-Abschlussstatus. Die [Session-Replay-
Datenschutzdokumentation](https://posthog.com/docs/session-replay/privacy#data-deletion)
beschreibt außerdem eine zweistufige Löschung: Schlüssel werden unbrauchbar
gemacht, Metadaten werden später bereinigt. Deshalb wird aus `verified`
kein separater Recording-Readback und keine zusätzliche Behauptung über
Recording-Kopien abgeleitet. Eine Abnahme mit vorhandenen Session Recordings
bleibt ein eigener Hosted-Schritt.

Die Function benötigt ausschließlich serverseitige Variablen:

```text
POSTHOG_PERSONAL_API_KEY
POSTHOG_PROJECT_ID
POSTHOG_HOST=https://eu.posthog.com
```

Der Client sieht keinen persönlichen API-Key. Der Key braucht für die
Personenabfrage, den Status-Readback und die Löschung ausschließlich
`person:read` und `person:write`. Fehlende Konfiguration, Checkpoint-Fehler und
externe Fehler verhindern die Auth-Löschung. Die Konfiguration muss in jeder
gehosteten Supabase-Umgebung gesetzt und mit einem synthetischen Testaccount
abgenommen werden, bevor die neue Function-Version veröffentlicht wird.

## RevenueCat-Grenze

`household_id` bleibt als Subscriber-Attribut bestehen, weil der RevenueCat-
Webhook damit den Kaufhaushalt serverseitig bindet. Konto-E-Mail und
`$posthogUserId` werden nicht mehr an RevenueCat gesetzt. Die RevenueCat-
PostHog-Integration darf nicht
aktiviert werden, solange sie `household_id`-Subscriber-Attribute in PostHog-
Ereignisse übernimmt. Alternativ muss im Dashboard ein Filter nachgewiesen
werden, der dieses Attribut vor der Speicherung entfernt.

## Produktmetriken

Die aktuelle, privacy-safe Produktinstrumentierung ergänzt die bestehenden
Produkt-, Premium-, Sync- und Lifecycle-Events um:

- `activation.household_ready.completed` mit `path=created|joined`
- `recipe_import.started`, `recipe_import.completed` und
  `recipe_import.failed` mit Quelle, Methode, Fehlerphase und grobem
  Zeit-Bucket
- `search.completed` und `search.failed` für die Lebensmittelsuche mit
  Ergebnis-Bucket, aber ohne Suchtext
- `empty_state.action_pressed` für den schnellen Lebensmittel-Eintrag

Premium-Funnel, Sync-Läufe und App-Lifecycle werden bereits durch bestehende
Events und Diagnosesignale abgedeckt. Ergebnis- und Zeitwerte verwenden feste
Buckets. Die neuen Events enthalten keine Namen, Zutaten, Barcodes, URLs,
Haushalts-IDs, Suchtexte oder freien Fehlermeldungen.


- PostHog Cloud EU und der EU-Ingestion-Host sind aktiv.
- Client-IP-Verarbeitung und GeoIP-Anreicherung entsprechen dem festgelegten
  Datenschutzmodell. Wenn IPs verworfen werden, muss auch GeoIP geprüft werden.
- Events, Personen und eventuelle Recordings haben eine dokumentierte,
  angemessene Retention. Session Replay bleibt in der App deaktiviert.
- Server-seitige automatische Exception-Erfassung bleibt deaktiviert oder ist
  mit einer separaten, geprüften Datenminimierung abgenommen.
- Zugriff auf das PostHog-Projekt ist rollenbasiert und auf die nötigen Personen
  beschränkt. DPA und Verarbeitungszwecke sind dokumentiert.
- Die PostHog- und RevenueCat-Integrationsseiten enthalten keine ungefilterten
  Haushalts- oder Gesundheitsdaten.
- Ein Account-Löschlauf kann `not_found`, `accepted` oder `verified` liefern.
  `accepted` ist nie ein Abschluss. `verified` belegt den dokumentierten
  Personen-/Event-Status; die angeforderte Recording-Löschung hat keinen
  unabhängigen Abschlussstatus über diesen API-Pfad.

## Quellen

- [PostHog React Native SDK](https://posthog.com/docs/libraries/react-native)
- [PostHog: Controlling data collection](https://posthog.com/docs/privacy/data-collection)
- [PostHog Persons API](https://posthog.com/docs/api/persons)
- [PostHog API overview](https://posthog.com/docs/api)
- [PostHog Session recordings API](https://posthog.com/docs/api/session-recordings)
- [PostHog Session Replay: data deletion](https://posthog.com/docs/session-replay/privacy#data-deletion)
- [PostHog: Controlling data storage](https://posthog.com/docs/privacy/data-storage)
- [PostHog: React Native error tracking](https://posthog.com/docs/error-tracking/installation/react-native)
- [RevenueCat: PostHog integration](https://www.revenuecat.com/docs/integrations/third-party-integrations/posthog)
- [Expo SDK 57: `ios.privacyManifests`](https://docs.expo.dev/versions/v57.0.0/config/app/#privacymanifests)

Die Quelleninhalte wurden für diese Dokumentation paraphrasiert.
Content was rephrased for compliance with licensing restrictions.