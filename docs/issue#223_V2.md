# Vollständiger Implementierungsplan für Issue #223

## 1. Verbindliche Entscheidungen

Die neue Lösung ersetzt das bestehende System vollständig.

- Keine Rückwärtskompatibilität zu `shopping_list_items.category`.
- Keine Übernahme alter deutscher Kategorie-Labels.
- Keine parallelen Felder oder Dual-Reads.
- Keine Migration des alten Offline-Dumps.
- Keine Wiederverwendung alter lokaler SQLite-/Outbox-Daten.
- `guessCategory()` und `SUBSTRING_MIN_LENGTH` werden am Ende vollständig entfernt.
- Bestehende Entwicklungsdaten dürfen durch `db:reset` und einen lokalen Datenbank-Neustart verloren gehen.
- Die erste App-Version mit dieser Änderung benötigt zwingend den neuen Dump mit `schema_version = 2`.
- Die lokale Hauptdatenbank wird als neue Datei `fam-v2.db` angelegt. Die öffentliche OFF-Produktdatenbank bleibt davon als `off-dump-v2.db` getrennt und wird nur bei Bedarf attached.
- Es wird keine eigene SQLite-Datei pro Haushalt angelegt. Haushalts- und Privatdaten bleiben in `fam-v2.db` und werden dort weiterhin über ihre fachlichen IDs getrennt; der OFF-Dump enthält ausschließlich öffentliche Produktdaten.
- Der installierte OFF-Dump ist die sofort verfügbare Offline-Produktquelle. Online darf ausschließlich ein vertrauenswürdiger Backend-Prozess globale OFF-Metadaten aktualisieren.
- Jede Änderung an Normalisierung, Regeln oder Prioritäten erhöht eine explizite `classifier_version`.
- Quellenparität bedeutet deterministisches Verhalten für identische normalisierte Eingaben und dieselbe `classifier_version`, nicht identische Ergebnisse für zeitlich unterschiedliche OFF-Datenstände.

Die Architektur gilt anschließend als neue Baseline.

---

## 2. Zentrale Domänentypen

### Kategorie-IDs

```ts
type ShoppingCategoryId =
  | 'produce'
  | 'bakery'
  | 'deli_meat'
  | 'pantry_canned'
  | 'pantry_dry'
  | 'breakfast'
  | 'snacks'
  | 'beverages'
  | 'dairy'
  | 'frozen'
  | 'drugstore'
  | 'checkout';
```

`SHOPPING_CATEGORIES` bleibt die zentrale Darstellungskonfiguration:

```ts
type ShoppingCategory = {
  id: ShoppingCategoryId;
  label: string;
  sortOrder: number;
  storageKind: StorageKind;
  color: string;
};
```

Labels werden ausschließlich angezeigt, niemals gespeichert.

### Kategorieherkunft

```ts
type CategorySource =
  | 'user'
  | 'household_preference'
  | 'off_taxonomy'
  | 'name_fallback';
```

`category_id = null` bedeutet „Sonstiges“.

Dabei müssen zwei Fälle unterscheidbar bleiben:

- `category_id = null`, `category_source = null`: automatisch nichts gefunden
- `category_id = null`, `category_source = 'user'`: Nutzer hat bewusst „Sonstiges“ gewählt

### Klassifikationsergebnis

```ts
type CategoryClassification = {
  categoryId: ShoppingCategoryId | null;
  source: Exclude<CategorySource, 'user'> | null;
  classifierVersion: string;
  evidence?: {
    kind: 'preference' | 'off_tag' | 'name_rule';
    value: string;
  };
};
```

`evidence` ist die kompakte Produktionsausgabe. Für Tests, Debugger und CLI gibt es zusätzlich einen vollständigen Trace:

```ts
type CategoryTrace = {
  classifierVersion: string;
  input: {
    source: 'live' | 'barcode' | 'dump' | 'local_mirror' | 'free_text';
    dataVersion: string | null;
    categoryTags: readonly string[];
    normalizedName: string | null;
  };
  candidates: readonly CategoryCandidate[];
  rejectedCandidates: readonly RejectedCategoryCandidate[];
  winner: CategoryClassification;
  conflictReason: string | null;
};
```

Der Trace enthält alle gematchten und verworfenen Regeln einschließlich Priorität, Score und Begründung. Er wird nicht synchronisiert und nicht an Einkaufslisten- oder Historieneinträgen gespeichert.

---

## 3. Neue Auflösungsreihenfolge

Die Kategorie wird immer in dieser Reihenfolge bestimmt:

1. Aktuelle manuelle Auswahl im Formular
2. Haushaltspräferenz für `product_id`
3. Haushaltspräferenz für normalisierten Freitextnamen
4. Open-Food-Facts-`categories_tags`
5. Morphologischer Namens-Fallback
6. `null` beziehungsweise „Sonstiges“

Produkte mit OFF-Metadaten verwenden den Namen nur, wenn aus den Tags kein eindeutiges Ergebnis entsteht.

Das Ergebnis wird beim Erstellen eines Einkaufslisten-, Historien- oder Bestandseintrags als Snapshot gespeichert. Spätere OFF- oder Dump-Updates kategorisieren bestehende Einträge nicht automatisch neu. Eine neue Auflösung findet nur bei einer dafür vorgesehenen Nutzeraktion oder bei der Erstellung eines neuen Eintrags statt.

---

## 4. Breaking Supabase-Schema

Änderungen erfolgen ausschließlich in `supabase/schemas/*.sql`.

### `products`

Ergänzen:

```sql
off_category_tags text[] not null default '{}',
off_last_modified_at timestamptz
```

Das bisherige freie `category`-Feld im TypeScript-Produktmodell entfällt.

### `shopping_list_items`

`category` vollständig entfernen und ersetzen durch:

```sql
category_id text,
category_source text,
category_classifier_version text
```

Die Kategorie und ihre Quelle sind ein stabiler Snapshot. `category_classifier_version` wird für automatisch ermittelte Kategorien gesetzt und bleibt für manuelle Entscheidungen `null`. Die Spalten erhalten Checks für die bekannten IDs beziehungsweise Quellen.

### `shopping_history`

Ebenfalls ersetzen:

```sql
category_id text,
category_source text,
category_classifier_version text
```

### Neue Tabelle `shopping_category_preferences`

Neue Schemadatei `supabase/schemas/21_shopping_category_preferences.sql` (nummeriert nach `08_inventory.sql` wegen des Fremdschlüssels auf `households`):

```text
id uuid primary key
household_id uuid not null
key_type text not null             -- product | name
normalized_key_value text not null
category_id text nullable
created_by uuid nullable
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

Regeln:

- Die natürliche Identität ist `(household_id, key_type, normalized_key_value)`.
- `key_type = 'product'` verwendet die kanonische, kleingeschriebene UUID des `product_id` als `normalized_key_value`.
- `key_type = 'name'` verwendet ausschließlich das Ergebnis der gemeinsamen Namensnormalisierung.
- Ein Unique Constraint über die vollständige natürliche Identität gilt auch für soft-deletete Zeilen. Eine erneut gewählte Präferenz stellt denselben Datensatz wieder her, statt eine zweite Zeile anzulegen.
- `category_id = null` ist erlaubt und bedeutet eine bewusste „Sonstiges“-Präferenz.
- Soft Delete unterstützt „Auf automatisch zurücksetzen“.

### Abgeleitete technische Sync-Identität

`id` ist kein unabhängiger fachlicher Schlüssel, sondern eine deterministische UUIDv5, die ausschließlich aus der natürlichen Identität abgeleitet wird:

```text
natural identity:
  (household_id, key_type, normalized_key_value)

technical sync identity:
  UUIDv5(PREFERENCE_NAMESPACE_UUID, canonical_preference_key)
```

`PREFERENCE_NAMESPACE_UUID` ist eine einmalig festgelegte und eingecheckte Konstante. `canonical_preference_key` besitzt ein versioniertes, bytegenau definiertes Format. UUIDs werden kleingeschrieben, Namen vor der ID-Erzeugung normalisiert und die Bestandteile mit einem nicht mehrdeutigen Format serialisiert. Es darf keine plattformspezifische Vorverarbeitung geben.

Damit erzeugen zwei Geräte für dieselbe Haushaltspräferenz dieselbe Zeilen-ID. Das bestehende Last-Write-Wins kann dann über dieselbe Entität arbeiten, während der Unique Constraint auf der natürlichen Identität als zusätzliche Datenbankabsicherung bestehen bleibt.

Eine gemeinsame TypeScript-Funktion erzeugt Schlüssel und UUID. Ein eingechecktes Set fester Testvektoren enthält Eingabe, normalisierten Schlüssel und erwartete UUID. Dieselben Vektoren werden im App-Code, in Node-/Bun-Skripten und bei einer späteren Backend-Implementierung verwendet, damit iOS, Android, Backend und Tests garantiert identische IDs erzeugen.

### RLS und API-Zugriff

Policies:

- Haushaltsmitglieder dürfen Präferenzen lesen.
- Haushaltsmitglieder dürfen Präferenzen anlegen und ändern.
- Mitglieder anderer Haushalte dürfen weder lesen noch schreiben.
- `household_id` darf durch ein Update nicht in einen fremden Haushalt verschoben werden.
- `USING` und `WITH CHECK` müssen beide vorhanden sein.

Für die neue Tabelle werden explizite Grants an `authenticated` gesetzt. Supabase stellt neue Tabellen seit 2026 nicht mehr zwingend automatisch über die Data API bereit; Grants und RLS sind getrennte Schutzebenen. [Supabase-Hinweis](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

### Vertrauenswürdige Aktualisierung globaler OFF-Produkte

Die bestehende RLS-Regel, nach der Clients `source = 'off'` nicht direkt aktualisieren dürfen, bleibt bestehen. Der Client darf insbesondere keine selbst gelieferten `off_category_tags` als globale Wahrheit speichern.

Stattdessen:

1. Die App klassifiziert ein Live- oder Dump-Produkt sofort mit den lokal vorhandenen Tags.
2. Online stößt sie für die EAN eine serverseitige Anreicherung an.
3. Eine Supabase Edge Function oder ein interner Worker lädt die OFF-Daten selbst von Open Food Facts und validiert sie.
4. Der Backend-Prozess aktualisiert ausschließlich die erlaubten OFF-Metadaten und nur, wenn `off_last_modified_at` neuer ist.
5. Service-Role-Zugangsdaten bleiben ausschließlich im Backend; der Endpunkt erhält Rate-Limits und akzeptiert die EAN, aber keine vom Client als autoritativ behaupteten Tags.

Der globale `products`-Datensatz ist damit ein verifizierter Online-Cache. Für den Offline-Betrieb bleibt der installierte Dump die Produktdaten-Autorität.

### Datenbankworkflow

1. Deklarative Schemata ändern.
2. pgTAP-Tests ergänzen.
3. `bun run db:diff -- -f shopping_category_taxonomy`
4. Generierte Migration prüfen, nicht manuell editieren.
5. `bun run db:reset`
6. `bun run test:db`
7. `bun run db:advisors`
8. `bun run db:diff`, Ergebnis muss leer sein.
9. `bun run db:types`

Es gibt bewusst kein Backfill alter Labels.

---

## 5. Neue lokale SQLite-Baseline

Da keine Rückwärtskompatibilität benötigt wird, wird keine komplexe lokale Migration geschrieben. Der Cutover verwendet verbindlich einen neuen Dateinamen und keine alternative Schema-Epoch-Strategie.

Stattdessen:

- die lokale Hauptdatenbank wird als `fam-v2.db` neu angelegt;
- alter Mirror, alte Outbox und alter Sync-Cursor werden nicht übernommen;
- nach Anmeldung wird der Zustand vollständig von Supabase gebootstrapped;
- der alte OFF-Dump wird verworfen und durch `off-dump-v2.db` ersetzt;
- Dump-Schema 1 wird grundsätzlich abgelehnt.

### Verbindliche Trennung der lokalen Datenbanken

```text
fam-v2.db
  private Nutzerdaten
  synchronisierte Haushaltsdaten
  Einkaufslisten- und Bestandssnapshots
  shopping_category_preferences
  lokaler Products-Mirror
  Outbox und Sync-Cursor

off-dump-v2.db
  öffentlicher, geräteweiter OFF-Produktkatalog
  Dump-Metadaten und data_version
  unabhängig aktualisierbar
  keine Haushalts-, Nutzer- oder Outbox-Daten
```

`off-dump-v2.db` wird für Produktsuchen an die benötigten SQLite-Verbindungen attached. Es wird nicht pro Haushalt dupliziert. Haushaltswechsel betreffen nur gefilterte Daten in `fam-v2.db`; Dump-Patches können unabhängig davon installiert werden. Kategoriepräferenzen und gespeicherte Kategorie-Snapshots dürfen niemals in den OFF-Dump geschrieben werden.

Lokale Tabellen erhalten:

- neue Kategorie-ID-/Quellspalten;
- `category_classifier_version` an Einträgen und Historie;
- `products.off_category_tags` als JSON-Text;
- `products.off_last_modified_at`;
- Spiegel für `shopping_category_preferences`;
- passende Indizes;
- aktualisierte Entity-Metadaten.

Der Sync muss Postgres-`text[]` weiterhin als JSON-Text in SQLite spiegeln.

---

## 6. Open-Food-Facts-Produktmodell

`OpenFoodFactsProduct` wird geändert:

```ts
type OpenFoodFactsProduct = {
  barcode: string;
  name: string;
  brand?: string;
  categoryTags: string[];
  offLastModifiedAt?: string;
  // Nährwerte usw.
};
```

Entfernen:

```ts
category?: string;
```

### Live-Suche

`SEARCH_FIELDS` erhält:

```text
categories_tags
last_modified_t
```

Der Parser:

- übernimmt ausschließlich String-Tags;
- behält kanonische IDs unverändert;
- ignoriert unbekannte Werte;
- wandelt `last_modified_t` in einen validierten Zeitwert um;
- verwendet nicht mehr `raw.categories.split(',')[0]`.

### Barcode-Lookup

Produktabfragen werden auf die aktuelle OFF-Produkt-API v3.6 umgestellt. Die Legacy-Volltextsuche bleibt vorerst bestehen, weil OFF für Volltextsuche noch keinen gleichwertigen stabilen v3-Ersatz anbietet. [OFF API](https://openfoodfacts.github.io/openfoodfacts-server/api/).

### Produktspeicherung

`persistOffProductIfNeeded()` übernimmt Tags und OFF-Zeitstempel für die unmittelbare lokale Klassifikation und den lokalen Cache. Es schreibt diese Daten nicht direkt als autoritative globale OFF-Metadaten nach Supabase, sondern stößt online die vertrauenswürdige serverseitige Anreicherung anhand der EAN an.

Lokale Produktsuche und Vorschläge müssen diese Felder ebenfalls wieder in `OpenFoodFactsProduct` einsetzen.

Die Quellen haben damit klar getrennte Rollen:

| Quelle | Rolle |
| :--- | :--- |
| Live-Suche / Barcode-API | Aktuellste Eingabe für die unmittelbare Online-Klassifikation |
| `off-dump-v2.db` | Sofortige und autoritative Produktquelle im Offline-Betrieb |
| lokaler `products`-Mirror | Cache bereits verwendeter und serverseitig synchronisierter Produkte |
| Supabase `products` | Vertrauenswürdig angereicherter globaler Online-Cache |

Unterschiedliche Datenstände dürfen unterschiedliche Empfehlungen ergeben. Identische normalisierte Tags und dieselbe `classifier_version` müssen dagegen unabhängig von der Quelle dasselbe Ergebnis liefern.

---

## 7. Deterministischer OFF-Taxonomie-Mapper

Neuer, bewusst eigenständiger und sprechend benannter Feature-Bereich:

```text
src/features/shopping-list/classification/
  classifier-version.ts
  types.ts
  shopping-category-classifier.ts
  off-category-rules.ts
  name-category-rules.ts
  normalize-shopping-name.ts
```

`classification/` enthält ausschließlich die pure, automatische Klassifikationspipeline, ihre Regeln, Normalisierung und Trace-Typen. Haushaltslernen und Sync bleiben unter `preferences/`; Darstellungsdaten der Kategorien bleiben in der bestehenden Kategorie-Domäne. Es darf keine zweite Kopie von Regeln oder Matching-Logik im Debugger, in Skripten oder in UI-Komponenten geben.

Zentrale Funktionen:

```ts
classifyCategory(input: CategoryClassifierInput): CategoryClassification;

explainCategory(input: CategoryClassifierInput): CategoryTrace;
```

Beide Funktionen verwenden dieselbe interne Auswertung. `classifyCategory()` projiziert nur das kompakte Ergebnis, während `explainCategory()` die vollständige Entscheidungskette liefert. Jede semantische Änderung an Normalisierung, Tag-Regeln, Namensregeln, Prioritäten oder Konfliktauflösung erhöht `CLASSIFIER_VERSION`.

### Regelmodell

```ts
type OffCategoryRule = {
  tag: string;
  categoryId: ShoppingCategoryId;
  priority: number;
};
```

Eigenschaften:

- ausschließlich kanonische OFF-Tags;
- keine Suche in übersetzten Anzeigenamen;
- keine Abhängigkeit von der Reihenfolge in `categories_tags`;
- spezifische Tags erhalten höhere Priorität als Oberkategorien;
- widersprüchliche Treffer mit gleicher höchster Priorität ergeben `null`;
- unbekannte Tags werden ignoriert.

Beispiel:

```text
en:fruit-juices        → beverages, hohe Priorität
en:beverages           → beverages, niedrige Priorität
en:porks               → deli_meat, hohe Priorität
en:meats               → deli_meat, mittlere Priorität
```

Die tatsächliche Tagliste wird anhand des erweiterten deutschen Dumps aufgebaut und geprüft, nicht aus Vermutungen heraus vollständig niedergeschrieben.

### Dump-Kalibrierung vor dem Cutover

Ein dediziertes Bun-/TypeScript-Skript (`scripts/dump_data/evaluate-categories.ts`) importiert direkt `classifyCategory()` und `explainCategory()` und lässt exakt den produktiven Classifier gegen den vollständigen deutschen Dump laufen. Python darf weiterhin Download und Transformation des OFF-Exports übernehmen, enthält aber keine zweite Klassifikationsimplementierung.

Der Evaluator ermittelt:

- Klassifikationsabdeckung gesamt und je Kategorie
- Anteil mehrdeutiger Produkte (`null` wegen Konflikt)
- Konfliktmatrix zwischen Kategoriepaaren
- 100 deterministische, hashbasierte Stichproben pro Kategorie für manuelle Sichtprüfung
- Bekannte Problemfälle (z. B. `Schwein`/`wein`, `Apfelsaft`)

Zusätzlich existiert ein kleiner kuratierter Golden-Korpus mit erwarteter Kategorie und Begründung für bekannte Grenzfälle. Die Hash-Stichprobe verwendet einen stabil definierten Produktschlüssel, sodass unveränderte Regeln und Dump-Daten bytegleich dieselbe Auswahl erzeugen.

Der generierte kompakte Evaluierungsreport wird als Nachweis-Artefakt im PR von Paket 1 eingecheckt, damit jede Regelanpassung messbar und nachvollziehbar bleibt.

---

## 8. Morphologischer Namens-Fallback

Der Fallback arbeitet ausschließlich token- und wortgrenzenbasiert.

### Normalisierung

- Unicode-Normalisierung
- Kleinschreibung
- vereinheitlichte Leerzeichen
- Trennung an Bindestrichen und Satzzeichen
- Entfernung reiner Mengen- und Einheitentokens
- Markenname bleibt zunächst Bestandteil, wird aber geringer gewichtet
- keine sprachabhängigen `\b`-Regex-Grenzen für Umlaute

### Regelarten

```ts
type NameCategoryRule = {
  value: string;
  categoryId: ShoppingCategoryId;
  match: 'word' | 'word-start' | 'word-end';
  score: number;
};
```

Vorgesehene Gewichtung:

- expliziter Tiefkühlmarker: 120
- vollständiges Wort: 100
- Wortende/Grundwort: 80
- Wortanfang/Modifier: 20
- freier Teilstring: nicht erlaubt

Beispiele:

- `schwein` als Ganzwort → Fleisch
- `schwein` als Wortanfang → `Schweinefilet`
- `wein` als Ganzwort → Getränke
- `wein` trifft nicht in `Schwein`
- `saft` als Wortende → `Apfelsaft`
- `apfel` als Wortanfang → schwacher Obst-Modifier
- `brot` als Wortende → `Vollkornbrot`
- `tiefkühl` als Wortanfang → Tiefkühlkost

Pro Kategorie zählt das stärkste Signal. Gewonnen hat nur die eindeutig höchste Kategorie. Bei Gleichstand wird `null` geliefert.

Damit kann mehrfacher Marken- oder Keyword-Text eine Kategorie nicht durch bloße Wiederholung hochscoren.

### Präzisionsregel für Erweiterungen

Eine niedrige OFF-Tag-Abdeckung führt nicht automatisch zu zusätzlichen Namensregeln. Neue Fallback-Regeln werden nur aufgenommen, wenn:

1. überprüfte False Negatives einen wiederkehrenden, fachlich eindeutigen Fall belegen;
2. der Golden-Korpus und die deterministischen Dump-Stichproben keine relevante Präzisionsverschlechterung zeigen;
3. die Regel im visuellen Category-Debugger mit Trace nachvollziehbar geprüft wurde.

Abdeckung und `Sonstiges`-Quote bleiben Beobachtungsmetriken. Releaseentscheidend ist die Qualität der Zuordnungen. Haushaltspräferenzen schließen individuelle Lücken, ohne riskante globale Heuristiken zu erzwingen.

---

## 9. Haushaltspräferenzen

Neue Feature-Schicht:

```text
src/features/shopping-list/preferences/
  api.ts
  hooks.ts
  resolve-category.ts
  normalize-preference-name.ts
```

### Lesen

Beim Hinzufügen:

1. `product_id`-Präferenz suchen.
2. Ohne Treffer normalisierten Namen suchen.
3. Danach automatisch klassifizieren.

### Schreiben

Manuelle Auswahl:

- bestehenden Präferenzeintrag lokal aktualisieren oder neu anlegen;
- Outbox-Mutation erzeugen;
- synchronisierte Kategorie am aktuellen Listeneintrag speichern;
- `category_source = 'user'`.

Wiederverwendung:

- späterer Treffer setzt `category_source = 'household_preference'`.

### Auf automatisch zurücksetzen

- Präferenz soft-deleten;
- Resolver erneut ausführen;
- neues automatisches Ergebnis am Eintrag speichern.

Das ist das logische Gegenstück zur manuellen Korrektur.

### Konflikte

- Last-Write-Wins über `updated_at`, entsprechend dem bestehenden Sync-Modell.
- Die deterministische UUIDv5 stellt sicher, dass parallele Offline-Anlagen derselben natürlichen Präferenz dieselbe Sync-Entität adressieren.
- Ein `23505` auf der natürlichen Identität darf im normalen Syncpfad nicht als Konfliktstrategie benötigt werden; der Unique Constraint ist nur die letzte Absicherung gegen fehlerhaft normalisierte Clients.
- Präferenzen sind haushaltsweit, nicht privat.
- `product_usage` wird dafür nicht verwendet.
- Store-spezifische Präferenzen werden nicht eingeführt.

---

## 10. Einkaufslisten-Workflows

Alle Erzeugungswege müssen den Resolver verwenden:

- manuelle Texteingabe;
- Produktsuche;
- Barcode-Scan;
- Häufig-/Zuletzt-Vorschläge;
- Rezepte;
- Wochenplan;
- erneutes Hinzufügen historischer Artikel.

### Hinzufügen

Formularzustand unterscheidet:

```text
automatic
manual
```

Verhalten:

- Im automatischen Modus wird bei Produkt-/Namensänderung neu klassifiziert.
- Im manuellen Modus bleibt die Auswahl erhalten.
- Produktwechsel darf eine alte manuelle Kategorie nicht unbemerkt übernehmen.
- „Automatisch“ löst neu auf.

### Bearbeiten

- `category_id` und `category_source` werden aus dem Eintrag initialisiert.
- Speichern berechnet nicht erneut über den Namen.
- Nur eine echte Kategorieänderung aktualisiert die Präferenz.
- Eine Namensänderung überschreibt eine Nutzerentscheidung nicht.

### Merge

Beim Zusammenführen gleicher Artikel:

- Menge und Rezeptnamen werden wie bisher vereinigt.
- Bestehende Nutzerkategorie bleibt unangetastet.
- Kategorien werden nach Vertrauensrang verglichen:

```text
user
household_preference
off_taxonomy
name_fallback
null
```

Ein eingehender Wert darf den vorhandenen Wert nur ersetzen, wenn er einen höheren Rang hat. Gleichrangige widersprüchliche Werte verändern die vorhandene Kategorie nicht.

### Abschluss und Historie

- `category_id` und `category_source` gehen in die Einkaufshistorie.
- Lagerortermittlung verwendet `category_id`.
- Gruppierung, Sortierung, Farbe und Anzeige lösen Labels über die ID auf.

---

## 11. UI-Checkpoint

Vor Änderungen an echten Formularen werden mehrere statische Mocks erstellt.

Mindestens drei Varianten:

1. Kategorieauswahl unter „Weitere Angaben“
2. Kompakte Kategoriezeile direkt unter der Produktauswahl
3. Kategoriezeile mit sichtbarem „Automatisch“-Status und Reset-Aktion

Darzustellen sind:

- automatische OFF-Empfehlung;
- Haushaltspräferenz;
- manuell gewählte Kategorie;
- bewusstes „Sonstiges“;
- „Auf automatisch zurücksetzen“.

Danach wird eine Variante ausgewählt. Erst dann werden Add- und Edit-Formular verändert.

Die wahrscheinlich kleinste gute UI ist ein Kategorie-Picker unter „Weitere Angaben“ mit den zwölf Kategorien, „Sonstiges“ und „Automatisch“.

### Visueller Qualitäts-Checkpoint für die Klassifikation

Unabhängig von den Formular-Mocks muss jede Änderung an OFF- oder Namensregeln im `tools/category-debugger` visuell überprüfbar sein. Der Debugger zeigt dafür:

- die deterministischen 100 Produktbeispiele je Kategorie;
- Golden-Korpus-Fälle mit Soll-/Ist-Ergebnis;
- Filter für Kategorie, `Sonstiges`, Konflikt und Namens-Fallback;
- Produktname, EAN, OFF-Tags, Kandidaten, Prioritäten und Scores;
- verworfene Kandidaten mit Begründung;
- vorherige und neue Klassifikation bei einem Regelvergleich;
- `classifier_version` und Dump-`data_version`.

Der PR enthält einen generierten HTML-/JSON-Report und gezielte Screenshots der auffälligen Fälle. Eine Regeländerung wird erst übernommen, wenn die Fehlzuordnungen visuell geprüft wurden. Eine höhere Abdeckung allein ist kein Qualitätsnachweis.

---

## 12. Offline-Dump Schema 2

### Produkttabelle

```text
code
product_name
brand
quantity
stores
categories_tags       JSON
off_last_modified_at
nutriscore
energy_kcal
fat
saturated_fat
carbohydrates
sugars
proteins
salt
```

### Metatabelle

```text
dump_meta
  schema_version
  data_version
  generated_at
  source_cursor
```

Regeln:

- `schema_version = 2`
- alte Dumps werden gelöscht und nicht migriert;
- `categories_tags` werden unverändert als JSON gespeichert;
- jeder Mapperpfad liefert dieselben Daten wie die Live-Suche;
- `quick_check` muss vor Veröffentlichung erfolgreich sein.

---

## 13. CI-Pipeline für Baselines und Deltas

Der bisherige vollständige Neubau in `.github/workflows/update_dump.yml` wird durch einen kanonischen Updateprozess ersetzt.

### Updateablauf

1. Letzte kanonische Baseline beziehungsweise aktuelle kanonische DB laden.
2. Aktuellen OFF-JSONL-Export herunterladen.
3. Export streamen.
4. Deutschland-Produkte normalisieren.
5. Neue Produkte erkennen.
6. Veränderte Produkte vergleichen und upserten.
7. Nicht mehr vorhandene oder nicht mehr Deutschland zugeordnete Produkte löschen.
8. Patch aus Upserts und Deletes erzeugen.
9. Kanonische DB aktualisieren.
10. Indizes optimieren.
11. `quick_check` ausführen.
12. Manifest, Patch und gegebenenfalls Baseline veröffentlichen.

Der vollständige OFF-Export wird auf CI weiterhin regelmäßig ausgewertet, weil es keinen verlässlich dokumentierten öffentlichen Lösch-Tombstone-/Delta-Feed gibt. Nur das Gerät erhält kleine Deltas.

### Dauerhafte kanonische CI-Datenbank

Der Zustand des Vortags darf nicht ausschließlich in einem GitHub-Actions-Cache oder einem kurzlebigen Workflow-Artefakt liegen.

Verbindliches Modell:

- Ein dediziertes rollendes GitHub Release mit festem Tag `off-dump-current` enthält `canonical.db`, `manifest.json` und deren SHA-256-Prüfsummen.
- Die Manifest-URL zeigt auf das feste Asset dieses Tags und ist unabhängig von normalen App-Releases. `releases/latest` wird nicht verwendet.
- Baselines und Patches werden als unveränderliche, versionierte Assets veröffentlicht.
- Jeder CI-Lauf lädt zuerst `canonical.db`, verifiziert sie und erzeugt daraus den nächsten Stand.
- Fehlt oder scheitert die kanonische DB, rekonstruiert der Workflow sie deterministisch aus der aktuellen Monats-Baseline und der vollständigen Patchkette.
- Der rekonstruierte Stand wird gegen die erwartete `data_version`, Prüfsumme und `PRAGMA quick_check` geprüft.
- Neue Datenassets werden vor dem Manifest veröffentlicht; das Manifest wird zuletzt ersetzt, damit Clients niemals auf noch fehlende Dateien verwiesen werden.

GitHub-Actions-Caches dürfen zusätzlich zur Beschleunigung verwendet werden, sind aber niemals Quelle der Wahrheit.

### Patch-Datenbank

```text
patch_meta
  from_version
  to_version
  schema_version
  generated_at
  upsert_count
  delete_count

product_upserts
product_deletes
```

### Release-Manifest

```json
{
  "schemaVersion": 2,
  "latestVersion": "2026-08-22",
  "baseline": {
    "version": "2026-08-01",
    "url": "...",
    "size": 0,
    "sha256": "..."
  },
  "patches": [
    {
      "from": "2026-08-01",
      "to": "2026-08-02",
      "url": "...",
      "size": 0,
      "sha256": "...",
      "upserts": 0,
      "deletes": 0
    }
  ]
}
```

### Rhythmus

- täglich oder mehrmals wöchentlich: Patch;
- monatlich: neue Baseline;
- Patchkette seit der aktuellen Baseline im Manifest;
- alte Patchketten werden nach einer neuen Baseline entfernt;
- keine Deltas von Dump-Schema 1 zu Schema 2.

---

## 14. Client-Dump-Updater

Neue getrennte Verantwortlichkeiten:

```text
off-dump/
  manifest.ts
  update-planner.ts
  patch-applier.ts
  baseline-installer.ts
  repository.ts
```

### Normaler Start

1. Vorhandenen Dump sofort attachen.
2. Offline-Suche verfügbar machen.
3. Manifest TTL-gesteuert im Hintergrund laden.
4. Updatepfad bestimmen.
5. Patchdateien in temporäre Pfade laden.
6. Metadaten und Prüfsummen validieren.
7. Patch-Datenbank attachen.
8. Patch innerhalb einer serialisierten SQLite-Transaktion anwenden.
9. `data_version` in derselben Transaktion aktualisieren.
10. Patch detachen und temporäre Datei löschen.

### Patchanwendung

```sql
insert into off_dump.products (...)
select ... from off_patch.product_upserts
on conflict(code) do update set ...;

delete from off_dump.products
where code in (
  select code from off_patch.product_deletes
);
```

Bei Fehler:

- Transaktion rollt zurück;
- alter Dump bleibt aktiv;
- `data_version` bleibt unverändert;
- nächster geplanter Versuch verwendet Backoff.

### Entscheidung Patch oder Baseline

Baseline verwenden, wenn:

- kein Dump existiert;
- Schemaversion abweicht;
- Patchkette unvollständig ist;
- Dump beschädigt ist;
- lokale Version vor der unterstützten Baseline liegt;
- gesamte Patchgröße einen festgelegten Anteil der Baseline überschreitet.

Als Startwert kann eine Grenze von 70 % der Baselinegröße verwendet und später gemessen werden.

### Sicherer Baseline-Wechsel

Die aktive Datei wird niemals direkt überschrieben.

1. Download nach `off-dump-v2.next.db`
2. Prüfsumme prüfen
3. Schema und `data_version` prüfen
4. `PRAGMA quick_check`
5. Datenbankzugriffe serialisieren
6. alten Dump detachen
7. aktive `off-dump-v2.db` in `off-dump-v2.recovery.db` umbenennen
8. neue Datei atomar als `off-dump-v2.db` aktivieren
9. neue Datei attachen
10. Recovery-Datei erst nach erfolgreichem Attach entfernen

Bei einem Absturz wird beim nächsten Start anhand der vorhandenen Active-/Next-/Recovery-Dateien ein konsistenter Zustand gewählt.

### Entwicklerbereich

Anzeigen:

- Schema-Version
- Daten-Version
- Dateigröße
- letzter Manifest-Check
- letzter erfolgreicher Patch
- letzter Fehler
- angehängter Zustand

Aktionen:

- „Jetzt aktualisieren“
- „Baseline neu installieren“
- „Integrität prüfen“

---

## 15. Tests und Evaluation

### Interaktives Testen & Debuggen ohne App (`tools/category-debugger`)

Das bestehende eigenständige Vite/React-Tool `tools/category-debugger` (Kategorie-Radar) wird direkt an die neue V2-Domänenlogik angebunden:

- **Direkter Import der Klassifikation:** Importiert `classifyCategory()` und `explainCategory()` direkt aus `src/features/shopping-list/classification/`.
- **WASM-SQLite im Browser:** Öffnet `off-dump-v2.db` (Schema 2 mit `categories_tags`) lokal via `sql.js` im Browser – kein Metro, kein Simulator, kein Backend nötig.
- **Trace-Visualisierung:** Rendert den vollständigen `CategoryTrace` statt die Entscheidungskette selbst nachzubauen: Eingabequelle und Datenversion, normalisierte Tags, sämtliche Kandidaten, Matches, Prioritäten, Namens-Tokens, Scores, verworfene Regeln, Gewinner und Konfliktgrund.
- **Ad-hoc Freitext- & Barcode-Tester:** Eingabefeld zum sofortigen Ausprobieren beliebiger Begriffe (z. B. `2 Schnitzel vom Schwein Spar Fein Küche`) mit detailliertem Token- und Score-Breakdown.
- **Schnelles CLI-Skript:** Ergänzend ein Terminal-Befehl `bun run scripts/classify.ts "<Text/EAN>"` für sekundenschnelle Ad-hoc-Checks.

### Domain-Unit-Tests

- alle zwölf Kategorie-IDs;
- OFF-Tag-Prioritäten;
- Konflikte und Gleichstände;
- unbekannte Tags;
- Wort-, Präfix- und Suffix-Matching;
- Umlaute und Bindestriche;
- Mengen und Einheiten;
- `Schwein`/`wein`;
- `Apfelsaft`;
- `Weinessig`;
- `Weinstein-Backpulver`;
- `Vollmilch`;
- `Vollkornbrot`;
- `Hähnchenbrust`;
- `Tiefkühlpizza`.
- feste UUIDv5-Testvektoren für Produkt- und Namenspräferenzen;
- äquivalente normalisierte Schlüssel erzeugen dieselbe Präferenz-ID;
- verschiedene Haushalte, Schlüsseltypen oder normalisierte Werte erzeugen verschiedene IDs.

### Dump-Evaluation

Classifier über den gesamten deutschen Dump laufen lassen und ausgeben:

- Abdeckung insgesamt;
- Verteilung je Kategorie;
- Anteil `Sonstiges`;
- Tag-Konflikte;
- Namens-Fallback-Quote;
- exakt 100 deterministische, hashbasierte Stichproben je Kategorie;
- Golden-Korpus mit Soll-/Ist-Vergleich;
- Vergleich Live-/Dump-Klassifikation derselben EAN unter Angabe von Eingabe-, Daten- und Klassifikatorversion.

Vor dem Cutover werden Fehlzuordnungen korrigiert. Lieber mehr `Sonstiges` als systematisch falsche Kategorien.

### Dump-Pipeline-Tests

- neues Produkt;
- verändertes Produkt;
- unverändertes Produkt;
- gelöschtes Produkt;
- Entfernung des Deutschland-Tags;
- ungültiges JSON;
- fehlende Kategorien;
- Patch-Metadaten;
- deterministischer Output;
- `quick_check`.

### Client-Patch-Integrationstests

Mit `node:sqlite`:

- einzelner Patch;
- Patchkette;
- Upsert;
- Delete;
- Schemamismatch;
- falsche `from_version`;
- beschädigter Patch;
- Rollback;
- Neustart nach simuliertem Abbruch;
- Baseline-Fallback;
- aktive Suche nach erfolgreichem Update.

### Sync-Tests

- Array-Spiegelung der OFF-Tags;
- Preference Insert/Update/Delete/Restore;
- LWW-Konflikt zweier paralleler Offline-Änderungen an derselben deterministischen ID;
- parallele Offline-Anlage derselben natürlichen Präferenz ohne `23505`;
- Household-Isolation;
- Offline-Outbox;
- Bootstrap auf zweitem Gerät.

### pgTAP

- Mitglied darf Präferenz lesen und schreiben;
- Nichtmitglied darf weder lesen noch schreiben;
- fremde `household_id` kann nicht eingeschleust werden;
- genau ein Preference-Key ist erforderlich;
- Eindeutigkeit der natürlichen Identität auch nach Soft Delete und Restore;
- `category_id = null` als explizites „Sonstiges“.

### Backend-Anreicherungstests

- direkte Client-Updates an globalen OFF-Feldern bleiben durch RLS verboten;
- der Backend-Prozess lädt OFF-Daten selbst und ignoriert vom Client behauptete Tags;
- ein neuerer `off_last_modified_at`-Stand wird übernommen;
- ein älterer oder identischer Stand überschreibt keine neueren Daten;
- ungültige EANs und fehlerhafte OFF-Antworten verändern den Produktdatensatz nicht;
- Rate-Limit- und Wiederholungsfälle bleiben idempotent.

### UI-Tests

Vor Änderungen an RNTL-Tests müssen die projektspezifischen RNTL-Regeln und Paketdokumentation gelesen werden.

Prüfen:

- automatische Kategorie wird angezeigt;
- manuelle Kategorie bleibt bei Namensänderung erhalten;
- „Automatisch“ löscht Präferenz;
- Editieren bewahrt bestehende Kategorie;
- bewusstes „Sonstiges“ bleibt bestehen;
- Produktwechsel löst korrekt neu auf;
- Merge überschreibt Nutzerentscheidung nicht.

---

## 16. Cutover und Entfernung des Altsystems

Nach erfolgreicher Integration:

- `guessCategory()` entfernen;
- `SUBSTRING_MIN_LENGTH` entfernen;
- alte Keyword-Struktur entfernen;
- alle Label-basierten Kategoriehelfer auf IDs umstellen;
- alte `category`-Spalten entfernen;
- alte Dump-Auswahl über „latest `.db`“ entfernen;
- direkten Download auf die aktive Datei entfernen;
- alte Dump-Dateien nicht migrieren;
- alte lokale Hauptdatenbank nicht öffnen;
- veraltete Tests löschen oder auf das neue Verhalten umstellen;
- Dokumentation und `ARCHITECTURE.md` aktualisieren.

Kein Feature-Flag und kein paralleler Produktionspfad.

---

## 17. Reviewbare Arbeitspakete

1. **Kategorie-Domäne und OFF-Parser**
   - IDs, Typen, Parser, `classification/`, Taxonomie-Mapper, Namens-Classifier, vollständiger Trace und TypeScript-Evaluation
   - `tools/category-debugger` auf neuen Classifier und Ad-hoc-Trace umstellen
   - CLI-Testskript `scripts/classify.ts`

2. **Breaking Datenmodell**
   - Supabase-Schema, `fam-v2.db`, getrennte `off-dump-v2.db`, Sync, RLS, pgTAP, generierte Typen

3. **Haushaltspräferenzen und Resolver**
   - natürliche Schlüssel, deterministische UUIDv5 samt Testvektoren, lokale/remote Mutationen, Outbox, Auflösungsreihenfolge, Merge-Regeln

4. **Offline-Dump Schema 2**
   - erweiterter Generator, Baseline, Kategorien und Metadaten
   - `tools/category-debugger` auf Dump Schema 2 (`categories_tags`) aktualisieren

5. **Delta-Pipeline**
   - rollende kanonische CI-Datenbank, rekonstruierbarer Recovery-Pfad, Patchgenerator, feste Manifest-URL, versionierte Assets und Release-Workflow

6. **Client-Updater**
   - Updateplanung, Patchanwendung, atomarer Baseline-Wechsel, Recovery

7. **UI-Mock-Checkpoint**
   - Varianten veröffentlichen und Auswahl abwarten

8. **UI und Workflow-Cutover**
   - Add/Edit, Automatisch/Sonstiges, sämtliche Erzeugungswege

9. **Entfernung des Altsystems**
   - alte Matcher, Label-Speicherung, alte Dump-Logik und Dokumentation

10. **Vertrauenswürdige OFF-Anreicherung**

- serverseitiger OFF-Fetch anhand der EAN, validierte zeitbasierte Upserts, Rate-Limits und unveränderte Client-RLS für globale OFF-Felder

Die Pakete können getrennt reviewed werden, aber der Runtime-Cutover erfolgt erst, wenn alle benötigten Teile fertig sind.

---

## 18. Abschlussverifikation & Abnahmekriterien

### Verbindliche Abnahmekriterien

Die Gesamtlösung gilt als abgenommen, wenn:

- **Versionsgebundene 4-Quellen-Parität:** Identische normalisierte Tags und derselbe Name liefern mit derselben `classifier_version` aus Live-Suche, Barcode-Scan, Offline-Dump und lokalem SQLite-Spiegel exakt dieselbe Kategorie-Empfehlung. Abweichende OFF-Datenstände werden im Trace sichtbar gemacht und gelten nicht als Determinismusfehler.
- **Stabile Snapshots:** Ein gespeicherter Einkaufslisten-, Historien- oder Bestandseintrag verändert seine Kategorie nicht allein durch ein späteres OFF-, Dump- oder Klassifikatorupdate.
- **Original-Issue behoben:** `2 Schnitzel vom Schwein Spar Fein Küche` wird online und offline zuverlässig als `deli_meat` klassifiziert.
- **Keine Komposita-Fehlmatches:** `Schwein` wird unter keinen Umständen wegen `wein` zu `beverages`; `Apfelsaft` landet bei `beverages` statt `produce`.
- **Freitext- & Produkt-Lernfähigkeit:** Manuelle Korrekturen für Barcodes (`product_id`) und Freitexteingaben (`normalized_name`) werden als Haushaltspräferenz persistiert und bei Folgeeingaben auf allen Haushaltsgeräten verwendet.
- **Deterministische Präferenzidentität:** Zwei offline arbeitende Geräte erzeugen für dieselbe natürliche Präferenz dieselbe UUIDv5. Die gemeinsamen Testvektoren sind auf allen Laufzeitpfaden grün.
- **Reverse States:** Nutzer können jede Kategorie auf „Automatisch“ zurücksetzen; die Haushaltspräferenz wird dabei sauber soft-deleted.
- **Merge-Sicherheit:** Merge, Umbenennen und Bearbeiten überschreiben bestehende manuelle Nutzerkategorien niemals.
- **Ehrliches Sonstiges:** Unvollständige oder widersprüchliche Metadaten enden ehrlich in `null` („Sonstiges“) statt geraten zu werden.
- **Atomare Offline-Updates:** Dump-Updates per Patch laufen transaktional; ein simulierter Abbruch lässt den vorherigen Zustand vollständig intakt.
- **Getrennte lokale Verantwortlichkeiten:** `fam-v2.db` enthält Haushalts-, Privat- und Sync-Daten; `off-dump-v2.db` enthält ausschließlich den öffentlichen Produktkatalog und kann unabhängig aktualisiert oder ersetzt werden.
- **Vertrauenswürdige OFF-Aktualisierung:** Clients können globale OFF-Metadaten nicht direkt verändern. Der Backend-Prozess übernimmt nur selbst geladene und neuere OFF-Daten.
- **Visuelle Regelabnahme:** Golden-Korpus, deterministische Hash-Stichproben und auffällige Trace-Differenzen wurden im Category-Debugger geprüft und als Report im PR dokumentiert.

### Tooling- & Verifikationsbefehle

```bash
bun run check
bun run typecheck
bun run test
bun run test:db
bun run db:advisors
bun run db:diff
```

Zusätzlich:

- Dump-Generator gegen einen echten OFF-Export;
- TypeScript-Evaluator gegen denselben vollständigen Dump;
- deterministischer Wiederholungslauf des Evaluators mit identischem Report;
- Patch von Baseline N auf N+1;
- Rekonstruktion der kanonischen DB aus Monats-Baseline und Patchkette;
- Integritätsprüfung der resultierenden SQLite-Datei;
- Klassifikation des Issue-Produkts online und offline;
- zweites Gerät beziehungsweise frische lokale Datenbank;
- Offline-Hinzufügen, spätere Synchronisation und Präferenzübernahme;
- parallele Offline-Erstellung derselben Haushaltspräferenz auf zwei Geräten;
- iOS- und Android-Test im Dev Client.

`bun run db:diff` muss am Ende leer sein.

---

## 19. Risikomatrix und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| :--- | :--- | :--- |
| **Niedrige OFF-Tag-Abdeckung im deutschen Dump** | Mehr Produkte enden in `Sonstiges` oder benötigen Haushaltspräferenzen. | Abdeckung beobachten, aber Regeln nur aus überprüften False Negatives erweitern. Golden-Korpus, deterministische Hash-Stichproben, visueller Trace-Review und Präzision entscheiden über die Freigabe. |
| **Regeldrift / Widersprüchliche OFF-Tags** | Falsche Zuordnungen bei neuen Produkten. | Ausschließlich kanonische Tags verwenden. Der TypeScript-Kalibrierungsreport wird bei jeder Regelanpassung reproduzierbar neu generiert und im PR visuell verglichen. |
| **Kein nativer OFF-Delta-Export** | Erschwerte inkrementelle Updates. | CI verwaltet eine kanonische SQLite-Baseline und erzeugt die SQLite-Patches (Upserts + Deletes) deterministisch selbst. |
| **Verlust des rollenden CI-Zustands** | Der nächste Patch könnte nicht korrekt erzeugt werden. | Kanonische DB in `off-dump-current` dauerhaft veröffentlichen und jederzeit deterministisch aus Monats-Baseline plus Patchkette rekonstruieren. Actions-Cache nur als Beschleunigung verwenden. |
| **Parallele Offline-Anlage derselben Präferenz** | Unique-Verletzung oder zwei widersprüchliche Sync-Entitäten. | Natürliche Identität streng normalisieren, deterministische UUIDv5 verwenden, Unique Constraint beibehalten und gemeinsame Testvektoren ausführen. |
| **Manipulierte globale OFF-Metadaten durch Clients** | Falsche Kategorien betreffen alle Haushalte. | OFF-Produkte für Clients schreibgeschützt lassen; Backend lädt OFF selbst und übernimmt ausschließlich validierte, neuere Felder. |
| **Absturz während SQLite-Baseline-Tausch** | Beschädigte lokale Offline-Datenbank. | Dreistufiges Dateihandling (`active`, `next`, `recovery`) mit `PRAGMA quick_check` vor dem Detach/Rename. |
