# Requirements Document

## Introduction

Diese Spezifikation beschreibt ausschließlich den offenen Hosted-Restumfang von
`fam-19vm`. Ziel ist, den bereits vorhandenen finalen deutschen Rezept-Payload
gegen das dokumentierte Hosted-Ziel zu validieren, über den bestehenden Batch-
Import anzunehmen und abzuschließen sowie den importierten Bestand durch einen
separat gestarteten, schreibgeschützten Read-back zu belegen.

Der verbindliche Payload ist
`docs/recipe-extraction/waivy-fam-catalog-import.de.manual-final-0-7640.json`.
Der Payload enthält 7.641 Rezeptdatensätze mit `sortOrder` von 0 bis 7.640.
Das dokumentierte Hosted-Ziel ist
`https://ivvebtqasotqpikuydov.supabase.co`.

Die lokale Übersetzungslogik, das lokale Schema, `source_note`, `savings`, die
lokalen Batch-Import-Anpassungen und die zugehörigen lokalen Tests sind nicht
Teil dieser Spezifikation. Diese Spezifikationsphase führt keine Hosted-
Operation aus und erzeugt keine Produkt-, Schema- oder Teständerung.

## Glossary

- **fam-19vm**: Der Beads-Vorgang für die Übersetzung und den vollständigen
  Hosted-Import der Rezeptfelder `source_note` und `savings`.
- **Hosted Target**: Das dokumentierte Supabase-Ziel
  `https://ivvebtqasotqpikuydov.supabase.co`.
- **Final Recipe Payload**: Die Datei
  `docs/recipe-extraction/waivy-fam-catalog-import.de.manual-final-0-7640.json`
  im Format `fam.catalog_recipe_batch_import.v2` mit genau 7.641 Rezepten.
- **Batch Import Endpoint**: Der bestehende Hosted-Endpunkt `POST /api/import`
  für den Final Recipe Payload; die bestehende Validierung erfolgt über
  `POST /api/validate`.
- **Hosted Import Process**: Der Prozess, der den Final Recipe Payload gegen
  den Hosted Target validiert und über den Batch Import Endpoint verarbeitet.
- **Import Job**: Der vom Batch Import Endpoint angenommene asynchrone Vorgang
  mit einem Jobstatus und Abschlusszahlen.
- **Imported Recipe Set**: Die Hosted-Rezeptdatensätze, deren `external_id`
  einem `externalId` des Final Recipe Payload entspricht. Der Begriff umfasst
  nicht automatisch andere bereits vorhandene Hosted-Datensätze.
- **External ID**: Die stabile Rezeptidentität aus `externalId` im Payload und
  `external_id` im Hosted-Rezeptdatensatz.
- **Slug**: Der Rezept-Schlüssel aus `slug` im Payload und `slug` im Hosted-
  Rezeptdatensatz.
- **Sort Order**: Die Reihenfolge aus `sortOrder` im Payload und `sort_order`
  im Hosted-Rezeptdatensatz.
- **Expected Status Value**: Der Statuswert des jeweiligen Rezeptes im Final
  Recipe Payload. Zulässige Werte sind `draft`, `published` und `archived`.
- **Source Note Value**: Ein befüllter Wert aus
  `components[].items[].source_note` im Payload. Der bestehende Hosted-Import
  speichert diesen Wert als `note` in `catalog_recipe_component_items`.
- **Savings Value**: Ein befüllter Wert aus
  `substitutions[].savings` im Payload und den Hosted-Substitutionsdaten.
- **Hosted Read-back Verifier**: Ein separat gestarteter Prozess, der den
  Imported Recipe Set gegen den Hosted Target ausschließlich lesend prüft.
- **Read-only Operation**: Eine Hosted-Abfrage ohne Insert-, Update-, Upsert-,
  Delete- oder Storage-Schreibvorgang.
- **Import Evidence Set**: Vier secret-freie JSON-Nachweise, die eindeutig
  `fam-19vm` zugeordnet sind:
  `docs/recipe-extraction/fam-19vm-hosted-validate-response.json`,
  `docs/recipe-extraction/fam-19vm-hosted-import-acceptance.json`,
  `docs/recipe-extraction/fam-19vm-hosted-import-job-completion.json` und
  `docs/recipe-extraction/fam-19vm-hosted-read-back-report.json`.
- **Secret-free**: Ein Nachweis ohne Access Tokens, Secret API Keys,
  Authorization-Header, Secret-Umgebungsvariablen oder sonstige geheime
  Zugangsdaten.

## Requirements

### Requirement 1: Exact Hosted Validation

**User Story:** Als Maintainer möchte ich genau den freigegebenen finalen
Payload gegen das dokumentierte Ziel prüfen, damit der Hosted-Import keine
abweichende Datenmenge oder Datenquelle verarbeitet.

#### Acceptance Criteria

1. THE Hosted Import Process SHALL use the Hosted Target and the Final Recipe Payload as the only target and batch input for `fam-19vm`.
2. WHEN the Hosted Import Process validates the Final Recipe Payload, THE Hosted Import Process SHALL confirm exactly 7,641 recipe records.
3. WHEN the Hosted Import Process validates the Final Recipe Payload, THE Hosted Import Process SHALL confirm that every External ID occurs once in the payload.
4. WHEN the Hosted Import Process validates the Final Recipe Payload, THE Hosted Import Process SHALL confirm that every Slug occurs once in the payload.
5. WHEN the Hosted Import Process validates the Final Recipe Payload, THE Hosted Import Process SHALL confirm that Sort Order contains every integer from 0 through 7,640 exactly once.
6. WHEN the Hosted Import Process validates the Final Recipe Payload, THE Hosted Import Process SHALL confirm that every status equals the Expected Status Value for the corresponding recipe and belongs to `draft`, `published`, or `archived`.
7. IF any validation criterion fails, THEN THE Hosted Import Process SHALL not submit the Final Recipe Payload to the Batch Import Endpoint.

### Requirement 2: Non-destructive Hosted Import

**User Story:** Als Maintainer möchte ich den vollständigen finalen Payload in den
bestehenden Hosted-Rezeptbestand übernehmen, ohne andere bestehende Daten zu
entfernen oder als Vorbedingung einen leeren Bestand zu verlangen.

#### Acceptance Criteria

1. WHEN the Final Recipe Payload passes Hosted validation, THE Hosted Import Process SHALL submit that exact payload to the Batch Import Endpoint.
2. THE Hosted Import Process SHALL preserve the existing upsert behavior keyed by External ID.
3. THE Hosted Import Process SHALL process the existing dependent recipe records for components, component items, steps, step links, and images from the Final Recipe Payload.
4. WHEN the Hosted Import Process handles a recipe whose External ID already exists, THE Hosted Import Process SHALL update that matching recipe through the existing upsert behavior.
5. WHEN the Hosted Import Process handles the Final Recipe Payload, THE Hosted Import Process SHALL leave Hosted records with External IDs absent from the Final Recipe Payload unchanged.
6. THE Hosted Import Process SHALL accept pre-existing Hosted records outside the Imported Recipe Set and SHALL not require the total Hosted recipe count to equal 7,641.

### Requirement 3: Import Acceptance and Job Completion

**User Story:** Als Maintainer möchte ich die Annahme und den terminalen
Abschluss des Hosted-Jobs getrennt nachweisen, damit ein gestarteter Job nicht
fälschlich als vollständig importiert gilt.

#### Acceptance Criteria

1. WHEN the Batch Import Endpoint accepts the Final Recipe Payload, THE Hosted Import Process SHALL record the accepted Import Job identifier and the Hosted Target in the Import Evidence Set.
2. WHEN the Import Job reaches the completed state, THE Hosted Import Process SHALL report 7,641 completed records.
3. WHEN the Import Job reaches the completed state, THE Hosted Import Process SHALL report 7,641 total records.
4. WHEN the Import Job reaches the completed state, THE Hosted Import Process SHALL report 7,641 result rows.
5. IF the Import Job reaches the failed state, THEN THE Hosted Import Process SHALL record the failure and SHALL not classify the Hosted import as complete.
6. IF any terminal Import Job count differs from 7,641, THEN THE Hosted Import Process SHALL record the count mismatch and SHALL not classify the Hosted import as complete.

### Requirement 4: Independent Read-back Verification

**User Story:** Als Maintainer möchte ich den Hosted-Rezeptbestand unabhängig
vom Import-Job-Ergebnis lesen und vergleichen, damit der Nachweis den
persistierten Zustand und nicht nur die Antwort des Importprozesses belegt.

#### Acceptance Criteria

1. WHEN the Import Job reaches the completed state, THE Hosted Read-back Verifier SHALL start as a separate process invocation after the Import Job response is available.
2. WHILE the Hosted Read-back Verifier checks the Hosted Target, THE Hosted Read-back Verifier SHALL use only Read-only Operations.
3. WHEN the Hosted Read-back Verifier evaluates the Imported Recipe Set, THE Hosted Read-back Verifier SHALL find exactly 7,641 Hosted recipe records matching the External IDs in the Final Recipe Payload.
4. WHEN the Hosted Read-back Verifier evaluates the Imported Recipe Set, THE Hosted Read-back Verifier SHALL confirm that the Hosted External IDs are unique.
5. WHEN the Hosted Read-back Verifier evaluates the Imported Recipe Set, THE Hosted Read-back Verifier SHALL confirm that the Hosted Slugs are unique.
6. WHEN the Hosted Read-back Verifier evaluates the Imported Recipe Set, THE Hosted Read-back Verifier SHALL confirm Sort Order from 0 through 7,640 without gaps or duplicates.
7. WHEN the Hosted Read-back Verifier evaluates the Imported Recipe Set, THE Hosted Read-back Verifier SHALL confirm the Expected Status Value for every External ID.
8. WHEN the Hosted Read-back Verifier evaluates the Imported Recipe Set, THE Hosted Read-back Verifier SHALL count exactly 49,036 populated Source Note Values.
9. WHEN the Hosted Read-back Verifier evaluates the Imported Recipe Set, THE Hosted Read-back Verifier SHALL count exactly 2,923 populated Savings Values.
10. THE Hosted Read-back Verifier SHALL evaluate the Imported Recipe Set independently from other Hosted records and SHALL not require the total Hosted recipe count to equal 7,641.
11. IF any Read-back verification criterion fails, THEN THE Hosted Read-back Verifier SHALL mark the read-back report as failed and SHALL not classify the Hosted import as independently verified.

### Requirement 5: Secret-free, fam-19vm-zugeordnete Nachweise

**User Story:** Als Maintainer möchte ich vier eindeutig zugeordnete,
secret-freie JSON-Nachweise erhalten, damit die Hosted-Abnahme reproduzierbar
geprüft werden kann, ohne Zugangsdaten zu veröffentlichen.

#### Acceptance Criteria

1. THE Import Evidence Set SHALL contain the Hosted validation response at `docs/recipe-extraction/fam-19vm-hosted-validate-response.json`.
2. THE Import Evidence Set SHALL contain the Batch Import Endpoint acceptance response at `docs/recipe-extraction/fam-19vm-hosted-import-acceptance.json`.
3. THE Import Evidence Set SHALL contain the terminal Import Job response at `docs/recipe-extraction/fam-19vm-hosted-import-job-completion.json`.
4. THE Import Evidence Set SHALL contain the independent read-back report at `docs/recipe-extraction/fam-19vm-hosted-read-back-report.json`.
5. WHEN an Import Evidence Set artifact is written, THE artifact SHALL identify `fam-19vm`, the Hosted Target, and the Final Recipe Payload.
6. WHEN the Hosted Read-back Verifier writes the read-back report, THE report SHALL identify the separate read-only verification run and its verification result.
7. THE Import Evidence Set SHALL be Secret-free.
8. IF an operation produces a token or Secret API Key in a response, THEN THE Hosted Import Process SHALL omit that value from every Import Evidence Set artifact.

## Scope Boundaries

- Der Umfang umfasst ausschließlich Hosted-Validierung, Annahme, Abschluss und
  unabhängigen Read-back des Final Recipe Payload für `fam-19vm`.
- Die Hosted-Operation verarbeitet genau die 7.641 Rezeptdatensätze aus dem
  Final Recipe Payload. Bestehende Hosted-Datensätze außerhalb des Imported
  Recipe Set werden weder gelöscht noch als Voraussetzung für den Erfolg
  behandelt.
- Die lokale Übersetzung, lokale Schemaänderungen, Feldmapping, lokale Tests,
  Migrationen und erneute lokale Validierung gehören nicht zum offenen
  Restumfang und werden durch diese Spezifikation nicht erneut gefordert.
- Ein Import-Job-Ergebnis ohne separaten Read-back-Bericht erfüllt den
  Nachweis nicht.
- Diese Requirements-Phase führt keine Hosted-Operation aus. Hosted-
  Validierung, Import und Read-back gehören zu einer nachgelagerten
  Ausführungs- und Abnahmephase.
