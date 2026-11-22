# Implementation Plan: fam-19vm Hosted-Import und unabhängiger Read-back

## Overview

Dieser Plan deckt ausschließlich den offenen Hosted-Restumfang von `fam-19vm` ab. Der bestehende Final Recipe Payload wird gegen das festgelegte Hosted Target vorgeprüft, über die vorhandenen `/api/validate`-, `/api/import`- und Jobstatus-Endpunkte nichtdestruktiv angenommen und nach dem terminalen Jobabschluss durch einen separat gestarteten, ausschließlich lesenden Read-back-Prozess geprüft. Die Umsetzung erzeugt genau vier secret-freie, `fam-19vm`-zugeordnete JSON-Nachweise.

Die Implementierung verwendet TypeScript/Bun und bleibt unter `tools/recipe-extraction/`. Der vorhandene Importserver und sein Upsert-/Unterdatensatzpfad werden wiederverwendet, nicht dupliziert.

## Tasks

- [ ] 1. Gemeinsame Payload-, Gate- und Evidence-Grundlagen implementieren
  - [ ] 1.1 Implementiere `FinalPayloadReader`, `PayloadGate` und den allowlist-basierten `EvidenceWriter` in `tools/recipe-extraction/fam-19vm-hosted-core.ts`.
    - Lade `docs/recipe-extraction/waivy-fam-catalog-import.de.manual-final-0-7640.json` als Bytes genau einmal, bilde SHA-256 und parse über das bestehende `batchSchema` aus `tools/batch-import/schema.ts`.
    - Prüfe vor jedem Schreibpfad das exakte Hosted Target, das Format `fam.catalog_recipe_batch_import.v2`, genau 7.641 Rezepte, eindeutige `externalId`- und `slug`-Werte, `sortOrder` exakt `0..7640` und ausschließlich `draft`, `published` oder `archived`.
    - Bewahre die erwartete Rezeptmap für External ID, Slug, Sort Order und Status unverändert auf; der Gatekeeper darf den Payload nicht normalisieren oder neu serialisieren.
    - Definiere die gemeinsame `EvidenceEnvelope` mit `evidenceFormat`, `beadId`, Hosted Target, relativer Payload-Identität, Status und Zeitstempel.
    - Schreibe ausschließlich die erlaubten Felder für Validate-, Acceptance-, Completion- und Read-back-Nachweise und verhindere das Schreiben bei Authorization-Headern, Import-Token, Secret API Keys, Secret-Umgebungsnamen, `sb_secret_`-Mustern, Cookies oder absoluten Pfaden.
    - Nutze weder `SUPABASE_SERVICE_ROLE_KEY` noch eine neue Schreib- oder Schema-Logik.
    - _Requirements: 1.1–1.7, 5.1–5.8_

  - [ ]* 1.2 Schreibe den Property-Test zu **Property 1: Der Preflight-Gatekeeper verhindert ungültige Hosted-Imports** in `tools/recipe-extraction/fam-19vm-hosted-gate.test.ts`.
    - Erzeuge kontrollierte gültige und ungültige Payload-/Zielvarianten und prüfe mit mindestens 100 Iterationen, dass bei jedem fehlenden Gate-Kriterium kein Importaufruf möglich ist.
    - Beziehe exakte Anzahl, External-ID-/Slug-Eindeutigkeit, Sort-Order-Lücken, ungültige Statuswerte, Zielabweichung und eine nicht bestandene Validate-Antwort ein.
    - Keine echte Hosted-Anfrage ausführen.
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

- [ ] 2. Hosted-Import-Coordinator für Validate, Annahme und Jobabschluss implementieren
  - [ ] 2.1 Implementiere `HostedImportCoordinator` als ausführbares Tool in `tools/recipe-extraction/fam-19vm-hosted-import.ts`.
    - Verwende ausschließlich das festgelegte Target und den festgelegten Payload und sende für `/api/validate` und `/api/import` exakt denselben Byte-Body.
    - Rufe den bestehenden Server aus `tools/batch-import/server.ts` über seine vorhandenen Endpunkte auf; ändere weder `server.ts`, `tools/batch-import/schema.ts` noch `tools/batch-import/import-safety.ts` und füge keinen alternativen Datenbank-Schreibpfad hinzu.
    - Schreibe nach bestandener Payload-Gate- und Validate-Prüfung `docs/recipe-extraction/fam-19vm-hosted-validate-response.json`; rufe `/api/import` nur dann genau einmal mit dem einmaligen `x-recipe-import-token` auf.
    - Wiederhole bei Timeout oder unklarer Annahme niemals automatisch den schreibenden POST. Verwende begrenzte Wiederholung nur für lesende Jobstatus-GETs.
    - Schreibe die angenommene `jobId` und das Target nach der 202-Annahme nach `docs/recipe-extraction/fam-19vm-hosted-import-acceptance.json`.
    - Poll `/api/import/:jobId` bis `completed` oder `failed` und schreibe `docs/recipe-extraction/fam-19vm-hosted-import-job-completion.json`; nur `completed` mit `completed`, `total` und `resultRows` jeweils `7.641` gilt als vollständig.
    - Bewahre die bestehende nichtdestruktive Semantik: Der Coordinator arbeitet nur über den bestehenden `external_id`-Upsert- und Unterdatensatzpfad und verlangt keinen leeren oder exakt 7.641 Datensätze umfassenden Hosted-Bestand.
    - _Requirements: 1.1–1.7, 2.1–2.6, 3.1–3.6_

  - [ ]* 2.2 Schreibe den Property-Test zu **Property 2: Der bestehende Upsert bleibt payloadtreu und begrenzt** in `tools/recipe-extraction/fam-19vm-hosted-import.test.ts`.
    - Prüfe mit kontrollierten Transport-/Serverantworten, dass Validate- und Import-Body bytegleich sind, dass nur der bestehende Import-Endpunkt verwendet wird und dass ein wiederholter identischer Payload keine zusätzlichen Operationen für External IDs außerhalb des Payloads anfordert.
    - Prüfe außerdem, dass ein schreibender POST nach einem Timeout genau einmal versucht wird.
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6**

  - [ ]* 2.3 Schreibe den Property-Test zu **Property 3: Abhängige Datensätze folgen dem bestehenden Importpfad** in `tools/recipe-extraction/fam-19vm-hosted-import.test.ts`.
    - Prüfe den Coordinator-Vertrag so, dass Components, Component Items, Steps, Step Ingredients und Images ausschließlich durch den bestehenden Batch-Importpfad aus demselben Payload verarbeitet werden und der neue Coordinator keine direkten Tabellen- oder Storage-Schreibaufrufe ausführt.
    - Decke mindestens ein Rezept mit allen abhängigen Datensatzgruppen sowie ein nicht betroffenes External-ID-Set ab.
    - **Validates: Requirements 2.3, 2.5**

  - [ ]* 2.4 Schreibe den Property-Test zu **Property 4: Nur ein vollständig passender terminaler Job ist abgeschlossen** in `tools/recipe-extraction/fam-19vm-hosted-import.test.ts`.
    - Prüfe `completed`, `failed`, fehlende Job-ID und jede Abweichung in `completed`, `total` oder `resultRows`.
    - Stelle sicher, dass ein Fehlernachweis die bekannte `jobId` und das Target bewahrt, aber niemals als erfolgreicher Abschluss klassifiziert wird.
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

- [ ] 3. Separaten, schreibgeschützten Read-back-Verifier implementieren
  - [ ] 3.1 Implementiere `HostedReadbackVerifier` als eigene Prozessschnittstelle in `tools/recipe-extraction/fam-19vm-hosted-read-back.ts`.
    - Starte den Verifier nur nach Verfügbarkeit der terminalen Jobantwort und lasse ihn den Final Recipe Payload in seiner eigenen Prozessinstanz erneut laden und hashen.
    - Erzeuge eine eigene `verificationRunId` und verwende nur das festgelegte Target, den Payload-Pfad und die serverseitige Secret-Konfiguration für lesende Supabase-Abfragen.
    - Frage `catalog_recipes` nur für die erwarteten External IDs in begrenzten Chunks und Seiten ab; lese anschließend `catalog_recipe_component_items` für die gefundenen Rezept-IDs sowie die benötigten `substitutions`-Werte.
    - Beschränke die gelesenen Spalten auf `id`, `external_id`, `slug`, `status`, `sort_order`, `substitutions` sowie `note` und führe keine Gesamtzählung des Hosted-Bestands aus.
    - Prüfe genau 7.641 passende External IDs, eindeutige External IDs und Slugs, `sort_order` `0..7640`, Statusgleichheit je External ID, genau 49.036 befüllte `note`-Werte und genau 2.923 befüllte `savings`-Werte.
    - Verwende ausschließlich lesende Methoden und Queries; kein `insert`, `update`, `upsert`, `delete`, Storage-Upload oder schreibendes RPC darf erreichbar sein.
    - Schreibe den Read-back ausschließlich über den gemeinsamen EvidenceWriter nach `docs/recipe-extraction/fam-19vm-hosted-read-back-report.json` und setze bei jeder fachlichen oder technischen Abweichung `status: "failed"` sowie `independentlyVerified: false`.
    - _Requirements: 4.1–4.11, 5.2, 5.4, 5.6–5.8_

  - [ ]* 3.2 Schreibe den Property-Test zu **Property 5: Der Read-back ist nachgelagert und schreibgeschützt** in `tools/recipe-extraction/fam-19vm-hosted-read-back.test.ts`.
    - Prüfe die Reihenfolge nach der terminalen Jobantwort, die eigene Prozess-/Run-ID und dass jede vom Verifier ausgelöste Hosted-Operation eine lesende Methode ist.
    - Weise schreibende Supabase-Methoden, Storage-Uploads und schreibende RPCs im Testtransport zurück.
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 3.3 Schreibe den Property-Test zu **Property 6: Der Read-back prüft nur den erwarteten Imported Recipe Set** in `tools/recipe-extraction/fam-19vm-hosted-read-back.test.ts`.
    - Erzeuge erwartete Payload-Maps und Hosted-Zeilen mit fehlenden oder unerwarteten IDs, doppelten IDs oder Slugs, Sort-Order-Lücken und Statusabweichungen.
    - Prüfe, dass zusätzliche Hosted-Rezepte außerhalb der erwarteten External IDs die Entscheidung nicht beeinflussen und dass keine globale Hosted-Rezeptzählung erforderlich ist.
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.10**

  - [ ]* 3.4 Schreibe den Property-Test zu **Property 7: Persistierte Feldbelegung und Read-back-Fehler werden vollständig abgebildet** in `tools/recipe-extraction/fam-19vm-hosted-read-back.test.ts`.
    - Prüfe die exakten Zähler `49.036` für nicht leere `note`-Werte und `2.923` für nicht leere `savings`-Strings.
    - Prüfe für jeden anderen Zähler oder jede andere Read-back-Abweichung `status: "failed"` und `independentlyVerified: false`.
    - **Validates: Requirements 4.8, 4.9, 4.11**

- [ ] 4. End-to-end-Lifecycle, vier Evidence-Dateien und Fehlerpfade verdrahten
  - [ ] 4.1 Verdrahte `tools/recipe-extraction/fam-19vm-hosted-import.ts` mit `tools/recipe-extraction/fam-19vm-hosted-read-back.ts` und dem EvidenceWriter.
    - Starte den Read-back als separate `bun`-Prozessinstanz erst nach einer verfügbaren terminalen Jobantwort; übergib keine Importantwort als fachliche Datenquelle an den Verifier.
    - Bei `failed`-Job keinen erfolgreichen Read-back-Abschluss behaupten; bei `completed` mit Zählabweichung den diagnostischen Read-back nur als fehlgeschlagenen Gesamtlauf behandeln.
    - Stelle sicher, dass genau diese vier Pfade entstehen und keine zusätzlichen Roh-Response- oder Environment-Dateien geschrieben werden: `fam-19vm-hosted-validate-response.json`, `fam-19vm-hosted-import-acceptance.json`, `fam-19vm-hosted-import-job-completion.json` und `fam-19vm-hosted-read-back-report.json`.
    - Übernehme nur die festgelegten Allowlist-Felder, halte `verificationRunId`, `operation: "read-only"` und `independentlyVerified` im Read-back-Nachweis fest und entferne keine Secrets nachträglich durch String-Bereinigung.
    - _Requirements: 3.5–3.6, 4.1–4.11, 5.1–5.8_

  - [ ]* 4.2 Schreibe den Property-Test zu **Property 8: Jeder Nachweis bleibt eindeutig zugeordnet** in `tools/recipe-extraction/fam-19vm-hosted-evidence.test.ts`.
    - Prüfe für alle vier Artefakte die festen Dateipfade, `beadId: "fam-19vm"`, das exakte Hosted Target und die vollständige Payload-Identität.
    - Prüfe zusätzlich im Read-back-Artefakt eine eigene `verificationRunId`, `operation: "read-only"` und das explizite unabhängige Ergebnis.
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

  - [ ]* 4.3 Schreibe den Property-Test zu **Property 9: Evidence bleibt secret-frei** in `tools/recipe-extraction/fam-19vm-hosted-evidence.test.ts`.
    - Erzeuge Responses mit Authorization-Headern, Import-Tokens, Secret API Keys, Secret-Umgebungsnamen, Cookies und `sb_secret_`-Werten und prüfe, dass der EvidenceWriter sie nicht übernimmt und bei einem Treffer das Schreiben verhindert.
    - Prüfe rekursiv auch verschachtelte Arrays und Objekte sowie absolute Pfade.
    - **Validates: Requirements 5.7, 5.8**

  - [ ]* 4.4 Ergänze gezielte Beispieltests für die nicht durch Properties abgedeckten Fehlerpfade in `tools/recipe-extraction/fam-19vm-hosted-evidence.test.ts`.
    - Decke fehlende Hosted-Konfiguration, Zielabweichung, ungültigen JSON-Body, fehlende Rezept-ID, doppelte Slugs, Query-Fehler und einen fehlgeschlagenen Job ab.
    - Prüfe, dass der Lauf vor dem Schreibrequest abbricht oder einen fehlgeschlagenen, secret-freien Nachweis erzeugt und keine automatische POST-Wiederholung erfolgt.
    - _Requirements: 1.7, 3.5, 3.6, 4.11, 5.7, 5.8_

- [ ] 5. Finaler Checkpoint - gezielte Tests und Abnahmebereitschaft sicherstellen
  - Führe ausschließlich die neuen fokussierten Tests aus: `bun run test tools/recipe-extraction/fam-19vm-hosted-gate.test.ts`, `bun run test tools/recipe-extraction/fam-19vm-hosted-import.test.ts`, `bun run test tools/recipe-extraction/fam-19vm-hosted-read-back.test.ts` und `bun run test tools/recipe-extraction/fam-19vm-hosted-evidence.test.ts`.
  - Führe anschließend `bun run typecheck`, `bun run check` und `git diff --check` aus; keine vollständige Test-Suite und niemals `bun test`.
  - Prüfe vor einer späteren, ausdrücklich freigegebenen Ausführungsphase, dass der Code die vier Nachweise mit Validate-Erfolg, angenommener `jobId`, terminalem `7.641 / 7.641 / 7.641`-Job und unabhängigem Read-back mit `7.641`, `0..7640`, Statusgleichheit, `49.036` und `2.923` erzeugen kann.
  - Diese Spezifikationsphase führt keine Hosted-Validierung, keinen Import, keinen Read-back und keine Evidence-Erzeugung aus; die Abnahmebedingungen werden hier nur als automatisierte Tests und spätere Ausführungsanforderungen festgehalten.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Der Umfang beginnt bei der Hosted-Orchestrierung. Bereits abgeschlossen und nicht erneut umzusetzen sind lokales Schema, Übersetzungsfelder, `source_note`, `savings`, Batch-Import-Mapping und die bestehenden lokalen Tests.
- `tools/batch-import/server.ts`, `tools/batch-import/schema.ts` und `tools/batch-import/import-safety.ts` sind bestehende Verträge. Die neuen Tools dürfen deren Endpunkte und Sicherheitsfunktionen verwenden, aber keinen zweiten Importpfad oder eine globale Löschlogik einführen.
- `SUPABASE_SECRET_KEY` und der einmalige Import-Token bleiben ausschließlich im kontrollierten Server-/Prozesskontext. Kein Secret, kein Secret-Umgebungsname und kein `SUPABASE_SERVICE_ROLE_KEY` darf in Quelltext-Ausgaben oder Evidence-Dateien erscheinen.
- Tests für Hosted-HTTP- und Datenbankverhalten bleiben kontrollierte Mock-/Contract-Tests. Es werden weder Fake-Supabase-Programme noch Fake-Docker-Programme angelegt und während der Spezifikationsphase keine Hosted-Operationen ausgeführt.
- Tasks mit `*` sind optionale Testaufgaben. Die Kernimplementierung darf die bestehenden lokalen Übersetzungs-, Schema- oder Mappingtests nicht erneut verändern.
- Jeder Task referenziert die zugehörigen Requirements und die Property-Aufgaben referenzieren die nummerierten Correctness Properties aus `design.md`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "3.2"] },
    { "id": 4, "tasks": ["2.3", "3.3"] },
    { "id": 5, "tasks": ["2.4", "3.4"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2"] },
    { "id": 8, "tasks": ["4.3"] },
    { "id": 9, "tasks": ["4.4"] },
    { "id": 10, "tasks": ["5"] }
  ]
}
```
