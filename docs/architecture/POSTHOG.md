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

Die Edge Function `delete-account` kann die PostHog-Person vor der Auth-
Löschung zur Löschung einreihen. Dafür benötigt die Function ausschließlich
serverseitige Variablen:

```text
POSTHOG_PERSONAL_API_KEY
POSTHOG_PROJECT_ID
POSTHOG_HOST=https://eu.posthog.com
```

Der Client sieht keinen persönlichen API-Key. Die Function sucht nach dem
angemeldeten Supabase-User als `distinct_id` und löscht alle gefundenen
Personen mit ihren Events und Recordings. Wenn die konfigurierte Löschung
fehlschlägt oder die Variablen fehlen, wird die Account-Löschung mit einem
stabilen Fehler beendet, damit kein Account ohne zugehörigen Löschversuch
entsteht.

Vor der Veröffentlichung muss diese Konfiguration in jeder gehosteten
Supabase-Umgebung gesetzt und mit einem Testaccount nachgewiesen werden.

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
- Ein Account-Löschlauf bestätigt die asynchrone Löschung von Person, Events und
  Recordings. PostHog behandelt Event-Löschung laut Dokumentation asynchron.

## Quellen

- [PostHog React Native SDK](https://posthog.com/docs/libraries/react-native)
- [PostHog: Controlling data collection](https://posthog.com/docs/privacy/data-collection)
- [PostHog: Controlling data storage](https://posthog.com/docs/privacy/data-storage)
- [PostHog: React Native error tracking](https://posthog.com/docs/error-tracking/installation/react-native)
- [RevenueCat: PostHog integration](https://www.revenuecat.com/docs/integrations/third-party-integrations/posthog)
- [Expo SDK 57: `ios.privacyManifests`](https://docs.expo.dev/versions/v57.0.0/config/app/#privacymanifests)
