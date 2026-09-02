# fam AI: Die Best-of-Breed-Architektur

**Status:** Architektur-Synthese  
**Stand:** 1. September 2026  
**Geltungsbereich:** aktuell ausschließlich natürlichsprachliche Erfassung verderblicher Lebensmittel und read-only Kochvorschläge aus dem vorhandenen Bestand  
**Nicht enthalten:** Barcode-/Etikett-/Beleg-/Kühlschrankfoto-Workflows, Umsetzungscode, finale Provider-Beschaffung, UI-Entwurf und eine Freigabe für autonome Aktionen

## Executive Decision

fam wird als **local-first Haushalts- und Inventory-System mit begrenzter AI-Assistenz** gebaut, nicht als AI-Agent mit angehängter Datenbank.

Die Architektur trennt fünf Verantwortungen:

1. **Die App besitzt den Workflow.** Expo, SQLite und die bestehende Outbox bleiben der normale Pfad für Nutzeraktionen und bestätigte Änderungen.
2. **Postgres besitzt die gemeinsame Wahrheit.** Supabase, deklaratives Schema und RLS bleiben die Autorität für Haushaltsgrenzen und synchronisierten Zustand.
3. **Deterministische Domänenlogik besitzt Fakten und Regeln.** Mengen, Datumslogik, Priorisierung, Berechtigungen, Allergien, Lebensmittelsicherheit und Erinnerungen werden nicht an ein LLM delegiert.
4. **Die AI besitzt nur Interpretation und Formulierung.** Sie extrahiert Kandidaten aus Text oder Bild, ordnet mehrdeutige Eingaben ein und formuliert Vorschläge aus bereits geprüften Fakten.
5. **Der Nutzer besitzt die Entscheidung.** AI-Ergebnisse sind Vorschläge. Eine Bestätigung wird anschließend über denselben lokalen Mutationspfad ausgeführt wie eine manuelle Aktion.

Die zentrale Invariante lautet:

> Ein Modell kann eine Observation interpretieren und eine Aktion vorschlagen. Es kann weder Haushaltswahrheit erzeugen noch eine sicherheitskritische Entscheidung überschreiben.

Diese Entscheidung verbindet die stärksten Aussagen aller Quelldokumente mit den bestehenden fam-Pfeilern RLS, deklaratives Schema und Local First.

### Aktueller Produkt-Scope

Für die nächste Umsetzung gelten nur zwei Szenarien als relevant:

1. eine natürliche Meldung wie „Ich habe diese verderblichen Lebensmittel“;
2. die Frage „Was kann ich heute mit den Zutaten kochen, die ich habe?“.

Die weiteren Abläufe in Abschnitt 4 bleiben als Architektur- und Zukunftskontext
erhalten, sind aber nicht Teil der aktuellen Skill-Implementierung oder des
aktuellen Evaluationskorpus.

## 1. Wie diese Synthese entstanden ist

Die Dokumente enthalten drei Ebenen, die getrennt bewertet werden müssen:

| Quellenfamilie | Stärke | Verwendung in dieser Synthese |
| --- | --- | --- |
| `research_1.md`, `research_2.md`, `research_3.md` | Breite Varianten zu Kosten, Routing, Tools, Kontext, Safety und Betrieb | Ideenraum und Vergleich konkurrierender Ausprägungen |
| `research_4.md` und `research_5.md` | Identische Kurzfassung | Kompakte Gegenprobe, nicht zwei unabhängige Belege |
| `fam-ai-kosten-best-practices-sept-2026.md` | Verdichtete Kosten- und Provideranalyse | Budgetleitplanken und Providerentscheidung |
| `fam-agent-umsetzung-best-practices-september-2026.md` und `report-source.md` | Identischer, quellenbasierter Umsetzungsbericht | Primäre fachliche Grundlage für Erfassung, Datenmodell, Human in the Loop und Einführung |

Die doppelten Dateien erhöhen die Evidenz nicht. Inhaltlich konvergieren die Quellen dennoch deutlich auf dieselben Grundsätze:

- AI nur bei unstrukturierter oder mehrdeutiger Eingabe;
- Datenbank statt Chatverlauf als Wahrheit;
- kleine, typisierte Tool- und Antwortverträge;
- Vorschlag vor Mutation;
- Lebensmittelsicherheit als harte Regelgrenze;
- billiges Modell als Standard, stärkeres Modell nur nach messbarer Eskalation;
- kurze Kontexte, kurze Ausgaben, begrenzte Tool-Runden;
- keine Multi-Agent-Plattform, freie Websuche, Vollgedächtnis oder Vector-DB im MVP;
- Erfolg nach erledigter Nutzeraufgabe und vermiedener Verschwendung messen, nicht nach Demo-Effekt.

Die Synthese übernimmt diese Gemeinsamkeiten, löst aber drei Punkte projektspezifisch strenger auf:

1. **Keine AI-Schreibtools in V1.** Ein bestätigter Vorschlag wird auf dem Gerät durch die bestehende Domänenmutation und Outbox ausgeführt.
2. **Kein vollständiges Event Sourcing.** `fridge_items` bleibt der operative Snapshot. Ein schmales Audit- und Ereignismodell ergänzt ihn, statt alle Reads aus Events neu aufzubauen.
3. **Kein generischer Provider-Layer auf Vorrat.** Stabile, aufgabenbezogene AI-Verträge werden von Provider-SDKs getrennt. Ein zweiter Runtime-Provider wird erst ergänzt, wenn Evals einen realen Nutzen zeigen.

## 1a. Vorbedingung: bestehende Eval-Plattform nutzen

Bevor ein produktiver AI-Workflow in fam entsteht, werden Prompts und Abläufe reproduzierbar evaluiert. Dafür bauen wir kein eigenes Testlabor mit eigener UI, Run-Datenbank oder eigenem Evaluations-Runner. Als Kern verwenden wir die bestehende Open-Source-Plattform **Promptfoo**, die lokale CLI-/Library-Ausführung, mehrere Provider, eigene Provider, Assertions, Red-Teaming und CI unterstützt. [Promptfoo-Dokumentation](https://www.promptfoo.dev/docs/intro/)

Wir entwickeln nur einen kleinen fam-spezifischen Adapter. Das ist Testcode für unsere Domäne, kein zweites Produkt.

Die Zuständigkeiten sind fest getrennt:

| Werkzeug | Zuständigkeit | Darf nicht werden |
| --- | --- | --- |
| `tools/category-debugger` | Produktsuche, OFF-Daten, Einkaufslisten-Klassifikation und Kategorie-Evals | generischer Prompt- oder Agent-Runner |
| `C:\GIT\fam\tools\llm-test-platform` mit Promptfoo | Prompts, AI-Workflows, Tool-Verträge, Safety, Provider- und Regressionstests | eigener Plattformdienst oder Produktiv-Backend |
| ChainForge im Eval-Workspace | optionale manuelle Exploration einzelner Modelle | autoritative Ergebnis- oder Versionsablage |
| `src/` und `supabase/` der App | produktive Domäne und bestätigte Nutzeraktionen | unkontrollierte AI-Experimente |

### Zielbild der bestehenden Plattform mit fam-Adapter

```text
versionierte Promptfoo-Fixtures und Prompts
              │
              ▼
        Promptfoo Runner
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
   Provider  Tool-   Fault-
   Adapter   Sandbox  Injection
      │       │        │
      └───────┼────────┘
              ▼
       kanonische Outputs
              │
      ┌───────┼───────────────┐
      ▼       ▼               ▼
   Schema   Safety-/       Trajectory-
   Grader   Policy-Grader  und Cost-Grader
              │
              ▼
       Promptfoo-Run + Export
              │
       lokale UI, CI-Gate, optional Langfuse/Braintrust
```

Der Adapter muss mindestens sechs Dinge reproduzierbar machen:

1. denselben Fall mit exakt demselben Prompt gegen mehrere Modelle ausführen;
2. einen kompletten Workflow inklusive simulierten Tool-Ergebnissen abspielen;
3. Fehler injizieren: Timeout, leeres Ergebnis, Schemafehler, Rate Limit und unerlaubte Tenant-ID;
4. strukturierte Outputs, Safety-Entscheidungen und Tool-Trajektorien automatisch bewerten;
5. Kosten, Tokenverbrauch, Latenz, Retries und Modellversion pro Run einfrieren;
6. eine Regression gegen eine akzeptierte Baseline als CI-Gate sichtbar machen.

### Abgrenzung zum Category Lab und zu Observability-Tools

Das Category Lab bleibt die spezialisierte Produktsuche-Evaluation. Der Eval-Workspace übernimmt dort nur Konzepte wie blinde Reviews, Calibration/Holdout-Splits, Run-Snapshots, Metriken, JSON-Export und die Regel „kein automatisches Lernen aus Rohsignalen“. Er übernimmt weder dessen Produktdatenmodell noch dessen Supabase-Instanz und erweitert nicht dessen UI um einen Universal-Agenten.

Langfuse oder Braintrust sind mögliche spätere Layer für persistente Traces und Team-Experimente. Beide unterstützen versionierte Datensätze und vergleichbare Experimente, aber sie sind für den ersten lokalen Regressionstest nicht erforderlich. [Langfuse-Datasets](https://github.com/langfuse/langfuse-docs/blob/main/content/docs/evaluation/experiments/datasets.mdx), [Braintrust-Experimente](https://www.braintrust.dev/docs/evaluate/run-evaluations)

### Testfallvertrag

Testfälle liegen versioniert und ohne Produktionsgeheimnisse in `C:\GIT\fam\tools\llm-test-platform`. Ein Fall beschreibt nicht nur einen Prompt, sondern den erwarteten Vertrag:

```yaml
id: inventory-capture-ambiguous-001
workflow: capture_inventory_text
input:
  text: "Noch etwas Spinat und eine halbe Packung Feta"
  locale: de-DE
assertions:
  schema: inventory-capture-proposal.v1
  safety:
    decision: review_required
  sideEffects:
    writes: 0
tags: [vision, date, ambiguity, safety]
```

Ein Testfall darf niemals die echte Haushaltsdatenbank verändern. Ein eigener Promptfoo-Provider ruft entweder einen reinen Workflow-Adapter oder eine deterministische Tool-Sandbox auf. Jeder Run erhält einen `run_id`, einen Prompt-/Schema-Fingerprint und einen unveränderlichen Input-Snapshot.

### Grader und Freigabegate

Bewertet werden Schema, Fakten, Safety/Policy, Tool-Trajektorie, UX und Kosten getrennt. Es gibt bewusst keine einzelne magische Gesamtnote. Safety, Tenant-Isolation und unerlaubte Writes sind harte Gates; weiche Qualitätswerte werden zusätzlich für den Vergleich verwendet.

Ein Workflow darf erst in `supabase/functions` oder die App übernommen werden, wenn Promptfoo keine Cross-Household-Zugriffe oder unerlaubten Writes findet, Holdout-Safetyfälle besteht, Regressionen erklärt, Kosten und Latenz im Budget hält und einen funktionierenden manuellen Fallback nachweist.

Die tatsächliche Reihenfolge lautet:

```text
Promptfoo + fam-Adapter → geprüfte Workflow-Verträge → produktiver Gateway-Workflow → App-Integration
```

## 2. Die Architektur in einem Bild

```text
┌──────────────────────────────── MOBILE TRUST DOMAIN ────────────────────────────────┐
│                                                                                     │
│  Expo UI                                                                            │
│    ├─ Barcode, Text, Etikettfoto, Beleg                                              │
│    ├─ Review und Korrektur                                                           │
│    └─ explizite Bestätigung                                                         │
│            │                                                                        │
│            ├──────── normale Nutzeraktion ────────┐                                 │
│            │                                       ▼                                 │
│            │                              SQLite Domain Mutation                     │
│            │                                       │                                 │
│            │                                       ▼                                 │
│            │                                  Outbox Sync                            │
│            │                                                                         │
│            └──────── Assistenzanfrage, online ─────────────────────────────┐          │
└────────────────────────────────────────────────────────────────────────────┼──────────┘
                                                                             │ JWT
                                                                             ▼
┌──────────────────────────────── SERVER TRUST DOMAIN ────────────────────────────────┐
│                                                                                     │
│  Supabase Edge Function: AI Gateway                                                 │
│    ├─ Auth, Rate Limit, Größenlimit, Feature-Gate                                    │
│    ├─ Workflow Router, überwiegend deterministisch                                   │
│    ├─ user-scoped Supabase Client                                                    │
│    ├─ Context Builder mit Daten-Firewall                                             │
│    ├─ Food-Safety- und Policy-Engine                                                 │
│    ├─ Model Router mit höchstens einer Eskalation                                    │
│    ├─ Schema- und Fachvalidierung                                                     │
│    └─ strukturierter Vorschlag                                                       │
│             │                         │                         │                     │
│             ▼                         ▼                         ▼                     │
│       Supabase/Postgres          AI Provider              kurzlebiger                │
│       RLS Source of Truth        Text und Vision           Bildspeicher              │
│                                                                                     │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        │ bestätigte Outbox-Mutation
                                        ▼
                              RLS-validierter gemeinsamer Zustand
```

Zwei Datenflüsse bleiben bewusst getrennt:

- **Assistenzfluss:** Gerät → Gateway → geprüfter Vorschlag → Review.
- **Mutationsfluss:** Review → lokale Domänenmutation → Outbox → RLS → Supabase.

Das Modell befindet sich nur im Assistenzfluss. Es erhält keinen Pfad, auf dem es selbständig den gemeinsamen Zustand verändern kann.

## 3. Die sechs Architekturschichten

### 3.1 Experience Layer: kurze, definierte Erfassungsmomente

Der wichtigste UX-Grundsatz aus Winnow, Orbisk, MyFitnessPal Meal Scan und FoodImage lautet nicht „mehr Vision“, sondern **ein klarer Erfassungsmoment mit schneller Korrektur**.

fam unterstützt deshalb keine diffuse Dauerbeobachtung des Haushalts. Gute Trigger sind:

- der Einkauf wurde abgeschlossen;
- ein Produkt wird einzeln hinzugefügt;
- ein Produkt wird geöffnet;
- etwas wurde verbraucht oder weggeworfen;
- der Nutzer fragt nach einer Mahlzeit;
- ein Artikel soll vor einer Abwesenheit priorisiert werden.

Jeder Flow hat einen eigenen, begrenzten Vertrag. Der Chat ist eine Oberfläche über diese Flows, kein alternativer Systemkern.

### 3.2 Local Domain Layer: normale Software bleibt der Hauptweg

Die bestehende fam-Architektur ist bereits der richtige Kern:

- SQLite ist der lokale Read- und Write-Pfad;
- React Query liest den lokalen Zustand;
- Domänenmutationen aktualisieren SQLite;
- die Outbox synchronisiert Änderungen;
- Soft Deletes erhalten Offline-Parität;
- Supabase Realtime und Pull aktualisieren andere Geräte.

AI muss sich diesem System unterordnen. Bei „Vorschlag übernehmen“ ruft die UI keine AI-Funktion zum Schreiben auf. Sie übersetzt den validierten Vorschlag in dieselbe Mutation, die auch ein manuell ausgefülltes Formular verwendet.

Das bringt fünf Eigenschaften ohne zusätzliche Spezialarchitektur:

- optimistische und offlinefähige Bedienung;
- vorhandene Idempotency- und Retry-Mechanismen;
- dieselben Rückgängig- und Gegenaktionen;
- dieselbe Sync-Telemetrie;
- dieselbe RLS-Prüfung beim Server-Push.

AI-Funktionen degradieren offline sauber:

- Bestand, Einkaufsliste, Ablaufansicht, lokale Priorisierung und Erinnerungen bleiben nutzbar;
- noch nicht gesendete Fotos oder Texte können als lokaler Entwurf erhalten bleiben;
- eine AI-Auswertung zeigt klar „online erforderlich“ und blockiert keine normale manuelle Erfassung;
- ein AI-Fehler darf nie eine lokale Nutzeraktion unbrauchbar machen.

### 3.3 Data Authority Layer: Snapshot plus schmales Audit

Die Research-Dokumente empfehlen Produkt-Lose und Ereignisse. fam besitzt bereits `fridge_items`. Die kleinste korrekte Weiterentwicklung ist:

> Jede `fridge_items`-Zeile wird fachlich als konkretes Bestandslos verstanden, auch wenn der Tabellenname vorerst bleibt.

Mehrere Zeilen desselben Produkts sind korrekt, wenn Kaufzeitpunkt, Lagerort, Öffnungszustand oder Datum unterschiedlich sind. Ein globales `product` bleibt nur Stammdatenanreicherung und ist nie mit einem konkreten Bestandslos identisch.

#### Operativer Zustand

`fridge_items` bleibt der schnell lesbare, lokal gespiegelte operative Zustand. Langfristig benötigt ein belastbares Los mindestens:

- Produktbezug und Namenssnapshot;
- Menge, Einheit und optional Packungsgröße;
- Lagerort;
- `acquired_at` und optional `opened_at`;
- `date_type`: `use_by`, `best_before`, `none`, `unknown`;
- `date_value`;
- `date_source`: `printed_on_package`, `receipt`, `user_entered`, `rule_estimate`, `unknown`;
- Feldkonfidenz für maschinell extrahierte Werte;
- `last_confirmed_at`;
- Status beziehungsweise bestehender Tombstone.

#### Audit statt vollständigem Event Sourcing

Eine append-only `inventory_events`-Historie dokumentiert fachlich wichtige Aktionen wie:

- `added`;
- `quantity_changed`;
- `opened`;
- `moved`;
- `consumed`;
- `discarded`;
- `corrected`;
- `restored`.

Sie enthält mindestens Akteur, Client-Zeit, Server-Zeit, Idempotency-Key, Quelle und relevante Vorher-/Nachherwerte. Der operative Bestand wird trotzdem direkt aus `fridge_items` gelesen. Damit entstehen Nachvollziehbarkeit und Wirkungsmessung ohne die Komplexität eines Event-Sourcing-Systems.

#### Beobachtung und Vorschlag

AI-spezifische Daten werden getrennt:

```text
capture_observation
  id, household_id, created_by, kind, media_ref, status, expires_at

extraction_candidate
  observation_id, field, value, confidence, evidence_ref, schema_version

assistant_proposal
  id, observation_id, proposal_type, payload, status,
  prompt_version, model_version, created_at, expires_at

assistant_feedback
  proposal_id, accepted, corrected_fields, failure_reason
```

Diese Tabellen sind keine zweite Inventarwahrheit. Sie dienen Review, Retry, Evaluation und kurzer Wiederaufnahme eines Flows. Erst eine bestätigte lokale Domänenmutation verändert `fridge_items`.

Rohbilder haben eine kurze, dokumentierte Aufbewahrung und werden getrennt von extrahierten Feldern behandelt. Ein Bild darf nicht allein deshalb dauerhaft gespeichert bleiben, weil aus ihm ein Bestandseintrag entstanden ist.

### 3.4 Deterministic Decision Layer: Regeln vor Modellen

Diese Schicht entscheidet alles, was mit normalem Code zuverlässig ausdrückbar ist:

| Aufgabe | Autorität |
| --- | --- |
| Haushaltmitgliedschaft und Datenzugriff | Supabase RLS |
| Bestandsmenge und Einheiten | Domänenlogik und DB-Constraints |
| Tage bis Datum | deterministische Datumslogik |
| „zuerst verwenden“-Sortierung | versionierte Score-Funktion |
| `use_by` gegen `best_before` | Food-Safety-Policy |
| harte Allergie- und Ernährungsregeln | strukturierte Filter und Validatoren |
| Barcode-Erkennung | Kamera-Scanner |
| Produktauflösung | lokaler Katalog, eigener Produktspiegel, OFF als externe Quelle |
| Reminder-Planung und Ruhezeiten | deterministischer Scheduler |
| Schreibberechtigung | RLS und Mutationsvertrag |
| Idempotency und Retry | Outbox und Backend |

Der LLM-Kontext enthält die Ergebnisse dieser Regeln, nicht die Aufgabe, sie erneut zu erfinden. Statt 300 Bestandszeilen und der Anweisung „finde Dringendes“ erhält das Modell beispielsweise fünf vorgefilterte, priorisierte Lose mit maschinenlesbarem Grund.

#### Food Safety als nicht überschreibbare Policy

Lebensmittelsicherheit ist eine eigene Policy-Domäne mit einem engen Ergebnisvertrag:

```ts
type FoodSafetyDecision =
  | { kind: 'block_consumption_advice'; reasonCode: string; sourceIds: string[] }
  | { kind: 'quality_guidance_allowed'; caveats: string[]; sourceIds: string[] }
  | { kind: 'insufficient_evidence'; requiredEvidence: string[] };
```

Das Modell darf eine solche Entscheidung verständlich formulieren. Es darf `kind`, `reasonCode` oder die zugrunde liegende Regel nicht überschreiben.

Beispiele:

- abgelaufenes Verbrauchsdatum: kein kreativer Override;
- unbekannte Kühlkette bei Risikoprodukten: unzureichende Evidenz;
- Mindesthaltbarkeitsdatum: qualitätsbezogene Orientierung ist möglich, aber keine pauschale Sicherheitsgarantie;
- schlecht lesbares Datum: Rückfrage oder neues Foto statt Schätzung als Fakt.

### 3.5 Intelligence Layer: ein Orchestrator, wenige Fähigkeiten

Der „Agent“ ist normaler, testbarer TypeScript-Code im Backend. Er besteht aus:

1. Anfragevalidierung;
2. deterministischem Workflow-Routing;
3. Context Builder;
4. optionalem Modellaufruf;
5. optional einer begrenzten Read-Tool-Runde;
6. Schema- und Fachvalidierung;
7. Rückgabe eines Vorschlags.

Es gibt keine Agenten, die untereinander delegieren. Es gibt keine offene Schleife. Für einen normalen Turn gilt:

```text
Ziel:       1 Modellaufruf
Maximum:    2 Modellaufrufe durch genau eine kontrollierte Eskalation
Toolrunde:  0 oder 1
Retries:    höchstens 1 für klar klassifizierte transiente Fehler
Writes:     0
```

#### Workflows statt eines universellen Prompts

Die erste sinnvolle Menge ist klein:

1. `extract_inventory_text`
2. `scan_product_label`
3. `suggest_meals_for_priority_items`
4. `explain_use_priority`
5. `import_receipt`, erst in einer späteren Phase
6. `identify_visible_items`, nur als spätere Kühlschrankfoto-Hilfe

Jeder Workflow hat:

- ein eigenes Input-Schema;
- eine feste Kontextprojektion;
- eine erlaubte Read-Tool-Liste;
- ein Output-Schema;
- fachliche Validatoren;
- eine Eval-Suite;
- ein Kosten- und Latenzbudget.

#### Kleine Read-Tools

In V1 erhält das Modell ausschließlich lesende Fähigkeiten. Beispiele:

```text
read_priority_inventory
search_inventory
search_recipes
read_household_food_preferences
read_food_safety_rule
read_product_candidates
```

Tenant-IDs gehören nicht in Modellargumente. `household_id` und `user_id` werden vom authentifizierten Gateway gebunden. Das Modell kann weder einen anderen Haushalt wählen noch eine Service-Role anfordern.

Ein Tool-Ergebnis ist Datenmaterial, keine Instruktion. Text aus Open Food Facts, Rezepten, OCR oder Nutzereingaben wird als untrusted markiert und kann keine Toolrechte oder Systemregeln verändern.

#### Structured Outputs als Systemgrenze

Alle maschinenverarbeiteten Ausgaben verwenden ein versioniertes Schema. Ein Extraktionsergebnis enthält nicht nur einen Gesamt-Score, sondern Evidenz und Konfidenz pro Feld:

```json
{
  "schemaVersion": 1,
  "items": [
    {
      "name": {
        "value": "Mozzarella",
        "confidence": 0.97,
        "evidence": "label_text"
      },
      "quantity": {
        "value": 1,
        "unit": "package",
        "confidence": 0.91
      },
      "date": {
        "type": "best_before",
        "value": "2026-09-04",
        "confidence": 0.62,
        "evidence": "image_region:date-1"
      }
    }
  ],
  "needsReview": true
}
```

Schema-Konformität allein reicht nicht. Nach dem Modell folgen fachliche Prüfungen, zum Beispiel erlaubte Einheiten, realistische Mengen, ISO-Datum, Datumsart, Produktkandidat, Duplikatverdacht und Berechtigung.

#### Model Routing ohne Router-Theater

Das UI und der Endpoint kennen den Workflow meistens bereits. Deshalb wird nicht für jede Anfrage ein zusätzlicher Modell-Call als Klassifikator bezahlt.

```text
Tier 0: kein Modell
  Datumsberechnung, Barcode, Sortierung, Filter, Reminder, Mutation

Tier 1: günstiges multimodales Standardmodell
  Extraktion, kurze Erklärungen, einfache Rezeptvorschläge, Etikettfoto

Tier 2: starkes Fallbackmodell
  nur bei messbarer Mehrdeutigkeit, Schemafehler oder komplexer Planung
```

Eine Eskalation ist erlaubt, wenn ein versionierter, beobachtbarer Grund vorliegt. Beispiele sind niedrige Feldkonfidenz, widersprüchliche Datumswerte oder eine komplexe Planung mit mehreren harten Bedingungen. „Das stärkere Modell klingt besser“ ist kein Routing-Kriterium.

Die Providergrenze liegt auf Aufgabenniveau:

```ts
interface InventoryTextExtractor {
  extract(input: InventoryTextInput): Promise<InventoryExtraction>;
}

interface ProductLabelAnalyzer {
  analyze(input: ProductLabelInput): Promise<ProductLabelExtraction>;
}

interface MealSuggestionGenerator {
  suggest(input: MealSuggestionInput): Promise<MealSuggestions>;
}
```

Provider-SDK-Typen verlassen den Adapter nicht. Eine universelle `AIProvider.runAgent()`-Abstraktion wird vermieden, weil sie unterschiedliche Fähigkeiten nur scheinbar vereinheitlicht.

#### Kontext ist eine Sicherheitsgrenze

Der Context Builder ist kein Prompt-Helfer, sondern ein Policy Enforcement Point.

Er darf für den Haushaltsassistenten ausschließlich freigeben:

- den aktiven, aus Auth und RLS abgeleiteten Haushalt;
- die für den Workflow erforderlichen Bestandslose;
- explizit geteilte Haushaltspräferenzen;
- passende, strukturierte Rezeptkandidaten;
- versionierte Safety-Regeln;
- wenige aktuelle Nachrichten dieses Flows.

Er darf nicht freigeben:

- private Kalorien-, Gewichts-, Medikamenten-, Fasten-, Vital- oder Workoutdaten;
- Daten anderer Haushalte;
- vollständige Chatarchive;
- vollständige Inventare, wenn eine kleine Projektion reicht;
- personenbezogene Klardaten, wenn pseudonyme IDs genügen;
- rohe externe Inhalte als Systeminstruktionen.

Ein späterer privater Ernährungsassistent wäre ein eigener Trust Domain mit eigener Route, eigenen Tools, eigener Einwilligung und eigener RLS-Projektion. Er darf nicht durch einen größeren Prompt in den Haushaltsassistenten „hineinwachsen“.

### 3.6 Control Plane: Kosten, Evals und Betrieb

Die Control Plane entscheidet nicht über Haushaltszustand. Sie macht die AI-Schicht messbar, begrenzt und austauschbar.

Pro Run werden ohne unnötigen Rohdateninhalt erfasst:

```text
trace_id
feature und workflow_version
prompt_version und schema_version
provider und model
input_tokens, cached_tokens, output_tokens
estimated_cost_usd
latency_ms
tool_names und tool_rounds
validation_result
proposal_status
corrected_field_names
safety_decision_code
```

Nicht standardmäßig geloggt werden vollständige Prompts, Bilder, Chattexte oder private Bestandsinhalte. Debug-Sampling braucht eine eigene, zeitlich begrenzte und zugriffsgeschützte Freigabe.

Wichtige Systemgrenzen:

- maximales Input- und Outputbudget pro Workflow;
- maximales Bildformat und Auflösung;
- Rate Limit pro Nutzer und Haushalt;
- monatliches Featurebudget;
- globaler Kosten-Circuit-Breaker;
- maximal eine Model-Eskalation;
- maximal ein Retry;
- Abschaltmöglichkeit pro Workflow und Modell;
- Fallback auf normale manuelle Bedienung.

Prompt Caching wird für stabile Systemregeln und Schemas genutzt. Der statische Präfix bleibt stabil, dynamische Haushaltsdaten folgen danach. Batch-Verarbeitung gehört nur zu nicht-interaktiven Aufgaben wie Evals, Kataloganreicherung oder vorbereiteter globaler Inhaltsanalyse. Ablaufpriorisierung selbst bleibt eine SQL- beziehungsweise TypeScript-Aufgabe und benötigt keinen nächtlichen LLM-Job.

## 4. Referenzabläufe

### 4.1 Barcode und einzelnes Produkt (aktuell vertagt)

```text
Kamera scannt EAN lokal
  ↓
lokaler Produktkatalog
  ├─ Treffer: Kandidat anzeigen
  └─ kein Treffer: serverseitiger OFF-Lookup über bestehenden Produktspiegel
  ↓
Menge, Lagerort und individuelles Datum ergänzen
  ↓
Nutzer bestätigt
  ↓
lokale `fridge_items`-Mutation + Outbox
```

Hier ist kein LLM nötig. Ein optionales Etikettfoto darf separat Produktname, Datum und Lagerhinweis extrahieren. Der Barcode bleibt die stärkere Identitätsevidenz, das Foto die Evidenz für packungsindividuelle Felder.

### 4.2 Natürlichsprachliche Erfassung

```text
„Noch zwei Paprika, eine halbe Packung Feta und etwas Spinat“
  ↓
Gateway mit `extract_inventory_text`
  ↓
strukturierte Kandidaten mit Feldkonfidenz
  ↓
lokaler Katalog normalisiert Namen und zeigt mögliche Matches
  ↓
Review: fehlende Menge, Einheit, Lagerort oder Datum ergänzen
  ↓
explizite Bestätigung
  ↓
lokale Transaktion + Outbox
```

„Etwas Spinat“ bleibt unbekannte Menge. Die AI darf daraus nicht stillschweigend `200 g` machen.

### 4.3 Einzelnes Etikettfoto (aktuell vertagt)

```text
lokale Qualitätsprüfung und Zuschnitt
  ↓
EXIF entfernen, Größenlimit anwenden
  ↓
kurzlebiger Upload
  ↓
OCR/Vision extrahiert getrennt:
Produkt | Marke | Datum | Datumsart | Lagerhinweis
  ↓
Schema- und Plausibilitätsprüfung
  ↓
Review mit Hervorhebung unsicherer Felder
  ↓
Bildablauf/Löschung nach definierter Frist
```

Bei niedriger Datumskonfidenz wird gezielt ein engeres Foto nachgefordert. Ein stärkeres Modell wird nur dann versucht, wenn das günstiger ist als ein Nutzer-Retry und die Eval-Daten den Vorteil bestätigen.

### 4.4 „Was kann ich heute kochen?“

```text
User-Trigger erkennt nur die Kochabsicht und optionale Einschränkungen
  ↓
Gateway liest verderbliche Bestandslose direkt aus dem autorisierten Inventar
  ↓
deterministische Priorisierung der Bestandslose
  ↓
harte Filter: Allergien, Ernährungsform, Zeit, Portionen
  ↓
strukturierte Suche in eigener Rezeptbasis
  ↓
Top-K Kandidaten und wenige relevante Bestandslose
  ↓
Standardmodell rankt oder formuliert 1 bis 3 Vorschläge
  ↓
Post-Validation prüft harte Bedingungen erneut
  ↓
UI zeigt verwendete Lots, fehlende Zutaten und Begründung
```

Der Nutzer löst den Ablauf aus, aber er liefert nicht die Zutatenwahrheit. Das
Modell erhält die verderblichen Bestandslose aus dem tenant-scoped Inventory-Read;
eine Zutat darf nicht ausschließlich aus Freitext oder Modellannahme stammen.
Zusätzliche nicht verderbliche Bestände werden, falls nötig, ebenfalls nur
deterministisch aus dem Inventar ergänzt.

Die Rezeptbasis wird zuerst mit relationalen Filtern und vorhandener Suche erschlossen. pgvector oder andere Embeddings werden erst eingeführt, wenn ein Eval zeigt, dass semantischer Recall einen relevanten Nutzerfehler löst. Freie Websuche gehört nicht in diesen Standardpfad.

Die beiden derzeit relevanten Nutzerabläufe sind als umsetzungsnahe Agent-Skill-
Verträge in [fam-agent-skills.md](../../specs/fam-agent-skills.md) spezifiziert:
`fam-inventory-capture` für die assistierte Erfassung und
`fam-cook-from-inventory` für den read-only Rezeptvorschlag. Weitere Skills sind
bis zu einem neuen, explizit freigegebenen Scope ausgeschlossen.

### 4.5 Belegimport (aktuell vertagt)

Belegimport ist ein späterer, asynchroner Workflow:

```text
Belegfoto
  ↓
Qualitätsprüfung, Zuschnitt, OCR
  ↓
Zeilenkandidaten
  ↓
Produktmatching und Duplikatprüfung
  ↓
kompakte Mehrfach-Review
  ↓
eine lokale Transaktion für bestätigte Items
  ↓
Outbox mit stabilen Idempotency-Keys
```

Ein Beleg liefert Kaufkandidaten, keine individuellen Mindesthaltbarkeitsdaten. Pfand, Rabatte, Summenzeilen und Mengenmultiplikatoren werden als eigene Zeilentypen behandelt.

### 4.6 Kühlschrankfoto (aktuell vertagt)

Ein Kühlschrankfoto bleibt eine assistierte Suche:

- es erzeugt sichtbare Produktkandidaten;
- es kann verdeckte, doppelte oder geöffnete Produkte nicht zuverlässig zählen;
- es kennt individuelle Datumswerte in der Regel nicht;
- es verändert nie automatisch den Bestand;
- es wird erst ausgerollt, wenn Einzelprodukt- und Belegflows messbar stabil sind.

Das richtige Versprechen lautet „Ich helfe dir, sichtbare Dinge schneller zu finden“, nicht „Ich inventarisiere deinen Kühlschrank“.

## 5. Autorisierung, Datenschutz und Prompt-Injection-Schutz

### 5.1 RLS bleibt die Autorität

Das Gateway validiert das Nutzer-JWT und erstellt für Haushaltsreads einen Supabase-Client im Nutzerkontext. Die Service Role wird nicht für frei zusammengesetzte Reads oder Writes auf Haushaltsdaten verwendet.

Falls eine serverseitige Operation privilegierten Zugriff benötigt, geschieht sie über eine enge, auditierbare RPC oder eine servereigene Tabelle. Sie erhält keine vom Modell gewählte Tenant-ID.

Neue Tabellen erhalten explizite RLS-Policies und pgTAP-Tests. Synchronisierte neue Entitäten benötigen zusätzlich SQLite-Schema, Entity-Registry, Push, Pull, Realtime und Outbox-Parität.

### 5.2 Haushaltsdaten und Privatdaten bleiben getrennt

Die bestehende fam-Grenze wird nicht durch „Personalisierung“ aufgeweicht:

| Datenart | Haushaltsassistent |
| --- | --- |
| Bestand, Lagerorte, Einkaufsliste | erlaubt, RLS-gefiltert |
| geteilte Rezept- und Essensplanpräferenzen | erlaubt, wenn ausdrücklich geteilt |
| Kalorien- und Ernährungstagebuch | verboten |
| Gewicht und Ziele | verboten |
| Medikamente, Symptome, Fasten, Vitalwerte, Workouts | verboten |
| Daten eines anderen Haushalts | verboten |

Der Gateway-Context-Builder besitzt deshalb getrennte Query-Module statt einer generischen „lade Nutzerkontext“-Funktion.

### 5.3 Bilder und Retention

- Upload nur über kurzlebige, zweckgebundene Pfade;
- MIME-, Größen- und Dimensionsprüfung;
- EXIF-Entfernung vor Provider-Übertragung;
- getrennte TTL für Rohbild, Extraktion, Vorschlag und Telemetrie;
- keine Nutzung für Training ohne getrennte, informierte Einwilligung;
- Export- und Löschpfad für Haushaltsdaten;
- Providervertrag, Region und Retention vor Produktionsfreigabe prüfen.

### 5.4 Prompt Injection ist ein Berechtigungsproblem

Externe Inhalte werden nicht „sicher“, weil sie in JSON stehen. Schutz entsteht durch:

- minimale Read-Tool-Liste pro Workflow;
- keine AI-Schreibtools;
- servergebundene Identität und Haushalt;
- Trennung von Instruktionen und Daten;
- Entfernung oder Kennzeichnung fremder Instruktionsfragmente;
- Prüfung jedes Tool-Arguments gegen Nutzerintention und Workflow;
- feste Ergebnis-Schemas;
- fachliche Post-Validation;
- adversariale Evals mit OCR-, Rezept- und OFF-Inhalten;
- menschliche Bestätigung vor jeder Mutation.

## 6. Evals: Die eigentliche Providerentscheidung

Listenpreise bestimmen nicht die beste Architektur. Der richtige Maßstab ist **Kosten pro erfolgreich erledigter Aufgabe**.

Jeder Workflow erhält einen versionierten Eval-Korpus aus realen, anonymisierten oder synthetisch gleichwertigen Fällen.

### 6.1 Extraktion

- deutsche und mehrsprachige Produktnamen;
- Umgangssprache, Tippfehler und unvollständige Mengen;
- Einheiten und Packungsgrößen;
- gedruckte, geprägte und teilweise verdeckte Daten;
- deutsche Datumsformate und Mehrdeutigkeit;
- schlechte Beleuchtung und Spiegelung;
- identische Produkte in verschiedenen Größen.

Messwerte:

- Feldgenauigkeit statt nur Gesamtgenauigkeit;
- Top-1- und Top-3-Produktkandidat;
- korrekte Datumsart und korrekter Datumswert;
- Kalibrierung der Konfidenz;
- Zeit bis zur bestätigten Erfassung;
- Korrektur- und Abbruchquote.

### 6.2 Agent und Tools

- richtiger Workflow;
- richtige Toolwahl;
- keine Toolwahl bei ausreichendem Kontext;
- keine erfundenen IDs;
- Schema-Validität;
- Einhaltung von maximaler Toolrunde und Eskalation;
- Verhalten bei Timeout, Rate Limit und leerem Ergebnis;
- identische Antwort nach idempotentem Retry.

### 6.3 Safety und Security

- `use_by` gegen `best_before`;
- unbekannte Kühlkette;
- Risikoprodukte;
- harte Allergien und Präferenzen;
- Prompt Injection in OCR-Text, Rezept und Produktbeschreibung;
- Cross-Household-ID in Toolargumenten;
- Versuch, private Trackingdaten zu erfragen;
- unerlaubte Mutationsvorschläge;
- beschädigte oder übergroße Uploads.

### 6.4 Produktwirkung

Die wichtigsten KPIs sind:

- Anteil angenommener Vorschläge;
- Zeitersparnis gegenüber manueller Erfassung;
- Wochen mit ausreichend aktuellem Bestand;
- Zahl korrigierter oder rückgängig gemachter AI-Aktionen;
- genutzte „zuerst verwenden“-Vorschläge;
- als verbraucht statt weggeworfen markierte priorisierte Artikel;
- Benachrichtigungs-Abschaltquote;
- AI-Kosten pro bestätigtem Eintrag und pro erfolgreich gewählter Mahlzeit.

## 7. Kostenarchitektur

Die Research-Dokumente kommen trotz unterschiedlicher Annahmen zu derselben Größenordnung: Bei kurzen Kontexten und einem günstigen Standardmodell liegen normale Textinteraktionen im Bruchteil eines Cents. Das Kostenrisiko entsteht vor allem durch Systemverhalten.

### 7.1 Kostentreiber in Prioritätsreihenfolge

1. unnötige Agent-Loops;
2. vollständige Inventare und Chatverläufe im Prompt;
3. starkes Modell als Default;
4. hochauflösende Bilder ohne Vorverarbeitung;
5. freie Websuche;
6. unlimitierte Retries;
7. lange Ausgaben;
8. Logging und dauerhafte Bildspeicherung;
9. erst danach der reine Listenpreis eines kleinen Textturns.

### 7.2 Startbudgets

Diese Werte sind Engineering-Budgets, keine Produktversprechen:

| Kennzahl | Startziel |
| --- | ---: |
| Standardaufrufe pro AI-aktivem Nutzer und Monat | 30 bis 100 |
| dynamischer Input pro Turn | möglichst unter 2.500 Tokens |
| Output pro Turn | möglichst unter 300 bis 400 Tokens |
| Modellaufrufe pro Turn | 1, maximal 2 |
| Toolrunden | 0 bis 1 |
| Retry | 0, maximal 1 |
| Anteil starkes Fallbackmodell | unter 5 bis 10 Prozent |
| freie Websuche | nahe 0 |
| normale AI-Kosten pro aktivem Nutzer und Monat | Ziel unter 0,10 USD, anhand echter Nutzung prüfen |

Der erste Produktionsprovider wird über Evals, Datenschutzvertrag, Region, Retention, Latenz und Gesamtkosten gewählt. Die Quellen favorisieren zum Stichtag ein günstiges multimodales OpenAI-Modell mit stärkerem Fallback und sehen Gemini als wichtigste Gegenprobe. Diese Auswahl ist austauschbare Konfiguration, keine Domänenarchitektur.

## 8. Fehlerbilder und eingebaute Gegenmaßnahmen

| Fehlerbild | Ursache | Architektonische Gegenmaßnahme |
| --- | --- | --- |
| falscher Bestand nach Foto | Erkennung wurde als Fakt behandelt | Observation → Proposal → Review → normale Mutation |
| doppelte Artikel nach Retry | kein stabiler Idempotency-Key | IDs auf dem Client erzeugen, Outbox und Event-ID deduplizieren |
| anderes Haushaltsinventar sichtbar | Tenant-ID aus Modell oder Service-Role-Read | Nutzer-JWT, RLS, servergebundener Haushalt, keine Tenant-ID im Tool |
| private Trackingdaten im Prompt | generischer Nutzerkontext | getrennte Query-Module und Context-Firewall |
| gefährliche Haltbarkeitsaussage | LLM als Safety-Autorität | deterministische Safety-Entscheidung vor Formulierung |
| App unbrauchbar ohne Provider | AI im Kernworkflow | manuelle lokale Alternative bleibt immer vorhanden |
| explodierende Kosten | Tool-Loops, Bilder, Retries | harte Run-Budgets und Circuit-Breaker |
| Modellwechsel bricht UI | Provider-Response wird direkt gerendert | kanonische, versionierte Domänenschemas |
| schlechte Antworten trotz billigem Call | Preis statt Task Success optimiert | Eval pro erfolgreicher Aufgabe |
| Notification Fatigue | jede Priorität wird gepusht | deterministische Bündelung, Ruhezeiten, Snooze, Wirkungsmessung |
| externe Daten steuern den Agenten | Prompt Injection über OCR/OFF/Rezept | untrusted data, Read-only Tools, Intent-Bindung, Post-Validation |
| AI-Korrektur lernt falsche globale Wahrheit | Feedback wird ungeprüft übernommen | Feedback separat speichern, erst aggregiert und evaluiert in Regeln übernehmen |

## 9. Umsetzungslandkarte für das bestehende Repo

Die folgende Struktur ist eine Zielzuordnung, keine Aufforderung, alle Dateien sofort anzulegen:

```text
src/features/assistant/
  screens/             sichtbarer Assistent oder Review-Flows
  forms/               strukturierte Review- und Korrekturformulare
  components/          Proposal- und Evidenzdarstellung
  domain/              kanonische Schemas, Confidence, Review-Regeln
  hooks/               Requests und lokale Proposal-Zustände

src/features/inventory/
  domain/              Lot-, Datum-, Prioritäts- und Safety-Logik
  bestehende Mutations-Hooks bleiben Commit-Pfad

src/lib/db/
  schemas/             Spiegel nur für wirklich synchronisierte Entitäten
  entities.ts          Sync-Registrierung bei Schema-Erweiterung
  outbox.ts            unveränderter Mutationsmechanismus

supabase/functions/assistant/
  handler.ts           Auth, Limits und Workflow-Dispatch
  context/             RLS-gefilterte Projektionen pro Workflow
  workflows/           deterministische Orchestrierung
  providers/           aufgabenbezogene SDK-Adapter
  policies/            Safety, Tool- und Datenfreigabe
  telemetry/           redigierte Run-Metriken

supabase/schemas/
  deklarative Tabellen, Constraints, RLS und Indizes

supabase/tests/
  RLS-, Cross-Household-, Constraint- und Idempotency-Tests

test/assistant-evals/
  versionierte Fixtures, erwartete strukturierte Ergebnisse, Safety-Fälle
```

Wichtig ist die Verantwortungsgrenze:

- `assistant` interpretiert und schlägt vor;
- `inventory` validiert und mutiert;
- `db/outbox` synchronisiert;
- Supabase RLS autorisiert;
- `tracking` bleibt getrennt.

## 10. Einführung in fünf kontrollierten Phasen

### Phase 0: Verträge und Messbarkeit

Noch kein sichtbarer Universal-Chat.

- bestehende `fridge_items` fachlich als Lots festschreiben;
- Datumsart und Datumsquelle in der Domäne modellieren;
- deterministischen „zuerst verwenden“-Score bauen;
- Safety-Policy-Vertrag festlegen;
- Proposal-Schema und Review-Komponente definieren;
- Gateway-Grundgerüst mit Auth, Limits und Telemetrie;
- Eval-Korpus und Provider-Harness;
- Baseline gegen manuelle Erfassung messen.

**Exit-Kriterium:** Die Regeln, Verträge und Evals funktionieren ohne produktive AI-Autonomie.

### Phase 1: Nützlicher Read-only Assistent

- „Was sollte ich zuerst verwenden?“ aus deterministischer Priorisierung;
- „Koche etwas daraus“ mit vorhandenen Rezepten;
- ein günstiges Standardmodell;
- keine Schreibtools;
- kurze strukturierte Antworten;
- private Trackingdaten technisch ausgeschlossen.

**Exit-Kriterium:** Hohe Aufgaben-Erfolgsquote, niedrige Safety-Fehlerrate, messbare Nutzung und kontrollierte Kosten.

### Phase 2: Assistierte Erfassung

- natürlichsprachliche Mehrfacherfassung;
- einzelnes Produktetikett und Datumsfoto;
- Feldkonfidenz und Evidenz;
- kompakte Review;
- Bestätigung über lokale Inventory-Mutation und Outbox;
- Korrekturfeedback.

**Exit-Kriterium:** Erfassung ist schneller als manuell, ohne messbare Verschlechterung der Bestandsintegrität.

### Phase 3: Belegimport

- asynchroner Capture-Job;
- OCR-Zeilenmodell;
- Produktmatching und Duplikatprüfung;
- Mehrfach-Review;
- atomare lokale Übernahme;
- regionale Alias- und Mapping-Verbesserung aus geprüftem Feedback.

**Exit-Kriterium:** Nutzer können einen realen Einkauf mit deutlich weniger Interaktionen übernehmen und korrigieren Unsicherheiten zuverlässig.

### Phase 4: Begrenzte Vision-Erweiterung

- Serienaufnahme einzelner Produkte;
- Kühlschrankfoto nur als Kandidatensuche;
- automatische Vorbelegung nur für hochsichere, reversible Felder;
- jede Ausweitung hinter Eval- und Feature-Gate.

**Exit-Kriterium:** Reale Haushaltsfotos zeigen einen klaren Mehrwert gegenüber Barcode, Einzelproduktfoto und manueller Schnellerfassung.

## 11. Explizit angenommen, verworfen und vertagt

### Angenommen

- Inventory-System als Produktkern;
- SQLite und Outbox als normaler Commit-Pfad;
- Supabase und RLS als gemeinsame Autorität;
- deterministische Regeln vor AI;
- ein Orchestrator mit festen Workflows;
- Read-only Tools;
- Structured Outputs und fachliche Post-Validation;
- Human in the Loop für jede Mutation;
- günstiges Standardmodell plus genau ein kontrolliertes Fallback;
- kurze Bildretention und redigierte Telemetrie;
- Evals und Kostenmessung ab dem ersten produktiven Workflow.

### Verworfen

- LLM als Datenbank oder Langzeitgedächtnis;
- direkte SQL- oder Service-Role-Nutzung durch den Agenten;
- autonome Inventar-, Einkaufs-, Lösch- oder Benachrichtigungsaktionen;
- Multi-Agent-Orchestrierung;
- unbegrenzte Tool-Loops;
- Kühlschrankfoto als vollständiger Bestand;
- AI-Berechnung von MHD oder Sicherheitsfreigaben;
- freie Websuche im normalen Rezept- und Bestandsflow;
- vollständige Chatverläufe oder Inventare in jedem Prompt;
- ein UI, das Provider-Responses direkt versteht;
- vollständiges Event Sourcing.

### Vertagt bis Evals Bedarf zeigen

- pgvector und semantisches RAG;
- Fine-Tuning;
- mehrere produktive Provider gleichzeitig;
- Voice- oder Videoagent;
- allgemeiner Webzugriff;
- automatische Annahme hochsicherer Felder;
- Kühlschrank-Gesamterkennung;
- serverseitige AI-Mutationen;
- eigene komplexe Queue-Infrastruktur.

## 12. Definition of Done für einen AI-Workflow

Ein Workflow ist erst produktionsbereit, wenn alle Punkte erfüllt sind:

- [ ] Der nicht-AI-Fallback ist definiert.
- [ ] Input und Output haben versionierte Schemas.
- [ ] Haushalts- und Privatdatenprojektion ist explizit dokumentiert.
- [ ] Das Modell besitzt keine Schreibberechtigung.
- [ ] Fach- und Safety-Validatoren laufen nach der Modellausgabe.
- [ ] Review und Korrektur sind schneller als die manuelle Alternative oder liefern klaren Zusatznutzen.
- [ ] Bestätigte Änderungen nutzen die normale lokale Mutation und Outbox.
- [ ] RLS- und Cross-Household-Tests existieren.
- [ ] Offline-, Retry-, Duplikat- und Rückgängig-Verhalten sind geprüft.
- [ ] Prompt-Injection- und Safety-Fälle sind im Eval-Korpus.
- [ ] Kosten, Latenz, Schemafehler und Korrekturquote werden gemessen.
- [ ] Rohdatenretention, Export und Löschung sind definiert.
- [ ] Feature-, Modell- und Kosten-Circuit-Breaker existieren.
- [ ] Ein Rollback auf manuelle Bedienung ist ohne Datenmigration möglich.

## 13. Schlussfolgerung

Die Best-of-Breed-Architektur für fam ist absichtlich weniger „agentisch“ als viele Demo-Architekturen. Genau darin liegt ihre Stärke.

Sie nutzt AI an den wenigen Stellen, an denen klassische Software schwach ist: Sprache, Bilder, Mehrdeutigkeit und verständliche Formulierung. Sie nutzt normale Software überall dort, wo Korrektheit, Offline-Fähigkeit, Datenschutz und Wiederholbarkeit zählen. Sie zwingt jede maschinelle Vermutung durch einen strukturierten Vorschlags- und Review-Pfad und lässt die eigentliche Änderung anschließend durch die bereits bewährte fam-Domäne laufen.

So entsteht kein zweiter Systemkern. Es entsteht eine schmale Intelligence-Schicht über einem starken Produktkern:

```text
Beobachten → strukturieren → prüfen → vorschlagen → bestätigen → lokal mutieren → synchronisieren
```

Wenn diese Kette im Alltag schnell genug ist, hält der Haushalt seinen Bestand aktuell. Erst dann können Rezeptvorschläge, Priorisierung und Lebensmittelrettung zuverlässig wirken. Das ist die eigentliche Architekturentscheidung hinter allen Quellen.

## Quellenbasis

- [Umsetzungsanalyse](fam-agent-umsetzung-best-practices-september-2026.md)
- [AI-Kosten und Anbieterwahl](fam-ai-kosten-best-practices-sept-2026.md)
- [Research-Variante 1](research_1.md)
- [Research-Variante 2](research_2.md)
- [Research-Variante 3](research_3.md)
- [Research-Kurzfassung](research_4.md)

`report-source.md` ist inhaltlich identisch zur Umsetzungsanalyse. `research_5.md` ist inhaltlich identisch zur Research-Kurzfassung und wird daher nicht als zusätzliche unabhängige Quelle gezählt.
