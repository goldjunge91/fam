# Category Lab

Eigenständiges Vite/React-Evaluationstool für den Einkaufslisten-Classifier.
Es läuft unabhängig von Expo und der mobilen App, importiert aber deren echte
`classifyCategory()`- und `explainCategory()`-Implementierung direkt.

## Oberflächen

- **Blind Review:** Der Reviewer erfasst Produktfamilie, Produktform und die
  daraus abgeleitete Standardzone. Die alte Classifier-Vorhersage und der Trace
  erscheinen weiterhin erst nach dem Speichern.
- **Rohsignale:** Ungeprüfte Verschiebungen aus der Alpha werden append-only
  gespeichert. Human Reviews sind separate, ebenfalls append-only geführte
  Datensätze. Eine Trainingsfreigabe ist eine zusätzliche, standardmäßig
  ausgeschaltete Entscheidung.
- **Analyse:** Accuracy, Abdeckung, Macro-F1, Werte je Kategorie,
  vollständige Confusion Matrix, JSON-Import/Export und
  Calibration-/Holdout-Auswertung.
- **LLM Silver:** Blinde, versionierte LLM-Vorschläge mit Evidenz,
  Enthaltung und manueller Accept/Reject-Queue. Silver-Labels fließen nur
  nach Annahme ins Training und nie in den Gold-Holdout.
- **Regel-Miner:** Wiederkehrende Wort-, Bigramm- und OFF-Tag-Signale werden
  nur aus Calibration-Gold gelernt und getrennt am Holdout validiert. Das
  Tool schlägt Regeln vor, ändert den App-Classifier aber nie automatisch.
- **Modell-Baselines:** Lokale lineare N-Gramme, Robotoff, fastText, SetFit
  sowie eine Text-plus-SigLIP-Baseline mit lokalen Frontbildern.
- **Versionsvergleich:** Ein Run friert Fingerprints, Metriken, Vorhersagen
  und vollständige Traces ein. Zwei Runs zeigen Verbesserungen und
  Regressionen.
- **Kategorie-Radar und Dump-Browser:** Gezielte Suche, Filter und vollständige
  Einzelfall-Traces für alle 406.802 Dump-Produkte.

## Architektur

Der Browser öffnet `public/off-dump.db` über `sql.js`. Ein nur an
`127.0.0.1` gebundener Bun-Server stellt `/api` bereit und schreibt Labels
und Runs in die separate Supabase-Instanz. Der Supabase Secret Key bleibt
damit im Serverprozess und wird nie an Vite oder den Browser ausgeliefert.

Die Backend-Tabellen haben RLS aktiviert. `anon` und `authenticated` besitzen
keine Tabellenrechte; nur der lokale Server greift mit `service_role` zu.
Für Crowd-Rohsignale und deren Review-Historie besitzt selbst `service_role`
nur `select` und `insert`, aber weder `update` noch `delete`.

## Einrichtung

```bash
cd tools/category-debugger
bun install
cp .env.example .env.local
```

Danach in `.env.local` die separate Evaluation-Instanz eintragen:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
EVALUATION_REVIEWER_SLUG=local-reviewer
EVALUATION_REVIEWER_NAME=Local reviewer
EVALUATION_API_PORT=4174
OFF_IMAGE_DATA_DIR=/Volumes/Programme/off-dump-data
OPENAI_API_KEY=
CATEGORY_ML_DATA_DIR=/Volumes/Programme/off-dump-data
```

`.env.local` ist ignoriert und darf nicht committed werden. Der Publishable
Key und Expo-Umgebungsvariablen werden für dieses Tool nicht benötigt.

## Nutzung

```bash
bun run download-dump
bun run dev
```

`download-dump` kopiert oder lädt den OFF-Dump und erzeugt anschließend den
lokalen Evaluation-Index. Wenn der Dump bereits vorhanden ist:

```bash
bun run prepare-dump
```

Produktionsmodus:

```bash
bun run build
bun run start
```

## Frontbilder

Der Bildworkflow liest die von OFF ausgewählten `selected_images` direkt aus
dem vollständigen JSONL-Dump und legt Manifest, Bilder und Status auf der
externen Platte ab. Deutsch wird bevorzugt, mit einem stabilen Sprachfallback:

```bash
bun run images:manifest
bun run images:download
bun run images:status
```

`images:download` lädt ausschließlich `front`. Die optionalen Ansichten
`ingredients`, `nutrition` und `packaging` werden nur mit
`bun run images:download:all-kinds` geladen.

Manifest-Erzeugung und Bilddownload verwenden denselben Lock und dürfen nicht
parallel gestartet werden. Ein erneuter Manifestlauf erkennt bereits lokal
vorhandene ausgewählte Bilder und übernimmt sie als `downloaded`.

## LLM-Labels

Ein `OPENAI_API_KEY` im lokalen Serverprozess aktiviert den Tab **LLM
Silver**. Ein Lauf verarbeitet höchstens zehn Produkte und wird nur durch den
expliziten Button gestartet. Modell, Promptversion, Promptfingerprint,
Rohantwort und Reviewstatus werden gespeichert. Ohne Key wird keine Anfrage
ausgeführt.

## Crowd-Rohsignale

Der Tab **Rohsignale** importiert versionierte JSON-Dateien. Das vollständige
Ereignis wird unverändert als `raw_payload` gespeichert und zusätzlich mit
einem SHA-256-Fingerprint versehen. Wiederholte Imports derselben `eventId`
sind idempotent; vorhandene Ereignisse werden nicht verändert.

```json
{
  "schema": "nutritrack-crowd-signals",
  "version": 1,
  "events": [
    {
      "eventId": "evt_01",
      "schemaVersion": 1,
      "source": "alpha_app",
      "eventType": "product_moved",
      "occurredAt": "2026-08-24T12:00:00.000Z",
      "actorKey": "pseudonymous-actor-key",
      "householdKey": "pseudonymous-household-key",
      "storeKey": "optional-store-key",
      "productKey": "barcode:400000000001",
      "barcode": "400000000001",
      "productName": "Haferdrink Natur",
      "fromZoneId": "plant_based",
      "toZoneId": "ambient_milk_drinks",
      "classifierVersion": "category-v2",
      "payload": {
        "gesture": "drag"
      }
    }
  ]
}
```

Die bestehende Modellanalyse bleibt vorerst als Legacy-Classifier-Vergleich
sichtbar. Regel-Miner und Baselines verwenden als menschliches Gold nur Labels,
die bereits Familie, Form und Standardzone vollständig enthalten. Crowd-Daten
werden dort auch nach einem Review nicht automatisch eingespeist.

### Manueller App-Feedback-Import

Der Importer läuft ausschließlich manuell im Bun-Prozess und verbindet die App-
Supabase nicht mit dem Browser oder der App:

```bash
cd tools/category-debugger
APP_SUPABASE_URL=https://app-project.supabase.co \
APP_SUPABASE_SECRET_KEY=... \
EVALUATION_SUPABASE_URL=https://evaluation-project.supabase.co \
EVALUATION_SUPABASE_SECRET_KEY=... \
CATEGORY_FEEDBACK_PSEUDONYM_KEY=... \
bun scripts/import-app-feedback.ts --page-size=500
```

Der Import liest `shopping_category_feedback_events` nach `(created_at,
event_id)`, schreibt nur pseudonymisierte Snapshots in
`evaluation_crowd_signals` und behandelt wiederholte `event_id`-Werte
idempotent. Actor-, Haushalts-, Store-, Produkt- und Listen-IDs werden nicht
in `raw_payload` übernommen. Der Cursor wird erst nach dem erfolgreichen
Schreiben und Protokollieren einer vollständigen Seite weitergesetzt.

`public.evaluation_import_runs` protokolliert jeden Import und hält den
Resume-Cursor. Ein Cursor wird erst nach dem erfolgreichen, idempotenten
Schreiben einer vollständigen Seite fortgeschrieben. Der deklarative Vertrag
ist:

```text
run_id uuid primary key
source text, status text, started_at timestamptz, finished_at timestamptz
cursor_created_at timestamptz, cursor_event_id text
pages integer, events_read integer, events_imported integer,
events_duplicate integer, error_message text
```

Die Zähler erfassen nur vollständig geschriebene Seiten und erfüllen immer
`events_read = events_imported + events_duplicate`. Ein fehlgeschlagener Lauf
behält deshalb genau den Cursor und die Zähler der letzten vollständigen Seite.

Nur der manuelle Serverprozess mit `service_role` darf Läufe lesen, starten
und fortschreiben. Löschen ist auch für `service_role` gesperrt; `anon` und
`authenticated` erhalten keinen Zugriff.

## ML-Baselines

Die Python-Umgebung und Modellcaches liegen standardmäßig unter
`/Volumes/Programme/off-dump-data/`:

```bash
bun run ml:setup
bun run ml:status
bun run ml:smoke
```

fastText ist danach sofort lokal nutzbar. SetFit und SigLIP laden ihre
konfigurierten Modellgewichte erst beim ersten jeweiligen Baseline-Lauf und
speichern sie in `category-ml-cache` auf der externen Platte.

## Supabase-Workflow

Das deklarative Schema in `supabase/schemas/` ist die Wahrheit. Migrationen
werden ausschließlich aus diesem Schema erzeugt:

```bash
bun run db:diff -- -f <name>
bun run db:push
bun run db:types
```

Sicherheits- und Schematests liegen in `supabase/tests/`.

```bash
supabase test db --linked
```

## Verifikation

```bash
bun run typecheck
bun run test
bun run build
```

Der Dump, Builds, Dependencies und lokale Secrets werden nicht committed.
