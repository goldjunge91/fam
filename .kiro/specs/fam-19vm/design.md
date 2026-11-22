# Technical Design: fam-19vm

## Overview

Dieser Entwurf beschreibt ausschließlich den noch offenen Hosted-Restumfang von
`fam-19vm`:

1. den bereits vorhandenen finalen deutschen Payload gegen das festgelegte
   Hosted-Ziel vorprüfen,
2. denselben Payload über den vorhandenen Batch-Importpfad nichtdestruktiv
   annehmen und den asynchronen Importjob bis zum terminalen Zustand verfolgen,
3. danach einen separat gestarteten, ausschließlich lesenden Read-back des
   persistierten Hosted-Bestands durchführen und
4. vier secret-freie, eindeutig `fam-19vm` zugeordnete JSON-Nachweise unter
   `docs/recipe-extraction/` schreiben.

Die Designphase führt keine Hosted-Operation aus. Sie ändert keinen
Produktivcode, kein Supabase-Schema und keine lokalen Daten.

### 1.1 Fester Gegenstand

| Gegenstand | Verbindlicher Wert |
|---|---|
| Hosted Target | `https://ivvebtqasotqpikuydov.supabase.co` |
| Final Recipe Payload | `docs/recipe-extraction/waivy-fam-catalog-import.de.manual-final-0-7640.json` |
| Payload-Format | `fam.catalog_recipe_batch_import.v2` |
| Rezeptanzahl | `7.641` |
| `sortOrder` | jede ganze Zahl von `0` bis `7.640`, genau einmal |
| Erwartete befüllte Notizwerte | `49.036` |
| Erwartete befüllte Savings-Werte | `2.923` |
| Evidence-Verzeichnis | `docs/recipe-extraction/` |

Die Begriffe `source_note` und `savings` erscheinen in diesem Entwurf nur als
bereits vorhandene, zu verifizierende Persistenzwerte. Ihre Übersetzung, ihr
Schema, ihr Mapping und die dazugehörigen lokalen Tests sind abgeschlossen und
werden nicht erneut implementiert.

### 1.2 Explizite Grenzen

Nicht Teil dieser Umsetzung sind:

- Änderungen am lokalen SQLite- oder Supabase-Schema,
- Änderungen am Übersetzungsworkflow oder an Übersetzungsfeldern,
- Änderungen an `source_note`, `savings` oder deren bestehendem Mapping,
- Änderungen an `tools/batch-import/schema.ts` oder am bestehenden Upsert- und
  Unterdatensatz-Importpfad,
- neue lokale Testfälle für die bereits abgeschlossenen Übersetzungs-, Schema-
  oder Mappingarbeiten,
- ein Löschen oder Neuaufbauen des gesamten Hosted-Rezeptbestands,
- eine Hosted-Operation während der Designphase.

## 2. Bestehende Verträge und Wiederverwendung

### 2.1 Finaler Payload

Der Coordinator liest den Payload als Bytes genau einmal aus dem angegebenen
Repository-Pfad. Er berechnet daraus eine SHA-256-Prüfsumme und verwendet
anschließend dieselben Bytes für die Validate- und Import-Anfrage. Dadurch kann
zwischen den beiden Anfragen weder durch erneute Serialisierung noch durch ein
anderes Arbeitsverzeichnis ein abweichender Payload entstehen.

Die bestehende `batchSchema` in `tools/batch-import/schema.ts` bleibt die
Strukturprüfung. Sie prüft unter anderem `schemaVersion`, verschachtelte
Rezeptdaten sowie die Eindeutigkeit von `externalId` und `slug`. Die zusätzliche
fam-19vm-Gate-Prüfung ergänzt nur die für diesen Hosted-Lauf festgelegten
Bestandsinvarianten: exakte Anzahl, vollständige Sortierreihenfolge und erlaubte
Statuswerte. Sie verändert den Payload nicht.

### 2.2 Vorhandener Batch-Importserver

Der vorhandene Server in `tools/batch-import/server.ts` bleibt die einzige
Importausführung:

- `POST /api/validate` parst den JSON-Batch über `batchSchema` und gibt die
  erkannte Rezeptanzahl zurück.
- `POST /api/import` parst denselben Batch erneut, prüft die bestehende
  Importautorisierung und startet einen asynchronen Job.
- `GET /api/import/:jobId` liefert den Jobstatus und ist der bestehende
  Pollingpfad.
- Der tatsächliche Datenbankzugriff wird über `SUPABASE_URL` beziehungsweise
  `EXPO_PUBLIC_SUPABASE_URL` auf das Hosted Target gerichtet.
- Der Import verwendet `SUPABASE_SECRET_KEY` als serverseitigen Secret API Key.
  `SUPABASE_SERVICE_ROLE_KEY` wird nicht verwendet und darf weder im Prozess-,
  Log- noch Evidence-Kontext auftauchen.

Die bestehende `tools/batch-import/import-safety.ts` bleibt maßgeblich für den
Schutz des Schreibpfads: Das konfigurierte Ziel muss exakt übereinstimmen und
der `x-recipe-import-token` ist pro Serverlauf einmalig. Schreibende POST-
Anfragen werden nicht automatisch wiederholt, weil ein Timeout nach bereits
angenommener Remote-Schreiboperation nicht sicher von einer Nichtannahme
unterschieden werden kann. Lesende GET-Anfragen dürfen den vorhandenen
begrenzten Retrypfad verwenden.

### 2.3 Bestehender Upsert- und Unterdatensatzpfad

`importBatch` in `tools/batch-import/server.ts` wird unverändert wiederverwendet:

1. `catalog_recipes` wird über `external_id` upsertet.
2. Für ein bereits vorhandenes Rezept werden die abhängigen Zeilen des
   betroffenen Rezepts über den bestehenden Pfad ersetzt.
3. Components, Component Items, Steps, Step Ingredients, Recipe Images und
   Step Images werden aus genau diesem Payload verarbeitet.
4. Uploads verwenden die bestehende `upsert`-Semantik.

„Nichtdestruktiv“ bedeutet hier: Es gibt keinen globalen Delete, keinen
Vollbestandsabgleich und keine Vorbedingung eines leeren Hosted-Bestands. Ein
Hosted-Datensatz, dessen `external_id` nicht im Final Recipe Payload vorkommt,
bleibt unangetastet. Die bereits im Importpfad vorhandene Ersetzung der
Unterdatensätze eines aktualisierten Rezeptes ist Teil dieses bestehenden
Vertrags und wird nicht durch einen neuen Importmechanismus ersetzt.

## Architecture

## Components and Interfaces

| Komponente | Verantwortung | Schreibzugriff |
|---|---|---|
| `FinalPayloadReader` | lädt die festgelegte Datei einmal, bildet Payload-Identität und erwartete Rezeptmap | keiner |
| `HostedImportCoordinator` | führt Preflight, Validate, Acceptance und Job-Polling in fester Reihenfolge aus | indirekt über bestehenden Importserver |
| `PayloadGate` | prüft exakte Payload- und Zielinvarianten vor dem Import | keiner |
| `EvidenceWriter` | schreibt ausschließlich allowlist-basierte, secret-freie JSON-Dokumente | nur vier lokale Evidence-Dateien |
| `HostedReadbackVerifier` | separater Prozess; liest den persistierten Hosted-Bestand und vergleicht ihn mit dem erneut geladenen Payload | ausschließlich lesend am Hosted Target |
| bestehender `importBatch`-Pfad | führt den Upsert und die Verarbeitung der Unterdatensätze aus | bestehender Hosted-Schreibpfad |

Falls dafür ein ausführbares Hilfsprogramm benötigt wird, gehört es als
operatives Tool unter `tools/recipe-extraction/`, nicht nach `src/` und nicht in
eine Supabase Edge Function. Der bestehende Batchserver wird nicht dupliziert
und nicht in eine zweite Importlogik überführt.

### 3.2 Ablauf

```text
Final Recipe Payload bytes
        |
        v
PayloadGate + POST /api/validate
        |  alle Checks bestanden
        v
fam-19vm-hosted-validate-response.json
        |
        v
POST /api/import mit exakt denselben Bytes und Einmal-Token
        |
        v
fam-19vm-hosted-import-acceptance.json
        |
        v
GET /api/import/:jobId bis completed oder failed
        |
        v
fam-19vm-hosted-import-job-completion.json
        |
        v
separate Read-back-Prozessinstanz, Payload erneut geladen
        |
        v
nur lesende Queries gegen Hosted Target
        |
        v
fam-19vm-hosted-read-back-report.json
```

Der Read-back verwendet weder `job.result` noch die Importantwort als
Datenquelle für seine Vergleiche. Er lädt den Final Recipe Payload in seiner
eigenen Prozessinstanz erneut, bildet daraus seine erwartete `externalId`-,
`slug`-, `sortOrder`- und Statusmap und fragt die Hosted-Tabellen unabhängig ab.
Eine optionale Referenz auf die vorherige `jobId` dient nur der Nachvollziehbarkeit
im Bericht, nicht der fachlichen Prüfung.

## Data Models

### 4.1 Payload- und Evidence-Identität

Die folgenden strukturierten Werte werden intern verwendet und in gekürzter,
secret-freier Form in den Nachweisen wiederholt:

```ts
type PayloadIdentity = {
  path: 'docs/recipe-extraction/waivy-fam-catalog-import.de.manual-final-0-7640.json';
  format: 'fam.catalog_recipe_batch_import.v2';
  sha256: string;
  recipeCount: 7641;
  sortOrderFrom: 0;
  sortOrderTo: 7640;
};

type EvidenceEnvelope = {
  evidenceFormat: 'fam-19vm.hosted-evidence.v1';
  beadId: 'fam-19vm';
  target: 'https://ivvebtqasotqpikuydov.supabase.co';
  payload: PayloadIdentity;
  status: 'passed' | 'failed';
  createdAt: string;
};

type ExpectedRecipe = {
  externalId: string;
  slug: string;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
};
```

Die Payload-Identität verwendet einen Repository-relativen Pfad. Absolute
Arbeitsverzeichnis- oder Worktree-Pfade werden nicht in neue Nachweise
übernommen.

### 4.2 Preflight- und Validate-Schnittstelle

Der Coordinator startet den bestehenden Batchserver mit einer expliziten
Zielgleichheit:

```text
SUPABASE_URL = https://ivvebtqasotqpikuydov.supabase.co
RECIPE_IMPORT_ALLOWED_TARGET = https://ivvebtqasotqpikuydov.supabase.co
SUPABASE_SECRET_KEY = serverseitig vorhanden, niemals als Artefaktwert
```

Vor dem Import werden alle folgenden Checks erfolgreich abgeschlossen:

1. Der Pfad ist exakt der Final Recipe Payload.
2. Das Format und `schemaVersion` entsprechen dem freigegebenen v2-Payload.
3. Der Payload enthält genau 7.641 Rezepte.
4. Jede `externalId` kommt genau einmal vor.
5. Jeder `slug` kommt genau einmal vor.
6. Die sortierten `sortOrder`-Werte sind exakt die Folge `0..7640`.
7. Jeder Status ist `draft`, `published` oder `archived`; der Status wird nicht
   normalisiert oder durch einen Defaultwert ersetzt.
8. `POST /api/validate` antwortet erfolgreich und bestätigt 7.641 Rezepte.

Die bestehende `/api/validate`-Antwort allein deckt nicht alle exakten
fam-19vm-Invarianten ab. Deshalb ist der PayloadGate der abschließende
Import-Gatekeeper. Bei jedem fehlenden Check wird `/api/import` nicht aufgerufen.
Die Validate-Evidence enthält sowohl die allowlist-basierte Serverantwort als
auch die einzelnen Gate-Ergebnisse.

### 4.3 Importannahme und Jobabschluss

Nach einem vollständig bestandenen Gate wird der unveränderte Byte-Body genau
einmal an `POST /api/import` gesendet. Die Annahme gilt nur bei einer
akzeptierten Antwort mit `jobId`. Die Acceptance-Evidence enthält:

- `jobId`,
- Hosted Target,
- Endpointkennung,
- Payload-Identität,
- Annahmezeitpunkt und
- eine allowlist-basierte Kopie von `{ ok, jobId }`.

Der Coordinator pollt `GET /api/import/:jobId` bis `completed` oder `failed`.
Die terminale Evidence normalisiert die vorhandene Antwort auf mindestens:

```ts
type ImportCompletion = {
  jobId: string;
  status: 'completed' | 'failed';
  approvedTarget: string;
  completed: number;
  total: number;
  resultRows: number;
  error?: string;
};
```

`resultRows` wird aus dem vorhandenen Ergebnisbericht des Jobs gezählt, ohne
einen zweiten Import oder eine zweite Persistenzlogik einzuführen. Ein Job gilt
nur dann als abgeschlossen, wenn sein Status `completed` ist und
`completed`, `total` sowie `resultRows` jeweils `7.641` betragen. Ein
`failed`-Job oder jede abweichende Zahl wird als fehlgeschlagen dokumentiert.

### 4.4 Unabhängiger Read-back

Der Read-back wird als eigener Prozess nach Verfügbarkeit des terminalen
Jobstatus gestartet. Seine Eingaben sind nur:

- der festgelegte Hosted Target,
- der festgelegte Payload-Pfad und
- die serverseitige Secret-Konfiguration für lesende Supabase-Abfragen.

Die Importantwort wird nicht als erwartete Datenmenge oder Datenquelle
übergeben. Der Prozess erzeugt eine eigene `verificationRunId` und lädt den
Payload erneut.

Die Abfragen sind auf den Imported Recipe Set beschränkt. Wegen der Hosted-
Seitengröße werden External IDs in begrenzten Chunks abgefragt und Ergebnisse
seitenweise gesammelt. Die Queries lesen nur die für die Abnahme erforderlichen
Spalten:

- `catalog_recipes`: `id`, `external_id`, `slug`, `status`, `sort_order`,
  `substitutions`, gefiltert über die erwarteten External IDs;
- `catalog_recipe_component_items`: `id`, `recipe_id`, `note`, gefiltert über
  die zuvor gelesenen Rezept-IDs;
- keine Gesamtzählung des Hosted-Rezeptbestands und keine unbeschränkte
  Vollbestandsabfrage.

Der Verifier prüft für die gelesenen Rezeptzeilen:

- genau 7.641 Treffer für die erwarteten External IDs,
- keine doppelte `external_id`,
- keine doppelte `slug`,
- `sort_order` exakt `0..7640`,
- Statusgleichheit zur erwarteten Payload-Map je `external_id`,
- keine fehlende oder unerwartete External ID.

Für die beiden bereits persistierten Werte gelten die exakten Read-back-Zähler:

- `note` zählt als befüllt, wenn der Wert nicht `null` und nicht leer ist; der
  Zähler muss `49.036` betragen.
- In den gelesenen `substitutions` zählt ein nicht leerer String unter
  `savings` als befüllt; der Zähler muss `2.923` betragen.

Die Read-back-Implementierung darf ausschließlich lesende Methoden und
Abfragen verwenden. Verboten sind `insert`, `update`, `upsert`, `delete`,
Storage-Uploads und schreibende RPCs. Ein nicht befüllter oder nicht erreichbarer
Read-back zählt nicht als unabhängige Verifikation.

## 5. Evidence-Design

### 5.1 Vier feste Dateien

Es werden genau diese vier neuen Nachweise vorgesehen:

1. `docs/recipe-extraction/fam-19vm-hosted-validate-response.json`
2. `docs/recipe-extraction/fam-19vm-hosted-import-acceptance.json`
3. `docs/recipe-extraction/fam-19vm-hosted-import-job-completion.json`
4. `docs/recipe-extraction/fam-19vm-hosted-read-back-report.json`

Jeder Nachweis enthält die gemeinsame Evidence-Envelope mit `beadId`, Hosted
Target und Payload-Identität. Der Read-back-Nachweis enthält zusätzlich
`verificationRunId`, `operation: "read-only"`, Start-/Endzeitpunkt und das
explizite Ergebnis `independentlyVerified`.

### 5.2 Allowlist statt nachträglicher Bereinigung

Der EvidenceWriter serialisiert nie rohe Request- oder Response-Objekte. Für
jede Evidence-Datei werden nur erwartete Felder in eine neue Struktur kopiert.
Nicht übernommen werden insbesondere:

- `Authorization`-Header,
- `x-recipe-import-token`,
- `SUPABASE_SECRET_KEY`,
- Secret- oder Token-Umgebungsvariablen,
- Cookies,
- rohe Fehlerkörper von Upstream-Diensten,
- vollständige Environment-Dumps.

Zusätzlich läuft vor dem finalen Schreiben ein rekursiver Secret-Sicherheitscheck
über die erzeugte JSON-Struktur. Er sucht nach verbotenen Schlüsseln und
Secret-Mustern wie `sb_secret_` oder Tokenwerten. Ein Treffer verhindert das
Schreiben des betreffenden Artefakts und markiert den Lauf als nicht
abnahmefähig.

Die Nachweise enthalten keine absoluten Pfade, keine Zugangsdaten und keine
unnötigen Rohdaten. Rezept- und Zählerwerte dürfen enthalten sein, weil sie die
fachliche Abnahme des festgelegten Payloads belegen.

### 5.3 Zustände der Nachweise

- `passed`: Der jeweilige Schritt und seine eigenen Checks sind bestanden.
- `failed`: Der Schritt ist ausgeführt worden, aber ein Check oder eine
  technische Voraussetzung ist fehlgeschlagen.
- Ein Acceptance- oder Completion-Nachweis mit `failed` darf nicht als
  erfolgreicher Import interpretiert werden.
- Ein Read-back mit `independentlyVerified: false` darf den Hosted-Import nicht
  als unabhängig belegt markieren, selbst wenn der Jobstatus `completed` war.

## Error Handling

### 6.1 Vor dem Schreibpfad

Fehlt eine Zielvariable, stimmt das Ziel nicht exakt überein, kann der Payload
nicht geparst werden oder scheitert ein PayloadGate, endet der Lauf vor
`POST /api/import`. Es wird kein Schreib-Token angefordert oder verwendet. Die
Validate-Evidence darf einen fehlgeschlagenen Gate-Zustand dokumentieren; eine
Acceptance- oder Completion-Evidence wird nur für tatsächlich erreichte
Schritte geschrieben.

### 6.2 Unklare Importannahme

Ein Timeout, eine abgebrochene Verbindung oder ein fehlender HTTP-Body nach
`POST /api/import` ist ein unbekannter Annahmezustand. Der Coordinator sendet
die schreibende Anfrage nicht automatisch erneut. Ein erneuter Versuch darf
erst nach manueller Klärung der bekannten `jobId`, des Serverlogs oder eines
separaten Read-backs mit einem neuen, einmaligen Token erfolgen.

Diese Regel folgt dem bestehenden `fetchWithRetry`-Vertrag: Nur GET-, HEAD- und
OPTIONS-Anfragen werden wiederholt. Ein POST-Timeout darf nicht als sichere
Nichtannahme behandelt werden.

### 6.3 Jobfehler und Zählabweichungen

- `status: failed`: Fehler mit begrenzter, secret-freier Meldung dokumentieren;
  niemals `completed` setzen.
- `status: completed` mit abweichendem `completed`, `total` oder `resultRows`:
  Zählabweichung dokumentieren und den Lauf nicht als vollständig klassifizieren.
- Bei einem terminalen `completed`-Status wird der separate Read-back auch bei
  einer Zählabweichung gestartet, wenn der Verifier zur Diagnose verfügbar ist.
  Das Gesamtergebnis bleibt fehlgeschlagen, bis sowohl Jobzahlen als auch
  Read-back bestehen.
- Bei einem `failed`-Job ist kein erfolgreicher Read-back-Abschluss möglich.

### 6.4 Read-back-Fehler

Transiente Fehler während lesender GET-Abfragen dürfen begrenzt wiederholt
werden. Bleibt eine Abfrage fehlgeschlagen, schreibt der Verifier einen
fehlgeschlagenen Read-back-Bericht, ohne den Hosted-Bestand zu verändern. Ein
späterer Read-back darf mit neuer `verificationRunId` wiederholt werden; ein
erneuter Import ist dafür nicht erforderlich.

Fehlende IDs, doppelte IDs oder Slugs, Lücken in `sort_order`, Statusabweichungen
und abweichende Notiz-/Savings-Zähler sind fachliche Fehler. Sie werden mit
konkreten, nicht geheimen Differenzwerten im Bericht festgehalten.

### 6.5 Idempotenz

Ein absichtlich mit demselben Byte-Payload wiederholter Lauf nutzt weiterhin
das bestehende `external_id`-Upsert. Für die 7.641 Payload-Rezepte konvergiert
der Rezept- und Unterdatensatzbestand damit auf denselben Inhalt; Datensätze
außerhalb des Imported Recipe Set werden nicht verändert. Der bestehende
Unterdatensatzpfad darf beim Update die abhängigen Zeilen des betroffenen
Rezepts ersetzen, ohne daraus einen globalen Delete zu machen.

Die Idempotenz ist eine fachliche Eigenschaft des bestehenden Pfads, kein Anlass
für eine zweite Importimplementierung. Sie schützt nicht vor der Gefahr eines
unbeabsichtigten erneuten POSTs nach unbekanntem Timeout. Deshalb bleiben
Einmal-Token und die Regel „keine automatische Schreibwiederholung“ bestehen.

## Testing Strategy

### 7.1 Testgrenzen

Die abgeschlossenen lokalen Übersetzungs-, Schema- und Mappingtests werden
nicht erweitert oder erneut als Implementierungsumfang aufgenommen. Die
Verifikation konzentriert sich auf die neue Hosted-Orchestrierung, den
Read-back-Vergleich und die Evidence-Sicherheit.

Es wird kein Fake-Supabase und kein Fake-Docker-Programm in das Repository
aufgenommen. Hosted-Zustand wird nur durch den ausdrücklich freigegebenen
Import und den anschließenden Read-back geprüft.

### 7.2 Deterministische Coordinator-Prüfungen

Wenn für den Ablauf ein operatives Tool ergänzt wird, sollen seine reinen
Entscheidungsfunktionen mit kontrollierten Antworten geprüft werden:

- ein Gate-Fehler erzeugt keinen `/api/import`-Aufruf,
- Validate und Import verwenden denselben Byte-Body,
- ein schreibender POST wird nach einem Timeout nicht wiederholt,
- nur `completed` mit drei exakten 7.641-Zählern gilt als vollständig,
- jeder terminale Fehler oder jede Zählabweichung bleibt fehlgeschlagen,
- der Read-back-Comparator meldet fehlende, doppelte oder abweichende Zeilen,
- der EvidenceWriter übernimmt nur allowlist-basierte Felder und weist
  Secret-Schlüssel sowie Secret-Muster zurück.

Reine Invarianten werden, wo eine Property-Testumgebung bereits vorhanden ist,
mit mindestens 100 Iterationen geprüft. Die Hosted-HTTP- und Datenbankteile
bleiben gezielte Mock- oder Integrationstests mit wenigen Beispielen, nicht
zufällige reale Hosted-Aufrufe.

### 7.3 Kontrollierte Hosted-Verifikation

Die nachgelagerte Ausführung erfolgt in dieser Reihenfolge:

1. Server mit exakt freigegebenem Hosted Target und serverseitiger Secret-
   Konfiguration starten.
2. Finalen Payload laden, Hash und Gate-Zusammenfassung prüfen.
3. `/api/validate` ausführen und die erste Evidence-Datei schreiben.
4. Nach bestandener Validate-Evidence einmalig `/api/import` senden und die
   Acceptance-Evidence sofort schreiben.
5. Job ausschließlich über `GET /api/import/:jobId` verfolgen und die
   Completion-Evidence schreiben.
6. Den Server- oder Prozesskontext für den Import verlassen und den Read-back
   als separate Prozessinstanz starten.
7. Read-back-Abfragen ausschließlich auf den Imported Recipe Set begrenzen und
   die vierte Evidence-Datei schreiben.
8. Alle vier JSON-Dateien strukturell, auf `fam-19vm`-Zuordnung und auf
   Secret-Freiheit prüfen.

Die entscheidende Abnahme besteht erst aus der Kombination von:

- erfolgreicher Validate-Evidence,
- angenommener `jobId`,
- terminalem Job mit `7.641 / 7.641 / 7.641`,
- unabhängigem Read-back mit eindeutigen IDs und Slugs, vollständiger
  Sortierreihenfolge, Statusgleichheit sowie `49.036` und `2.923` befüllten
  Werten.

Ein Jobbericht ohne die vierte Datei ist kein vollständiger Nachweis.

### 7.4 Repository-Kommandos nach einer späteren Implementierung

Für eine spätere Implementierung des operativen Tools gelten die bestehenden
Repository-Regeln:

```text
bun run test <gezielter-Testpfad>
bun run typecheck
bun run check
```

Es wird nicht `bun test` und nicht die vollständige Testsuite als Standardcheck
verwendet. In dieser Designphase werden diese Kommandos nicht ausgeführt, weil
weder Produktivcode noch der Hosted-Zustand geändert werden.

## Correctness Properties

Die Property-Reflexion hat redundante Kriterien zusammengeführt: Jobstatus und
alle drei Abschlusszähler bilden eine gemeinsame Abschlussentscheidung; die
Evidence-Anforderungen werden in Attribution und Secret-Freiheit getrennt; die
Payload-Invarianten bleiben von den Read-back-Invarianten getrennt, weil sie
unterschiedliche Zustände prüfen. Reale Hosted- und Infrastrukturverhalten
bleiben gezielte Integrations- oder Smoke-Verifikation und werden nicht durch
zufällige Hosted-Aufrufe ersetzt.

### Property 1: Der Preflight-Gatekeeper verhindert ungültige Hosted-Imports

**For any** Payload und Zielkonfiguration darf der Coordinator `POST /api/import`
 genau dann aufrufen, wenn Target und Payload-Identität stimmen, der Payload
 genau 7.641 Rezepte enthält, External IDs und Slugs eindeutig sind,
 `sortOrder` exakt `0..7640` bildet, jeder Status aus `draft`, `published` oder
 `archived` stammt und `POST /api/validate` erfolgreich 7.641 Rezepte bestätigt.
 Bei jedem fehlenden Kriterium bleibt die Anzahl der Importaufrufe null.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Der bestehende Upsert bleibt payloadtreu und begrenzt

**For any** bestandenen Preflight muss der Importrequest bytegleich mit dem
validierten Final Recipe Payload sein und den bestehenden Upsert-Schlüssel
`external_id` verwenden. Ein absichtlich wiederholter Lauf mit exakt diesem
Payload konvergiert für die Payload-Rezepte auf denselben Rezept- und
Unterdatensatzinhalt, während Hosted-Datensätze außerhalb der Payload-External-
IDs unverändert bleiben.

**Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.6**

### Property 3: Abhängige Datensätze folgen dem bestehenden Importpfad

**For any** Rezept im Final Recipe Payload verarbeitet der bestehende Importpfad
seine Components, Component Items, Steps, Step Ingredients und Images aus
 demselben Rezeptpayload, ohne einen abhängigen Datensatz eines nicht
 betroffenen External-ID-Sets zu löschen oder zu ersetzen.

**Validates: Requirements 2.3, 2.5**

### Property 4: Nur ein vollständig passender terminaler Job ist abgeschlossen

**For any** terminale Importjobantwort gilt der Hosted-Import genau dann als
vollständig, wenn sie `completed` meldet und `completed`, `total` sowie
`resultRows` jeweils `7.641` betragen. Jede `failed`-Antwort, jede fehlende
Job-ID oder jede Zählabweichung wird als nicht abgeschlossen dokumentiert; die
angenommene Job-ID und das Ziel bleiben dabei im Nachweis erhalten.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

### Property 5: Der Read-back ist nachgelagert und schreibgeschützt

**For any** terminalen Job mit `completed` startet der Coordinator den Read-back
als eigene Prozessinstanz nach Verfügbarkeit der terminalen Antwort. Jede vom
Read-back ausgelöste Hosted-Operation ist lesend; kein Read-back darf Insert,
Update, Upsert, Delete, Storage-Upload oder schreibendes RPC ausführen.

**Validates: Requirements 4.1, 4.2**

### Property 6: Der Read-back prüft nur den erwarteten Imported Recipe Set

**For any** erwartete Payload-Rezeptmap und gelesene Hosted-Zeilen besteht die
Read-back-Prüfung nur bei genau 7.641 passenden External IDs, eindeutigen
External IDs und Slugs, der vollständigen Sortierreihenfolge `0..7640` und
Statusgleichheit je External ID. Hosted-Datensätze außerhalb der erwarteten
External IDs beeinflussen diese Entscheidung nicht.

**Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.10**

### Property 7: Persistierte Feldbelegung und Read-back-Fehler werden vollständig
abgebildet

**For any** Read-back-Ergebnis gilt die Prüfung nur dann als unabhängig
bestanden, wenn genau `49.036` befüllte `note`-Werte und genau `2.923`
befüllte `savings`-Werte im Imported Recipe Set gezählt werden. Jeder andere
Zähler oder jede andere Read-back-Abweichung setzt `status` auf `failed` und
`independentlyVerified` auf `false`.

**Validates: Requirements 4.8, 4.9, 4.11**

### Property 8: Jeder Nachweis bleibt eindeutig zugeordnet

**For all** vier Evidence-Artefakte gelten die festgelegten Dateipfade, die
`fam-19vm`-Zuordnung, das exakte Hosted Target und die Identität des Final
Recipe Payload. Der Read-back-Nachweis enthält zusätzlich eine eigene
`verificationRunId`, `operation: "read-only"` und ein explizites
Verifikationsergebnis.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

### Property 9: Evidence bleibt secret-frei

**For all** erzeugten Evidence-Artefakte darf kein Authorization-Header,
Import-Token, Secret API Key, Secret-Umgebungsname oder secret-artiger Wert
enthalten sein. Jede aus einer API-Antwort übernommene Information muss durch
die feste Allowlist laufen; ein Token oder Secret aus einer Response wird nie
in ein Artefakt geschrieben.

**Validates: Requirements 5.7, 5.8**

## 9. Abschlusskriterien des Designs

Die spätere Umsetzung dieses Designs ist erst abnahmefähig, wenn:

- der vorhandene Final Recipe Payload unverändert verwendet wurde,
- Validate vor dem ersten Schreibrequest bestanden hat,
- der bestehende Upsert- und Unterdatensatzpfad verwendet wurde,
- der Importjob getrennt nach Annahme und terminalem Abschluss belegt ist,
- der Read-back in einem separaten Prozess ausschließlich lesend lief,
- alle vier JSON-Dateien unter den festgelegten Pfaden liegen,
- jedes Artefakt `fam-19vm`, Hosted Target und Payload-Identität trägt,
- kein Artefakt ein Secret enthält und
- die unabhängigen Read-back-Werte `7.641`, eindeutige Identitäten,
  `0..7640`, passende Statuswerte, `49.036` und `2.923` belegen.

Diese Designphase erfüllt nur die Dokumentation dieses Vorgehens. Hosted-
Validierung, Import, Read-back und das Schreiben der vier Nachweise bleiben
bewusst der nachgelagerten Ausführungsphase vorbehalten.
