# Gesprächszusammenfassung: Einkaufsbereiche, Category Lab und Alpha-Feedback

Status: Arbeitsstand und Entscheidungsprotokoll  
Stand: 2026-08-24  
Geltungsbereich: Einkaufslisten-Klassifikation, internes Category Lab, Alpha-Feedback und Supabase-Architektur.

## 1. Ausgangslage

`docs/issue#223_V2.md` wurde als ursprünglicher Ausbau der Einkaufslisten-Klassifikation vollständig umgesetzt. Der Stand umfasste:

- eine anfängliche 21-Zonen-Sortierung
- Supabase- und lokale SQLite-Constraints
- Klassifikationsregeln aus Produktname, Morphologie und Open-Food-Facts-Tags
- Unicode-Normalisierung für diakritische Zeichen und Lehnwörter
- eine Kalibrierung gegen rund 406.802 reale deutsche Open-Food-Facts-Produkte
- einen Golden-Korpus für dauerhaft abgesicherte Praxisfälle
- einen lokalen Category Debugger mit Dump-Browser und Entscheidungs-Trace
- erfolgreiche Golden-, Unit-, TypeScript- und Debugger-Build-Prüfungen

Beispiele aus dem Golden-Korpus waren unter anderem TK-Brombeeren, eingelegter Salat, Apfelmus/Apfelmark und Tee-Mischungen. Die Grundidee war korrekt: Produktdaten müssen automatisch in sinnvolle Einkaufsbereiche einsortiert werden. Die anfängliche Annahme einer festen, globalen Supermarkt-Laufstrecke war jedoch zu starr.

## 2. Grundsatzentscheidung: keine globale Laufstrecke

Eine weltweit gleiche Sortierung entlang einer vermeintlich typischen Laufstrecke wird nicht weiterverfolgt.

Gründe:

- Supermärkte, Ketten und einzelne Filialen haben unterschiedliche Grundrisse.
- Selbst innerhalb einer Kette können Warengruppen anders platziert sein.
- Haushalte und Personen kaufen in unterschiedlichen Reihenfolgen ein.
- Die physische Produktplatzierung ist nicht dasselbe wie die Produktfamilie.

Die Architektur trennt daher drei fachliche Dimensionen:

```text
ProductFamily  Was ist das Produkt?
ProductForm    In welcher Verkaufsform liegt es vor?
PlacementZone  Wo sucht der Nutzer es in diesem Markt?
```

Beispiele:

| Produkt | ProductFamily | ProductForm | PlacementZone |
| --- | --- | --- | --- |
| H-Milch | `milk` | `ambient` | `ambient_milk_drinks` |
| ungekühlter Haferdrink | `plant_drink` | `ambient` | `ambient_milk_drinks` |
| gekühlter Haferdrink | `plant_drink` | `chilled` | `chilled_plant_based` |
| Passierte Tomaten | `tomato_products` | `canned_jarred` | `pasta_tomato` |
| Ketchup | `condiments` | `ambient` | `condiments` |
| TK-Brombeeren | `fruit` | `frozen` | `frozen` |

Die globale Taxonomie beschreibt damit stabile Einkaufsbereiche und eine Fallback-Reihenfolge. Die tatsächlich sichtbare Reihenfolge kommt, sofern vorhanden, aus `stores.category_order` des ausgewählten Markts.

## 3. Fachliche Korrekturen an den Bereichen

Aus realen Einkaufssituationen und deinen Rückmeldungen entstanden folgende verbindliche Leitlinien:

- Haltbare Milch, ungekühlte Pflanzendrinks und haltbare Kochsahne bilden einen gemeinsamen Bereich.
- Nudeln und Tomatenprodukte bilden einen gemeinsamen Bereich.
- Reis, Getreide und Hülsenfrüchte bleiben von Nudeln getrennt.
- Cornflakes und vergleichbare Frühstücksprodukte gehören nicht in den Nudel-/Reisbereich.
- Ketchup, Senf und Würzsaucen sind ein eigener Bereich und nicht automatisch bei Nudeln oder Tomatenprodukten.
- Die Taxonomie darf eine Ladenstruktur nicht als universelle Realität ausgeben.

Die Zieltaxonomie umfasst 27 stabile `PlacementZoneId`s, darunter:

```text
fresh_produce
bakery
chilled_dairy_eggs
ambient_milk_drinks
chilled_plant_based
meat_poultry
fish_seafood
deli
pasta_tomato
rice_world_foods
breakfast
baking
oils_spices
condiments
canned_jars
ready_meals
snacks
sweets
cold_drinks
hot_drinks
alcohol
frozen
baby
pets
household
personal_care
other
```

IDs bleiben während der Alpha stabil. Labels, Farben und Regeln können versioniert korrigiert werden.

## 4. Gemeinsame Taxonomiedatei

Vor dem App- und Backend-Umbau entsteht eine gemeinsame, React-freie Datei:

```text
src/features/shopping-list/classification/placement-taxonomy.ts
```

Sie ist die kanonische TypeScript-Definition für App, Klassifikator und Category Lab. Ihr Inhalt beschränkt sich auf:

- `PLACEMENT_ZONE_IDS`
- daraus abgeleiteten Typ `PlacementZoneId`
- Taxonomieversion `placement-taxonomy-v2`
- deutsches Label, Farbe, Standardrang und Lagerort je Bereich
- Standardreihenfolge
- Legacy-ID-Mapping
- Normalisierung und Type Guard

Sie enthält ausdrücklich keine:

- Nutzer- oder Store-Präferenzen
- Feedback-Events
- Klassifikationsregeln oder Keywords
- Crowd-Learning-, LLM- oder ML-Logik

Das PostgreSQL-Schema bleibt für die Datenbank deklarativ. Die dortigen Constraints verwenden dieselben stabilen IDs. Die Taxonomiedatei ersetzt also keine deklarativen SQL-Schemata, sondern verhindert mehrere voneinander abweichende TypeScript-Kategorienlisten.

## 5. Open Food Facts, Produktdump und Bilder

Für lokale Evaluierung und Debugging steht ein vollständiger OFF-Dump auf der externen Festplatte zur Verfügung:

```text
/Volumes/Programme/off-dump-data/off_dump.jsonl.gz
```

Daneben existieren lokale Datenbanken beziehungsweise Manifeste für die deutsche Produktmenge und Produktbilder. Beim Bildmanifest gab es zunächst null erkannte Bildzuordnungen. Dieser Fehler in `prepare-image-dump.ts` wurde korrigiert; anschließend lief der Download von Frontbildern an.

Der Dump und die Bilder sind ausschließlich Arbeitsmaterial für das interne Category Lab:

- Produktnamen, Barcodes, Marken und OFF-Tags untersuchen
- Klassifikationsfälle bewerten
- Stichproben ziehen
- optionale Produktbilder im Debugger zeigen
- Test- und Trainingsdaten vorbereiten

Sie sind nicht als vollständiger Produktkatalog für die mobile App gedacht.

## 6. Category Debugger: Zweck und Entwicklung

Der Category Debugger ist das interne Entwicklungs- und Prüfwerkzeug für die Klassifikation. Er ist kein Endnutzer-Feature der NutriTrack-App.

### 6.1 Ausgangspunkt

Der Debugger entstand, um Entscheidungen des regelbasierten Klassifikators nachvollziehbar zu machen. Er sollte nicht nur das finale Ergebnis zeigen, sondern auch erklären, warum ein Produkt in einen Bereich fällt.

Der vorhandene lokale Dump wird direkt verwendet, ohne einen unnötigen Netzdownload auszulösen. Dadurch kann der Debugger mit der vollständigen deutschen OFF-Menge arbeiten.

### 6.2 Voller Dump-Browser

Der Dump-Browser erlaubt die Durchsicht der gesamten lokalen Produktmenge:

- paginierte Tabelle für alle verfügbaren Produkte
- Filter nach allen Einkaufsbereichen
- Filter nach Nutri-Score
- Text- und Barcodesuche
- direkter Sprung in den Entscheidungs-Trace eines Produkts

Der Trace enthält die Signale, die zur Einordnung geführt haben, etwa:

- OFF-Kategorie-Tags
- Namensregeln
- morphologische Regeln
- explizite Marker, beispielsweise für Tiefkühlprodukte oder eingelegte Waren
- Prioritäten und überschriebenen Kandidaten
- resultierende Produktfamilie, Produktform und Einkaufsbereich
- Klassifikatorversion und Konfidenz

### 6.3 Evaluation-Tab und blindes Labeling

Der Debugger wurde zum internen Evaluationstool ausgebaut. Zentral ist die Trennung zwischen menschlichem Urteil und Modell-/Regelvorhersage.

Der Ablauf für ein Produkt lautet:

```text
Produkt zeigen
  -> Mensch wählt einen Einkaufsbereich
  -> Label lokal speichern
  -> erst danach Vorhersage und Trace zeigen
```

Die Reihenfolge ist absichtlich blind. Würden Vorhersage oder Trace vorher sichtbar sein, würde das die menschliche Bewertung beeinflussen und das Evaluationsergebnis verfälschen.

Nachdem beim Testen direkt das nächste Produkt erschien, ohne die Vorhersage und den Trace sichtbar zu machen, wurde das Verhalten klargestellt: Die Bewertung schließt nicht sofort zur nächsten Aufgabe weiter. Zuerst erscheint der Vergleich mit der vorherigen Vorhersage und der vollständige Trace; erst danach wird zum nächsten Produkt gewechselt.

### 6.4 Evaluierungsqueues

Das Tool soll nicht zufällig nur einfache Produkte zeigen. Es priorisiert mehrere Queues:

| Queue | Zweck |
| --- | --- |
| Konflikte | Regeln und Tags widersprechen sich oder führen zu konkurrierenden Bereichen. |
| Sonstiges | Produkte mit `other`, geringer Konfidenz oder fehlenden Signalen. |
| stratifizierte Zufallsstichprobe | Repräsentative Kontrolle über Bereiche, Marken und Produktarten. |
| bekannte Grenzfälle | Produkte nahe wichtiger Bereichsgrenzen. |
| Holdout | Produkte, die nicht für Regel- oder Modellentscheidungen verwendet werden dürfen. |

Die Queues dienen einer besseren Datenqualität. Sie sind keine automatische Trainingsfreigabe.

### 6.5 Bedienung und lokale Datenhaltung

Der interne Evaluierungsmodus umfasst:

- Tastatursteuerung für schnelles Labeling
- lokale Speicherung der Labels
- JSON-Export und JSON-Import für Sicherung und Austausch
- nachvollziehbare Kennzeichnung von Quelle, Zeitpunkt und Klassifikatorversion
- Trennung zwischen unbearbeitetem Produkt, menschlichem Label und Klassifikatorergebnis

Für die Bewertung relevante Daten bleiben lokal beziehungsweise im Category Lab. Es gibt keinen automatischen Export in die Nutzer-App.

### 6.6 Bilder im Debugger

Produktbilder können als zusätzliche Orientierung angezeigt werden, sofern sie im lokalen Bildmanifest vorliegen. Sie sind hilfreich bei:

- unklaren oder verkürzten Produktnamen
- Markenprodukten mit wenig aussagekräftigen Tags
- Unterscheidung von gekühlter, haltbarer oder tiefgekühlter Verkaufsform
- Erkennung von Würzsaucen, Fertiggerichten oder Produkten mit mehrdeutigen Namen

Das Bild ist ein Hilfsmittel für die menschliche Bewertung, kein alleiniger Klassifikationsbeweis.

### 6.7 Category Debugger als Qualitätsgrenze

Der Debugger ist die Stelle, an der neue Regeln, Heuristiken, LLM-Vorschläge oder Modelle geprüft werden. Ein gutes Ergebnis im Debugger ist Voraussetzung für eine spätere Klassifikatorversion, aber nicht deren automatische Freigabe.

## 7. Interner Trainings- und Prüfansatz

Nach der Klarstellung, dass die damaligen Entwicklungsschritte ausschließlich dem eigenen Trainings- und Prüfansatz dienen, wurde folgende Grenze festgelegt:

```text
Das Category Lab verbessert die interne Klassifikation.
Es verändert weder automatisch die App noch globale Regeln.
```

Dieser Abschnitt beschreibt den vollständigen internen Ablauf.

### 7.1 Ziele

Der interne Ansatz soll beantworten:

- Welche Bereiche werden zuverlässig klassifiziert?
- Welche Regeln erzeugen Fehlzuordnungen?
- Welche Produktarten fehlen im Golden-Korpus?
- Verbessert eine neue Regel die Gesamtqualität oder nur einzelne Beispiele?
- Schlägt ein einfaches ML-Basismodell die Regelbasis tatsächlich?
- Wo kann ein LLM beim Labeling helfen, ohne selbst zur Wahrheit zu werden?

### 7.2 Datenquellen und Label-Hierarchie

Es gibt unterschiedliche Datenquellen mit klarer Vertrauenshierarchie:

| Quelle | Rolle | Darf direkt Goldlabel werden? |
| --- | --- | --- |
| menschlich bestätigter Golden-Korpus | verbindlicher Regressionstest | ja |
| blindes internes menschliches Label | Review-Kandidat | nach Prüfung |
| Open-Food-Facts-Tag | Klassifikationssignal | nein |
| Namens-/Morphologieregel | Klassifikationssignal | nein |
| LLM-Vorschlag | Labeling-Hilfe | nein |
| späteres App-Feedback | Rohsignal | nein |

Kein einzelnes automatisches Signal ist ein Goldlabel.

### 7.3 Deterministischer Dataset-Split

Gelabelte Produkte werden nicht zufällig bei jedem Lauf neu gemischt. Der Split erfolgt deterministisch auf einem stabilen Produktschlüssel, etwa Barcode oder kanonischem Produktschlüssel.

```text
Produktgruppe
  -> stabiler Hash
  -> Calibration oder Holdout
```

Damit landen Varianten desselben Produkts nicht gleichzeitig im Trainings-/Kalibrierungsteil und im Holdout. Der Holdout bleibt bis zum Versionsvergleich unangetastet.

### 7.4 Calibration

Die Calibration-Menge dient dazu:

- Regeln zu entwickeln und zu verfeinern
- Prioritäten zwischen Tags und Namenssignalen festzulegen
- neue Kategorien und Grenzfälle zu prüfen
- Kandidaten für neue Golden-Corpus-Einträge vorzubereiten
- Baseline-Modelle zu trainieren oder zu vergleichen

Eine Verbesserung auf Calibration allein reicht nicht aus.

### 7.5 Holdout

Die Holdout-Menge dient ausschließlich der ehrlichen, nachgelagerten Bewertung. Sie darf nicht benutzt werden, um Regeln auf einzelne Fälle zuzuschneiden.

Vor einer Veröffentlichung einer neuen Klassifikatorversion werden mindestens verglichen:

- Trefferquote insgesamt
- Trefferquote pro Einkaufsbereich
- Macro-F1, damit große Kategorien kleine nicht verdecken
- Confusion Matrix
- Anteil `other`
- Abdeckung der automatischen Zuordnung
- Verschlechterungen wichtiger Grenzfälle
- Unterschiede zur vorherigen Klassifikatorversion

Eine Version wird nicht veröffentlicht, wenn sie zwar einzelne Bereiche verbessert, aber relevante Bereiche oder Holdout-Ergebnisse verschlechtert.

### 7.6 Confusion Matrix und Versionsvergleich

Die Confusion Matrix zeigt nicht nur „richtig/falsch“, sondern welche Bereiche systematisch verwechselt werden. Besonders wichtige Paare sind beispielsweise:

- `pasta_tomato` gegen `canned_jars`
- `breakfast` gegen `rice_world_foods`
- `ambient_milk_drinks` gegen `chilled_dairy_eggs`
- `condiments` gegen `pasta_tomato`
- `frozen` gegen frische Obst-/Gemüsebereiche

Der Versionsvergleich speichert pro Lauf:

- Klassifikatorversion
- verwendeten Dataset-Snapshot
- Anzahl und Herkunft der Labels
- Calibration- und Holdout-Metriken
- Änderungen gegenüber der Referenzversion
- Liste neu gewonnener und verlorener Fälle

Dadurch kann jede Regel- oder Modelländerung nachvollziehbar zurückverfolgt werden.

### 7.7 Halbautomatisches Regeltraining

„Automatisches Regeltraining“ bedeutet im internen Ansatz nicht, dass Regeln automatisch in den Produktivcode geschrieben werden.

Der Ablauf lautet:

```text
Fehlklassifikationen aggregieren
  -> wiederkehrende Muster erkennen
  -> Regelkandidat formulieren
  -> Calibration prüfen
  -> Holdout vergleichen
  -> menschliche Freigabe
  -> Regel manuell in den Klassifikator übernehmen
```

Beispiele für Regelkandidaten:

- ein expliziter Tiefkühlmarker überstimmt ein generisches Frucht-Tag
- „eingelegt“ oder „im Glas“ überstimmt ein frisches Produktwort
- „Mark“ oder „Mus“ mit passenden OFF-Tags überstimmt eine generische Fruchtbezeichnung
- „Moringa“, „Chai“, „Matcha“ oder „Kräutertee“ darf nicht fälschlich Gemüse werden

Die endgültige Regel bleibt eine menschliche Codeentscheidung mit Golden- und Holdout-Prüfung.

### 7.8 ML-Baseline

Ein ML-Modell ist erst sinnvoll, wenn ausreichend geprüfte Labels vorhanden sind. Der erste Vergleich sollte bewusst einfach, transparent und reproduzierbar sein:

- Texteingaben: Produktname, Marke und gegebenenfalls OFF-Tags
- Merkmale: Wort- und Zeichen-N-Gramme sowie normalisierte Tags
- Modellklasse: lineares Mehrklassenmodell als Baseline
- Ausgabe: Bereich, Konfidenz und Top-Kandidaten
- Vergleich: Regeln gegen Modell gegen gegebenenfalls Kombination

Ein komplexes Modell ist kein Ziel an sich. Es muss auf dem Holdout einen nachweisbaren Vorteil gegenüber den Regeln liefern und darf die Nachvollziehbarkeit nicht unvertretbar verschlechtern.

Das ML-Modell darf zunächst nur im Category Lab laufen. Es wird nicht automatisch in die App eingebaut.

### 7.9 LLM-gestütztes Labeling

Ein LLM kann für interne Vorbereitung nützlich sein, zum Beispiel um:

- unklare Produktnamen zu erklären
- Vorschläge für Produktfamilie, Produktform und Einkaufsbereich zu liefern
- mögliche Namensmarker oder Synonyme vorzuschlagen
- ähnliche Produkte für einen Review zu gruppieren

Ein LLM-Output ist dabei immer ein Vorschlag. Für jeden Vorschlag müssen mindestens gespeichert werden:

- Modell- und Promptversion
- verwendete Produktinformationen
- vorgeschlagene Bereiche und Begründung
- menschliche Bestätigung, Änderung oder Ablehnung

LLM-Vorschläge werden weder direkt Goldlabels noch Regeln noch Trainingsdaten. Erst menschlicher Review kann sie in einen freigegebenen Dataset-Snapshot überführen.

### 7.10 Veröffentlichung einer Klassifikatorversion

Eine neue Version darf nur nach diesem Ablauf entstehen:

```text
Rohdaten
  -> menschliche Labels
  -> Review
  -> explizite Trainingsfreigabe
  -> versionierter Dataset-Snapshot
  -> Calibration
  -> Holdout
  -> Vergleich mit aktueller Version
  -> manuelle Veröffentlichung
```

Es gibt keine automatische Mindestmenge, keine automatische Regelübernahme und keinen automatischen Veröffentlichungszeitpunkt.

## 8. Crowd Learning: bewusst zurückgestellt

Crowd Learning wurde besprochen, aber vorerst nicht umgesetzt, weil noch keine reale Nutzerschaft existiert.

Die spätere Bedeutung ist strikt begrenzt:

```text
Nutzerkorrektur = Rohsignal, nicht Wahrheit
```

Auch bei vielen gleichartigen Signalen darf die App nie selbstständig globale Regeln, Goldlabels oder Modelle verändern. Nutzersignale werden zunächst unverändert und nachvollziehbar gespeichert, dann pseudonymisiert exportiert, intern geprüft und nur nach menschlicher Freigabe berücksichtigt.

## 9. Alpha: Datensammlung ohne störende UX

Die Alpha soll reale Präferenzen sammeln, ohne den Einkaufsablauf mit Lern- oder Korrekturmechanismen zu überladen.

### 9.1 Beschlossener Nutzerablauf

```text
Artikel antippen
  -> bestehendes Bearbeiten-Formular
  -> Feld „Einkaufsbereich“ bei Bedarf ändern
  -> Speichern
  -> Liste gruppiert Artikel neu
```

Die bestehenden Interaktionen bleiben erhalten:

- Tippen öffnet weiterhin das Bearbeiten-Formular.
- Long Press behält die vorhandene Löschfunktion.
- Der Einkaufsmodus bleibt auf Abhaken, Auf-/Zuklappen und Abschließen begrenzt.

Nicht Bestandteil der Alpha-UX sind:

- Schnell-Picker aus der Listenzeile
- neue Long-Press-Funktion
- Bedienhinweis in der Einkaufsliste
- Drag-and-drop
- Undo-Snackbar
- Konflikt- oder Synchronisationsmeldungen
- Crowd-, Lern- oder Modellstatus
- zusätzlicher Datenschutzdialog während des Einkaufens

Die sichtbare fachliche Änderung beschränkt sich auf das umbenannte und präzisere Feld „Einkaufsbereich“ im vorhandenen Add-/Edit-Formular.

### 9.2 Formularzustand und sauberes Tracking

Der Formularzustand unterscheidet:

```ts
{ mode: 'automatic' }
{ mode: 'manual', zoneId }
```

Zusätzlich wird `placementSelectionTouched` geführt.

Regeln:

- Add startet unangetastet mit automatischer Auflösung.
- Edit bildet eine vorhandene manuelle Präferenz im aktuellen Scope ab.
- Normales Speichern ohne bewusste Bereichsinteraktion erzeugt kein Feedback.
- Abbrechen erzeugt weder Präferenz noch Feedback-Event.
- Eine echte manuelle Abweichung erzeugt `manual_reassign`.
- Das Entfernen einer aktiven Präferenz über „Automatisch“ erzeugt `reset_to_automatic`.
- Technische Legacy-Normalisierung erzeugt niemals Feedback.

### 9.3 Store- und Haushaltspräferenzen

Die Auflösungsreihenfolge lautet:

```text
1. globale Klassifikation
2. Haushaltspräferenz ohne Store
3. Store-Präferenz für den aktuellen Markt
4. Snapshot des aktuellen Listenelements
```

Beim Speichern:

- mit Markt entsteht oder ändert sich eine Store-Präferenz
- ohne Markt entsteht oder ändert sich eine Haushaltspräferenz
- „Automatisch“ entfernt nur die Präferenz des aktuellen Scopes
- das Entfernen einer Store-Präferenz darf auf eine Haushaltspräferenz zurückfallen
- ein Marktwechsel ohne manuelle Auswahl löst den Bereich neu auf

## 10. Zwei getrennte Supabase-Instanzen

| Instanz | Aufgabe |
| --- | --- |
| App-Supabase | produktive App-Daten, Präferenzen und rohe Alpha-Feedback-Events |
| Evaluation-Supabase | interne pseudonymisierte Auswertung, Review und Dataset-Snapshots |

Die mobile App verbindet sich niemals direkt mit der Evaluation-Supabase.

### 10.1 App-Supabase

Backendseitig werden vorbereitet:

- `shopping_category_preferences.store_id`
- getrennte Unique-Indizes für Haushalts- und Store-Scope
- Haushaltsprüfung für den referenzierten Store
- append-only Tabelle `shopping_category_feedback_events`
- clientseitig erzeugte `event_id` für Offline-Idempotenz
- RLS und explizite Tabellenrechte
- keine Realtime-Registrierung für Feedback-Events

Ein Feedback-Event enthält mindestens:

- Produktschlüssel: Barcode, Produkt-ID oder normalisierter Produktname
- alten, vorhergesagten und neuen Einkaufsbereich
- alten und neuen `category_source`
- Markt- oder Haushaltsscope
- Klassifikator- und Taxonomieversion
- Produktfamilie und Produktform der Vorhersage
- Plattform, App-Version, Build-Kanal und Gerätezeitpunkt

Nicht enthalten sind Produktnotizen, Rezeptnamen, Haushaltsnamen, Marktnamen und Profilnamen.

### 10.2 RLS und Rechte

Die Feedback-Tabelle ist für App-Nutzende insert-only:

```text
anon:           keine Rechte
authenticated:  INSERT
service_role:   SELECT
```

Die Insert-Policy prüft:

- der Nutzer ist authentifiziert
- `actor_user_id` entspricht `auth.uid()`
- der Nutzer ist Mitglied des Haushalts
- ein gesetzter Store gehört zu diesem Haushalt

App-Clients können Events nicht lesen, ändern oder löschen. Datenschutzlöschungen erfolgen administrativ. Eine Haushaltslöschung entfernt zugehörige Events per `ON DELETE CASCADE`.

### 10.3 Lokale SQLite und Outbox

Die mobile App führt die Feedback-Tabelle lokal als push-only Entity. Artikel, Präferenz, Event und Outbox-Einträge werden in einer lokalen exklusiven Transaktion geschrieben.

Der Push-Pfad:

- erlaubt nur `insert`
- verwendet kein `.select()` nach dem Insert
- zieht die Entity nie per Pull oder Realtime
- führt Events nicht zusammen
- behandelt PostgreSQL-Fehler `23505` für dieselbe `event_id` als erfolgreichen Retry

Ein Netzwerkfehler blockiert die lokale Einkaufslistenänderung nicht.

### 10.4 Evaluation-Supabase und Import

Der Import erfolgt ausschließlich durch ein internes Script, beispielsweise:

```text
tools/category-debugger/scripts/import-app-feedback.ts
```

Der Ablauf:

1. Import-Cursor des letzten erfolgreichen Laufs lesen.
2. App-Events nach `(created_at, event_id)` aufsteigend lesen.
3. Nutzer-, Haushalts- und Store-ID stabil per HMAC-SHA256 pseudonymisieren.
4. Direkte IDs aus dem Evaluation-Payload entfernen.
5. Event idempotent in `evaluation_crowd_signals` einfügen.
6. Cursor erst nach vollständigem Erfolg einer Seite fortschreiben.
7. Kein Review und keine Trainingsfreigabe automatisch erzeugen.

`evaluation_import_runs` protokolliert Status, Cursor, gelesene Menge, eingefügte Menge, Duplikate und Fehler.

## 11. Alpha-Aktivierung und Transparenz

Die Sammlung ist ausschließlich für vorab informierte Alpha-Teilnehmer aktiv. Die Information liegt in Alpha-Einladung beziehungsweise bestehendem Datenschutzbereich, nicht im Einkaufsablauf.

Die Aktivierung kann über Build-Vorgabe und Remote-Flag erfolgen:

```text
Remote-Flag bekannt   -> Remote-Flag gewinnt
Remote-Flag unbekannt -> Build-Vorgabe gewinnt
```

Production bleibt standardmäßig deaktiviert. Ist die Sammlung deaktiviert, funktionieren Taxonomie und Präferenzen unverändert; nur das zusätzliche Feedback-Event entfällt.

## 12. Sicherheit und Secrets

Für die mobile App dürfen nur Supabase-URL und Publishable Key verwendet werden.

Nicht in die App gehören:

- Secret Key oder Service-Role-Key
- Evaluation-Supabase-Secret
- Pseudonymisierungsschlüssel

Der zuvor in einer Unterhaltung veröffentlichte Supabase Secret Key muss vor produktiver Nutzung rotiert werden.

## 13. Kein lokales Supabase-Docker

Lokale Supabase-Docker-Container werden nicht als regulärer Arbeitsweg verwendet, weil der Rechner dafür nicht ausreichend Ressourcen hat.

Die Projektregeln bleiben dennoch:

- Datenbankschema ausschließlich deklarativ unter `supabase/schemas/`
- Migrationen nicht von Hand schreiben
- Datenbanktypen nach Schemaänderungen generieren

Der praktische Ablauf muss deshalb in einer ressourcenfähigen Umgebung oder CI stattfinden:

1. deklarative Schemaänderung erstellen
2. Migration generieren und prüfen
3. Datenbanktests und Advisors ausführen
4. auf die Remote-App-Supabase ausrollen
5. anschließend per Supabase MCP Schema, RLS, Rechte und Advisors prüfen

Lokale `db:reset`-Schritte dürfen nicht als zwingender Standard im Alpha-Plan stehen.

## 14. Weitere Arbeitsentscheidungen und beobachtete Probleme

### 14.1 Evaluationstool ist kein Expo-Feature

Für das lokale Category Lab und den Category Debugger ist Expo unnötig. Das Werkzeug läuft als separates lokales Web-/Vite-Tool und darf unabhängig von der mobilen App entwickelt, gebaut und mit großen Dumps betrieben werden.

### 14.2 Fehlender Trace nach menschlichem Label

Beim ersten praktischen Test wechselte die Evaluation nach einer Bereichsauswahl direkt zum nächsten Produkt. Dadurch war der beabsichtigte Lern- und Kontrollschritt nicht sichtbar. Der richtige Ablauf ist verbindlich:

```text
blind labeln
  -> Vorhersage und vollständigen Trace vergleichen
  -> erst dann nächstes Produkt
```

### 14.3 JWT-Fehler während der Entwicklung

Die Meldung `JWT issued at future` weist auf eine Zeitabweichung zwischen Gerät und Supabase-Auth hin. Sie ist kein Klassifikations- oder Feedbackdatenfehler. Bei erneutem Auftreten müssen Systemzeit, Zeitzone und die erneuerte Auth-Session geprüft werden.

### 14.4 Einkaufssimulationen

Die geplanten Simulationen mit drei Einkäufen für einen Drei-Personen-Haushalt und jeweils etwa 25 bis 50 Produkten dienen dazu, Taxonomie und Sortierung gegen realistische Mischlisten zu prüfen. Sie sind ein Produkt- und UX-Test, keine Trainingsdatenquelle.

### 14.5 Zusammenarbeit und Laufzeitverhalten

Vor ressourcenintensiven oder externen Schritten wird immer vorher angekündigt, was ausgeführt wird und warum. Keine stillen Downloads, Dumps, Containerstarts oder anderen Hintergrundaktionen. Laufende Entwicklungsserver, Simulatoren und Container werden nicht beendet, sofern dies nicht ausdrücklich beauftragt wurde.

## 15. Nicht Bestandteil der Alpha

- automatische globale Regelübernahme
- automatisches Crowd Learning
- automatisches ML-Training
- automatische Dataset-Freigabe
- automatische Klassifikatorveröffentlichung
- Produkt-Drag-and-drop
- GPS- oder Standorterfassung
- Nutzeroberfläche für Rohsignale
- direkte App-Verbindung zur Evaluation-Supabase
- Evaluation-Secrets im App-Bundle
- globale Zusammenführung widersprüchlicher Store-Signale
