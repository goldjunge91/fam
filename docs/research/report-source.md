# fam: Umsetzungsanalyse für einen AI-Agenten gegen Lebensmittelverschwendung

**Stand:** 1. September 2026  
**Zielgruppe:** Gründer, Product und Engineering  
**Scope:** Technologieumsetzung, Architektur, Integrationsmuster, reale Vorbilder, Fehlermuster, Datenschutz/Sicherheit und MVP-/Skalierungsplan.  
**Nicht Scope:** Auswahl des „besten“ Modells und ein Preisvergleich als zentrale Entscheidung.

## Kurzantwort

fam sollte nicht als autonomer AI-Agent gebaut werden, der den Haushalt selbständig „versteht“. Die robuste Umsetzung ist ein normales Inventory-System mit einer kleinen, kontrollierten AI-Schicht an den Stellen, an denen Eingaben unstrukturiert sind:

1. **Erfassung:** Barcode, Beleg, einzelnes Produktfoto, Sprache.
2. **Normalisierung:** Produkt und Menge gegen eine Produktdatenbank auflösen.
3. **Bestand:** Ein prüfbarer Bestand aus Produkt-Losen und Ereignissen ist die einzige Wahrheit.
4. **AI-Vorschlag:** AI schlägt erkannte Artikel, Datumswerte, Nutzungsideen oder Prioritäten vor.
5. **Validierung:** Serverregeln prüfen Schema, Benutzer-/Haushaltsrechte, Plausibilität und Sicherheitsgrenzen.
6. **Bestätigung:** Unsichere Bestandänderungen werden als Vorschlag angezeigt; erst danach wird gespeichert.
7. **Aktion:** Erinnerungen und Rezeptvorschläge werden deterministisch aus dem Bestand geplant.

Das wichtigste Produktprinzip lautet: **AI darf Vorschläge machen, aber niemals direkt die Inventar-Wahrheit oder Lebensmittelsicherheit festlegen.** Das ist zugleich der zentrale Unterschied zwischen einer brauchbaren App und einer beeindruckenden Demo.

## 1. Was andere tatsächlich gebaut haben

### Winnow: Automatisierung am eindeutig definierten Erfassungspunkt

Winnow löst kein allgemeines „Was ist in der Küche?“-Problem. In der kommerziellen Küche steht ein definierter Abfallbehälter mit Kamera und Waage. Das System erfasst, was hineingeworfen wird, ordnet es zu und verbindet Gewicht und Zeit mit Berichten. Wichtig ist die Produktstaffelung: tabletbasierte manuelle Erfassung, Kamera plus Waage und weitgehend automatische Vision-Erfassung. Für komplexe Kunden gibt es zusätzlich Setup, Validierung und Daten-Support. [Winnow: Produktvarianten und Hardware](https://www.winnowsolutions.com/product/food-waste-management-software) [Winnow: Ablauf der Messung](https://info.winnowsolutions.com/food-waste-management)

**Übertragbare Lehre für fam:** Ein fester, kurzer Erfassungsmoment funktioniert besser als der Versuch, den gesamten Haushalt permanent per Computer Vision zu inventarisieren. Für fam ist das eher „Einkauf angekommen“, „Produkt geöffnet“ oder „Artikel wird weggeworfen“ als ein periodischer Kühlschrank-Scan.

### Orbisk: Daten sammeln, dann konkrete Vorschläge zur Freigabe

Orbisk beschreibt einen Ablauf aus automatischer Erfassung, Musteranalyse, konkreten Handlungsvorschlägen, Annahme/Ablehnung und anschließendem Tracking der Ergebnisse. Der Vorschlag wird ausdrücklich nicht automatisch ausgeführt: „We suggest, you decide“. [Orbisk AI](https://orbisk.com/product/orbisk-ai/)

**Übertragbare Lehre für fam:** Die AI sollte „Du hast drei Tomaten, die bald genutzt werden sollten; diese zwei Gerichte passen“ vorschlagen. Sie sollte nicht selbständig Bestand löschen, Einkaufslisten ändern oder eine Sicherheitsentscheidung treffen.

### MyFitnessPal Meal Scan: Vision erzeugt Kandidaten, Nutzer bestätigt

MyFitnessPal nutzt Computer Vision für ein Kamerabild und schlägt erkannte Lebensmittel aus einer eigenen Datenbank vor. Der Nutzer wählt einen Vorschlag, passt die Portionsgröße an und fügt ihn anschließend zum Tagebuch hinzu. Das System behauptet also nicht, dass ein Foto automatisch eine endgültige, korrekte Datenbankbuchung ist. [MyFitnessPal Meal Scan FAQ](https://support.myfitnesspal.com/hc/en-us/articles/360045761612-Meal-Scan-FAQ)

**Übertragbare Lehre für fam:** Fotoerkennung sollte eine gute Kandidatenliste und eine schnelle Korrektur liefern. Ein einzelner „Übernehmen“-Button ist nur dann vertretbar, wenn Identität und Menge hinreichend sicher sind; sonst braucht es eine kompakte Review-Karte.

### FoodImage: Fotologging ist praktikabler als Tagebuch, aber braucht ein gutes Protokoll

In einer randomisierten Crossover-Studie wurde die FoodImage-App gegen Papier-Tagebücher verglichen. Die Teilnehmenden fotografierten Lebensmittel und Abfälle und ergänzten strukturierte Angaben wie Quelle, Menge, Ziel und Grund. Die Studie nutzte eine Referenzkarte im Bild, Training und eine nachgelagerte Kodierung der Fotos. FoodImage wurde von allen 24 Teilnehmenden bevorzugt und als weniger zeitaufwendig bewertet; gleichzeitig weisen die Autoren darauf hin, dass die Fotoauswertung durch Mitarbeitende zusätzliche Kosten verursacht und weitere Validierung in größeren, vielfältigeren Gruppen nötig ist. [PubMed-Zusammenfassung](https://pubmed.ncbi.nlm.nih.gov/32773964/) [Volltext/Methodik](https://pmc.ncbi.nlm.nih.gov/articles/PMC7409719/)

**Übertragbare Lehre für fam:** Die Bildaufnahme muss ein Protokoll haben: Was soll im Bild sein, welche Information fehlt, wie kann der Nutzer korrigieren? „AI erkennt alles aus jedem Kühlschrankfoto“ ist kein Protokoll. Außerdem braucht fam von Anfang an einen Korrektur- und Feedbackpfad.

### Haushalts-Apps und Studien: Der Dauerfehler ist manueller Aufwand

Eine kleine Crossover-Pilotstudie mit zwei Food-Waste-Apps berichtete, dass Teilnehmende zu viele manuelle Vorgänge als Hindernis für dauerhafte Nutzung empfanden. Eine weitere Studie mit automatischer Gewichtserfassung und Food-Management-Apps nennt Dateneingabe ausdrücklich als Problem für die langfristige Nutzung. Eine neuere Studie zur integrierten OCR-/Bildklassifikation beschreibt deshalb eine editierbare Erfassung: OCR-Datum bevorzugen, Werte vor dem Speichern editierbar machen und Schätzungen konservativ markieren. [JMIR-Pilotstudie](https://formative.jmir.org/2022/9/PDF) [Automatische Gewichtserfassung und Apps](https://www.mdpi.com/2071-1050/17/14/6392) [OCR-/Bildklassifikations-Workflow](https://www.mdpi.com/2571-5577/8/6/176)

**Übertragbare Lehre für fam:** Der Erfolgsmaßstab für AI ist nicht die Demo-Genauigkeit, sondern die Zahl der Wochen, in denen ein Haushalt den Bestand mit sehr wenig Reibung aktuell hält.

## 2. Die richtige technische Zerlegung

### 2.1 Erfassung ist nicht Bestand

Diese beiden Dinge müssen getrennt werden:

- **Observation:** „Auf dem Foto wurde vermutlich Milch erkannt.“
- **Inventory mutation:** „Ein neues Los Milch, Menge 1, wurde dem Haushalt hinzugefügt.“

Die AI erzeugt Observations und Vorschläge. Eine normale Backend-Funktion entscheidet, ob daraus eine Mutation wird. Dadurch lassen sich Fehler rückgängig machen, doppelte Einträge erkennen und jede Änderung erklären.

### 2.2 Empfohlener Datenfluss

```text
Mobile App
  ├─ Barcode / Foto / Beleg / Sprache
  ↓
Capture API ──> temporärer Bildspeicher + Job-ID
  ↓
Extraction Workflow
  ├─ Barcode-Lookup
  ├─ OCR für Text und Datumsfelder
  ├─ Vision für Produktkandidaten
  └─ normalisierte AI-Ausgabe nach festem Schema
  ↓
Review API ──> Nutzer bestätigt oder korrigiert
  ↓
Inventory Service ──> Postgres: Produkte, Lose, Ereignisse
  ↓
Deterministische Regeln
  ├─ FIFO-/MHD-Priorisierung
  ├─ Benachrichtigungen
  └─ Rezeptfilterung
  ↓
AI-Antwortschicht
  └─ formuliert Vorschläge aus bereits geprüften Fakten
```

### 2.3 KISS-Technologiebaukasten

Für ein MVP reicht:

- mobile App mit nativer Kamera, Barcode-Scanner und Push-Benachrichtigungen;
- ein kleines Backend mit REST/JSON oder tRPC;
- verwaltetes relationales SQL/Postgres für Haushalte, Produkte, Lose und Ereignisse;
- Object Storage für Bilder mit kurzer Ablaufzeit;
- eine Queue bzw. Worker für OCR/Vision-Aufgaben;
- ein einzelner AI-Orchestrator als normaler Backend-Code;
- strukturierte AI-Ausgaben mit JSON Schema;
- serverseitige Autorisierung pro Haushalt;
- Logging von Eingabe, Vorschlag, Nutzerkorrektur, Mutation und Ergebnis.

Nicht in das MVP gehören: Multi-Agent-System, eigener Vector-Store, autonome Web-Recherche, dauerhaftes Vollbild-Gedächtnis, Fine-Tuning, Kühlschrankkamera und automatische Lebensmittelsicherheitsentscheidungen.

Anthropic empfiehlt für viele Agentensysteme einfache, komposable Muster und zunächst direkte API-Aufrufe; komplexe Framework-Abstraktionen können Debugging erschweren. Die Empfehlung ist providerunabhängig sinnvoll: Erst die Schleife und die Datenverträge stabilisieren, dann bei echtem Bedarf ein Framework einführen. [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)

## 3. So sollte der „Agent“ technisch funktionieren

### 3.1 Ein Agent, mehrere deterministische Workflows

Der Nutzer darf eine natürliche Spracheingabe sehen, aber im Backend sollten zunächst feste Workflows existieren:

1. `add_inventory_item`
2. `import_receipt`
3. `scan_product_label`
4. `find_meals_for_expiring_items`
5. `mark_consumed_or_discarded`
6. `create_shopping_list_suggestion`

Der Agent routet zu einem Workflow und darf nur die dafür nötigen Tools sehen. Ein Rezeptgespräch braucht beispielsweise `read_inventory` und `search_recipes`, aber nicht `delete_inventory_item`.

### 3.2 Tool Calling ist ein Vertrag, kein Datenbankzugriff

Ein Tool sollte eine kleine, typisierte Funktion sein, etwa:

```json
{
  "name": "propose_inventory_item",
  "arguments": {
    "product_id": "…",
    "quantity": 1,
    "unit": "pack",
    "date_type": "best_before",
    "date": "2026-09-12",
    "confidence": 0.82,
    "source_observation_id": "…"
  }
}
```

Die App bzw. das Backend führt die Funktion aus; das Modell führt sie nicht selbst aus. OpenAI, Anthropic und Google dokumentieren dieses gleiche Grundmuster: Das Modell liefert einen strukturierten Funktionsaufruf, die Anwendung validiert und führt ihn aus, danach erhält das Modell das Tool-Ergebnis. [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling) [Anthropic Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) [Google Function Calling](https://ai.google.dev/gemini-api/docs/function-calling)

### 3.3 Structured Outputs an allen Systemgrenzen

Die AI darf keine freie Antwort liefern, wenn das Ergebnis in den Bestand fließt. Für Erkennung und Vorschläge werden Schemas mit Pflichtfeldern, Enums und Nullwerten verwendet. Ein Datum ist nicht „irgendwie“ Text, sondern entweder ein ISO-Datum, `unknown` oder eine Observation mit Unsicherheit. Structured Outputs verbessern die technische Validierbarkeit, ersetzen aber nicht fachliche Plausibilitätsregeln. [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) [Google Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)

## 4. Die konkreten Erfassungswege

### Barcode: schnellster Pfad, aber kein vollständiger Bestand

Ein Barcode identifiziert in der Regel das Produkt bzw. die Produktvariante. Er sagt nicht zuverlässig, welches konkrete Los im Haushalt liegt, wann es geöffnet wurde oder welches Datum auf genau dieser Packung steht. Open Food Facts bietet Barcode-Lookups, warnt aber selbst, dass die Daten freiwillig beigetragen werden und nicht vollständig oder zuverlässig garantiert sind. [Open Food Facts API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/) [Open Food Facts API-Hinweise](https://openfoodfacts.github.io/openfoodfacts-server/api/)

Implementierung:

1. Barcode lokal erkennen.
2. Produktdaten aus lokalem Cache bzw. API laden.
3. Fehlende oder widersprüchliche Felder als Review markieren.
4. MHD/Verbrauchsdatum separat über Foto oder Eingabe erfassen.
5. Nach Bestätigung ein neues `inventory_lot` anlegen.

### Beleg: gut für den Einkauf, schlecht für MHD und Menge

Ein Beleg kann gekaufte Produktkandidaten liefern, ist aber keine verlässliche Quelle für individuelle Haltbarkeit. Rabatte, Abkürzungen, Mehrfachmengen, Pfand, regionale Produktnamen und abgeschnittene Zeilen müssen behandelt werden.

Implementierung:

1. Bildqualität prüfen und Beleg zuschneiden.
2. OCR und Zeilenextraktion durchführen.
3. Jede Zeile gegen Produktkandidaten matchen.
4. Unsichere Zeilen in einer kompakten Liste bestätigen lassen.
5. Nicht versuchen, aus dem Preisbeleg ein exaktes MHD zu halluzinieren.

### Einzelnes Produktetikett: sinnvoller Vision-MVP

Ein Foto eines einzelnen Produkts mit sichtbarem Etikett ist deutlich kontrollierbarer als ein Kühlschrankbild. Die Pipeline sollte Produktname, Marke, Datumswert, Datumsart und relevante Lagerhinweise getrennt extrahieren. Das Datum muss mit einer Quellenangabe gespeichert werden: `printed_on_package`, `user_entered` oder `estimated_by_rule`.

Wenn kein Datum lesbar ist, darf die App eine Orientierung anbieten, aber keine exakte Sicherheit behaupten. Die aktuelle Forschung beschreibt genau diesen konservativen Fallback und weist darauf hin, dass Lagerbedingungen, Verpackungszustand und Produktformulierung die tatsächliche Haltbarkeit beeinflussen. [OCR-/Bildklassifikations-Workflow](https://www.mdpi.com/2571-5577/8/6/176)

### Kühlschrankfoto: später, nur als assistierte Suche

Ein Kühlschrankfoto ist als UX-Idee attraktiv, aber technisch ein schlechter Primärbestand: verdeckte Produkte, gleiche Verpackungen, variable Mengen, schlechte Beleuchtung und fehlende MHD-Information. Es eignet sich zunächst für „Welche Dinge sehe ich wahrscheinlich?“ und nicht für automatische Bestandsmutationen.

## 5. Datenmodell, das Fehler verkraftet

Die zentrale Entität ist nicht `food_item`, sondern ein **Produkt-Los**:

```text
households
members
products              -- kanonische Produkt-/Zutat-Identität
inventory_lots        -- konkrete Packung/Menge im Haushalt
inventory_events      -- add, consume, open, move, discard, correct
observations          -- Foto, Beleg, Barcode, Sprache, OCR/Vision-Ergebnis
suggestions           -- AI-Vorschlag mit Status pending/accepted/rejected
recipes               -- strukturierte Zutaten und Regeln
reminders             -- deterministisch erzeugte Benachrichtigungen
```

Wichtige Felder eines `inventory_lot`:

- `household_id`, `product_id`
- `quantity`, `unit`, optional `quantity_remaining`
- `storage_location`
- `acquired_at`, `opened_at`
- `date_type`: `use_by`, `best_before`, `none`, `unknown`
- `date_value`, `date_source`, `date_confidence`
- `status`: `active`, `consumed`, `discarded`, `unknown`
- `created_from_observation_id`
- `last_confirmed_at`

Jede Änderung wird als Event protokolliert und kann idempotent wiederholt werden. Dadurch werden doppelte Belegimporte, Retries von Worker-Jobs und versehentliche Mehrfachbuchungen beherrschbar.

## 6. Wo andere und typische AI-Produkte scheitern

| Fehlannahme | Praktischer Fehler | Gegenmaßnahme |
|---|---|---|
| „Ein Foto des Kühlschranks ist der Bestand“ | Identität, Menge und Datum sind nicht zuverlässig sichtbar. | Foto nur als Kandidatenliste; Bestandsänderung nach Review. |
| „Barcode-Scan erledigt den Eintrag“ | Datenbankabdeckung und Produktdaten sind regional/uneinheitlich; individuelles MHD fehlt. | Cache + Fallback auf Name/Foto + editierbare Felder. |
| „AI kann MHD/Sicherheit ableiten“ | `best before` und `use by` haben unterschiedliche Bedeutung; EU-Forschung berichtet generell geringe Verständlichkeit der Datumskennzeichnung. | Datumsart explizit speichern; keine Sicherheitsfreigabe durch AI; konservative Sprache. [EU-Kommission](https://food.ec.europa.eu/food-safety/food-waste/eu-actions-against-food-waste/date-marking-and-food-waste-prevention_en) |
| „Jede erkannte Zutat wird automatisch gespeichert“ | Halluzinierte oder doppelte Bestandseinträge zerstören das Vertrauen. | Vorschlag/Bestätigung, Plausibilitätsregeln, Audit-Log. |
| „Mehrere Agenten machen das intelligent“ | Mehr Kontextübergaben, mehr Fehlerstellen und schlechtere Nachvollziehbarkeit. | Ein Agent plus feste Workflows; erst mit Messdaten aufteilen. Anthropic empfiehlt einfache, komposable Muster. [Anthropic](https://www.anthropic.com/engineering/building-effective-agents) |
| „Erinnerungen sind automatisch hilfreich“ | Zu viele Benachrichtigungen führen zu Ignorieren oder Deaktivieren. | Priorisieren, bündeln, lernbare Ruhezeiten und eine einfache Snooze-/Erledigt-Interaktion. |
| „Externe Tool-Ergebnisse sind vertrauenswürdig“ | Produktfeeds oder Inhalte können fehlerhaft oder manipuliert sein und den Agenten beeinflussen. | Externe Daten als untrusted behandeln, nicht als Instruktion; nur erlaubte Felder übernehmen. [OWASP Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) |
| „Tool-Calling ist sicher, weil es JSON ist“ | Übermäßige Rechte oder autonome Mutationen können trotz gültigem JSON schädlich sein. | Least privilege, pro Tool Autorisierung, serverseitige Validierung, Bestätigung für Mutationen. [OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) |
| „Alle Bilder dauerhaft speichern“ | Unnötige private Haushaltsdaten, höhere Angriffs- und Löschlast. | Kurzlebige Rohbilder, extrahierte Daten getrennt speichern, Löschung und Export einbauen. |

## 7. Konkreter MVP-Plan

### Phase 0: Messbarer Prototyp

Noch kein autonomer Agent. Baue den vollständigen Erfassungskreislauf mit Testdaten:

- Barcode → Produktkandidat → Review → Lot;
- einzelnes Etikettfoto → Datumskandidat → Review → Lot;
- „verbraucht“ und „weggeworfen“ als One-tap-Events;
- einfache Prioritätenliste „zuerst verwenden“;
- vollständiger Korrektur- und Löschpfad.

Ziel: herausfinden, ob Nutzer den Bestand zwei bis vier Wochen aktuell halten.

### Phase 1: Assistierter Agent

- natürlicher Chat nur für Bestandsfragen und Rezeptideen;
- Tools zunächst `read_inventory`, `search_recipes`, `propose_inventory_change`;
- keine automatische Mutation ohne Bestätigung;
- strukturierte Rezeptantwort mit verwendeten Inventar-Lots;
- Push-Reminder nur aus deterministischen Regeln.

### Phase 2: Belegimport und bessere Rückkopplung

- Belegscan mit Zeilen-Review;
- Feedback „falsch erkannt“, „Menge falsch“, „Datum falsch“ als Produkttelemetrie;
- Alias-/Mapping-Tabelle für regionale Produktnamen;
- Wiederverwendung bestätigter Produktdaten, ohne alte Fehler blind zu kopieren.

### Phase 3: begrenzte Vision-Automatisierung

- Serienaufnahme einzelner Produkte;
- automatische Annahme nur für hochsichere, reversible Felder;
- Kühlschrankfoto lediglich als Such-/Vorschlagsfunktion;
- Evaluation mit echten Nutzerfotos vor jeder Ausweitung.

## 8. Evals und Betrieb

Vor dem Launch braucht fam einen festen Testkorpus aus echten, anonymisierten Fällen:

- gute/schlechte Beleuchtung;
- deutsche und mehrsprachige Verpackungen;
- gedrucktes, geprägtes und teilweise verdecktes Datum;
- gleiche Produkte in unterschiedlichen Größen;
- mehrere Produkte auf einem Beleg;
- geöffnete Produkte ohne neues gedrucktes Datum;
- Korrekturen, Wiederholungen und Offline-/Retry-Situationen.

Messwerte sollten getrennt werden:

1. Produktidentität: Top-1/Top-3-Kandidat und Bestätigungsrate.
2. Datum: korrekter Wert und korrekte Datumsart; nicht nur „irgendein Datum erkannt“.
3. Bestandsintegrität: doppelte Lots, falsche Mengen, unautorisierte Änderungen.
4. UX: Zeit bis zur bestätigten Erfassung, Abbruchrate, Korrekturquote.
5. Langzeitnutzen: aktive Wochen, erledigte Vorschläge, weniger weggeworfene erfasste Artikel.
6. Sicherheit: blockierte Tool-Aufrufe, Prompt-Injection-Tests, Datenzugriffsverletzungen.

Jede AI-Ausgabe sollte mit `trace_id`, Version des Prompts/Schemas, Observation, Tool-Aufrufen und Nutzerentscheidung nachvollziehbar sein. Rohbilder und sensible Chatdaten brauchen kürzere Aufbewahrungsfristen als aggregierte Produktstatistiken.

## 9. Datenschutz und Sicherheit

Für fam sind Haushaltsbestand, Einkaufsverhalten, Fotos und ggf. Familienmitglieder personenbezogene oder personenbeziehbare Daten. Die GDPR-Grundsätze verlangen Zweckbindung, Datenminimierung, Speicherbegrenzung, Integrität/Vertraulichkeit und Datenschutz durch Technikgestaltung. [EUR-Lex: GDPR Art. 5/25/32](https://eur-lex.europa.eu/eli/reg/2016/679/art_32/oj/eng)

Technische Mindestmaßnahmen:

- AI-Aufrufe ausschließlich über das Backend, nie mit Provider-Schlüssel in der App;
- Haushalt-ID und Mitgliedsrechte bei jedem Read/Write serverseitig prüfen;
- Bilder standardmäßig nach Extraktion löschen oder automatisch ablaufen lassen;
- getrennte Aufbewahrungsfristen für Rohbild, Extraktion, Chat und Telemetrie;
- Export und vollständige Löschung pro Haushalt;
- keine Trainingsnutzung eigener Daten ohne klare, getrennte Einwilligung;
- externe Produktdaten, Rezepttexte und Nutzerbilder als untrusted input behandeln;
- Tool-Liste minimal halten, schreibende Aktionen in `propose_*` und `commit_*` trennen;
- Rate Limits, Größenlimits, MIME-Prüfung und Malware-/EXIF-Bereinigung für Uploads;
- sicherheitskritische Aussagen als regel-/quellenbasiert formulieren, nicht als freie AI-Autorität.

Prompt-Injection-Schutz ist kein einzelner Systemprompt. OWASP empfiehlt insbesondere minimale Rechte, Trennung von Daten und Instruktionen, menschliche Bestätigung für privilegierte Aktionen und eine Prüfung des Tool-Aufrufs gegen die ursprüngliche Nutzerabsicht. [OWASP Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) [OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)

## 10. Klare Empfehlung

Baue fam als **Inventory-Produkt mit AI-Assistenz**, nicht als AI-Produkt mit nachträglich angehängter Datenbank.

Die erste produktionsfähige Version sollte nur drei Versprechen zuverlässig halten:

1. „Ich kann einen Einkauf in wenigen Sekunden in meinen Bestand übernehmen.“
2. „Ich sehe, was ich zuerst verbrauchen sollte.“
3. „Ich bekomme daraus realistische Rezeptvorschläge, ohne dass die AI meinen Bestand erfindet.“

Technisch bedeutet das: Barcode + einzelnes Etikettfoto + manuelle Korrektur, relationaler Bestand mit Events, ein Agent mit wenigen Tools, strukturierte Vorschläge, deterministische Erinnerungen und konsequente Bestätigung unsicherer Änderungen. Erst wenn diese Schleife im Alltag funktioniert, lohnt sich die Investition in Belegautomatisierung, bessere Vision, Offline-Inferenz oder komplexere Agenten.

## Grenzen der Recherche

Die Anbieterbeschreibungen von Winnow, Orbisk und MyFitnessPal sind Produkt-/Marketingquellen und legen ihre internen Modelle, Fehlerquoten und Architektur nicht vollständig offen. Die wissenschaftlichen Studien liefern wertvolle Hinweise zu Aufwand und Nutzung, sind aber teils klein, kontrolliert oder auf Messung statt auf ein kommerzielles Produkt ausgerichtet. Aussagen zur Architektur anderer Produkte sind daher als **öffentlich belegte Muster plus gekennzeichnete technische Ableitung**, nicht als Behauptung über nicht veröffentlichte interne Implementierungen, zu verstehen.

## Quellen- und Claim-Ledger

| Claim/Abschnitt | Primärquelle | Verwendung |
|---|---|---|
| Kamera/Scale, Produktstaffelung, manuell bis automatisiert | [Winnow Product](https://www.winnowsolutions.com/product/food-waste-management-software), [Winnow Workflow](https://info.winnowsolutions.com/food-waste-management) | Reales Erfassungsmuster |
| Vorschlag → Annahme/Ablehnung → Wirkungstracking | [Orbisk AI](https://orbisk.com/product/orbisk-ai/) | Human-in-the-loop |
| Vision liefert Kandidaten; Nutzer wählt und passt Portion an | [MyFitnessPal FAQ](https://support.myfitnesspal.com/hc/en-us/articles/360045761612-Meal-Scan-FAQ) | Review-UX |
| Fotoerfassung reduziert Zeitaufwand; Kodierung/Validierungsgrenzen | [PubMed FoodImage](https://pubmed.ncbi.nlm.nih.gov/32773964/), [PMC FoodImage](https://pmc.ncbi.nlm.nih.gov/articles/PMC7409719/) | Nutzbarkeit und Grenzen |
| Manuelle Eingabe als Adoptionsproblem | [JMIR Pilot](https://formative.jmir.org/2022/9/PDF), [Sustainability 2025](https://www.mdpi.com/2071-1050/17/14/6392) | Produkt-/UX-Risiko |
| OCR-/CNN-Workflow, editierbare Werte, konservativer Fallback | [Mobile OCR study](https://www.mdpi.com/2571-5577/8/6/176) | Erfassungsdesign |
| Produktdatenbank freiwillig, nicht vollständig garantiert | [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/) | Barcode-Risiko |
| Bedeutung von use-by/best-before, Verständnisprobleme | [EU-Kommission](https://food.ec.europa.eu/food-safety/food-waste/eu-actions-against-food-waste/date-marking-and-food-waste-prevention_en) | Sicherheits-/UX-Grenze |
| Ein Agent besteht aus Modell, Tools und Instruktionen; einfache Muster zuerst | [OpenAI Agent Guide](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/), [Anthropic Agents Guide](https://www.anthropic.com/engineering/building-effective-agents) | Orchestrierung |
| Tool-Aufruf durch Modell, Ausführung durch Anwendung | [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling), [Anthropic Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [Google Function Calling](https://ai.google.dev/gemini-api/docs/function-calling) | Backend-Vertrag |
| Strukturierte Ausgaben via Schema | [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [Google Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output) | Datenvalidierung |
| Prompt Injection und Excessive Agency | [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), [OWASP LLM06](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) | Bedrohungsmodell |
| GDPR data minimization, privacy by design, security | [EUR-Lex GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/art_32/oj/eng) | Datenschutz |
