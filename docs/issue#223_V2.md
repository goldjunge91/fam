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
  evidence?: {
    kind: 'preference' | 'off_tag' | 'name_rule';
    value: string;
  };
};
```

`evidence` dient Tests und Debugging, wird zunächst nicht synchronisiert.

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
category_source text
```

Beide Spalten erhalten Checks für die bekannten IDs beziehungsweise Quellen.

### `shopping_history`

Ebenfalls ersetzen:

```sql
category_id text,
category_source text
```

### Neue Tabelle `shopping_category_preferences`

Neue Schemadatei `supabase/schemas/21_shopping_category_preferences.sql` (nummeriert nach `08_inventory.sql` wegen der Fremdschlüssel auf `households` und `products`):

```text
id uuid primary key
household_id uuid not null
product_id uuid nullable
normalized_name text nullable
category_id text nullable
created_by uuid nullable
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
```

Regeln:

- Genau eines von `product_id` oder `normalized_name` muss gesetzt sein.
- Eindeutige aktive Präferenz pro Haushalt und Produkt.
- Eindeutige aktive Präferenz pro Haushalt und normalisiertem Namen.
- `category_id = null` ist erlaubt und bedeutet eine bewusste „Sonstiges“-Präferenz.
- Soft Delete unterstützt „Auf automatisch zurücksetzen“.

### RLS und API-Zugriff

Policies:

- Haushaltsmitglieder dürfen Präferenzen lesen.
- Haushaltsmitglieder dürfen Präferenzen anlegen und ändern.
- Mitglieder anderer Haushalte dürfen weder lesen noch schreiben.
- `household_id` darf durch ein Update nicht in einen fremden Haushalt verschoben werden.
- `USING` und `WITH CHECK` müssen beide vorhanden sein.

Für die neue Tabelle werden explizite Grants an `authenticated` gesetzt. Supabase stellt neue Tabellen seit 2026 nicht mehr zwingend automatisch über die Data API bereit; Grants und RLS sind getrennte Schutzebenen. [Supabase-Hinweis](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

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

Da keine Rückwärtskompatibilität benötigt wird, wird keine komplexe lokale Migration geschrieben.

Stattdessen:

- lokale Hauptdatenbank erhält eine neue Schema-Epoche beziehungsweise einen neuen Dateinamen;
- alter Mirror, alte Outbox und alter Sync-Cursor werden nicht übernommen;
- nach Anmeldung wird der Zustand vollständig von Supabase gebootstrapped;
- der alte OFF-Dump wird verworfen;
- Dump-Schema 1 wird grundsätzlich abgelehnt.

Lokale Tabellen erhalten:

- neue Kategorie-ID-/Quellspalten;
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

`persistOffProductIfNeeded()` reicht Tags und OFF-Zeitstempel bis zum lokalen und entfernten Produktspiegel durch.

Lokale Produktsuche und Vorschläge müssen diese Felder ebenfalls wieder in `OpenFoodFactsProduct` einsetzen.

---

## 7. Deterministischer OFF-Taxonomie-Mapper

Neues Domain-Modul:

```text
src/features/shopping-list/domain/
  shopping-category-classifier.ts
  off-category-rules.ts
  name-category-rules.ts
  normalize-shopping-name.ts
```

Zentrale Funktion:

```ts
classifyOffCategory(
  tags: readonly string[],
): CategoryClassification;
```

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

Ein dediziertes Skript (`scripts/dump_data/evaluate_categories.py`) lässt den Classifier gegen alle rund 405.000 Dump-Produkte laufen und ermittelt:

- Klassifikationsabdeckung gesamt und je Kategorie
- Anteil mehrdeutiger Produkte (`null` wegen Konflikt)
- Konfliktmatrix zwischen Kategoriepaaren
- 50 Zufallsstichproben pro Kategorie für manuelle Sichtprüfung
- Bekannte Problemfälle (z. B. `Schwein`/`wein`, `Apfelsaft`)

Der generierte Evaluierungsreport wird als Nachweis-Artefakt im PR von Paket 1 mit eingecheckt, damit jede Regelanpassung messbar und nachvollziehbar bleibt.

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

1. Download nach `off-dump.next.db`
2. Prüfsumme prüfen
3. Schema und `data_version` prüfen
4. `PRAGMA quick_check`
5. Datenbankzugriffe serialisieren
6. alten Dump detachen
7. aktive Datei in Recovery-Datei umbenennen
8. neue Datei atomar aktivieren
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

- **Direkter Import der neuen Domain:** Importiert `classifyOffCategory()` und den morphologischen Classifier direkt aus `src/features/shopping-list/domain/`.
- **WASM-SQLite im Browser:** Öffnet `off-dump.db` (Schema 2 mit `categories_tags`) lokal via `sql.js` im Browser – kein Metro, kein Simulator, kein Backend nötig.
- **Trace-Visualisierung:** Zeigt pro Produkt die exakte Entscheidungskette (welches OFF-Tag hat gematcht, welche Priorität, oder welche Namens-Tokens mit welchen Scores).
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

### Dump-Evaluation

Classifier über den gesamten deutschen Dump laufen lassen und ausgeben:

- Abdeckung insgesamt;
- Verteilung je Kategorie;
- Anteil `Sonstiges`;
- Tag-Konflikte;
- Namens-Fallback-Quote;
- mindestens 100 zufällige Stichproben je Kategorie;
- Vergleich Live-/Dump-Klassifikation derselben EAN.

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
- LWW-Konflikt;
- Household-Isolation;
- Offline-Outbox;
- Bootstrap auf zweitem Gerät.

### pgTAP

- Mitglied darf Präferenz lesen und schreiben;
- Nichtmitglied darf weder lesen noch schreiben;
- fremde `household_id` kann nicht eingeschleust werden;
- genau ein Preference-Key ist erforderlich;
- eindeutige aktive Präferenz;
- `category_id = null` als explizites „Sonstiges“.

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
   - IDs, Typen, Parser, Taxonomie-Mapper, Namens-Classifier, Evaluation
   - `tools/category-debugger` auf neuen Classifier und Ad-hoc-Trace umstellen
   - CLI-Testskript `scripts/classify.ts`

2. **Breaking Datenmodell**
   - Supabase-Schema, SQLite-Baseline, Sync, RLS, pgTAP, generierte Typen

3. **Haushaltspräferenzen und Resolver**
   - lokale/remote Mutationen, Outbox, Auflösungsreihenfolge, Merge-Regeln

4. **Offline-Dump Schema 2**
   - erweiterter Generator, Baseline, Kategorien und Metadaten
   - `tools/category-debugger` auf Dump Schema 2 (`categories_tags`) aktualisieren

5. **Delta-Pipeline**
   - kanonische CI-Datenbank, Patchgenerator, Manifest, Release-Workflow

6. **Client-Updater**
   - Updateplanung, Patchanwendung, atomarer Baseline-Wechsel, Recovery

7. **UI-Mock-Checkpoint**
   - Varianten veröffentlichen und Auswahl abwarten

8. **UI und Workflow-Cutover**
   - Add/Edit, Automatisch/Sonstiges, sämtliche Erzeugungswege

9. **Entfernung des Altsystems**
   - alte Matcher, Label-Speicherung, alte Dump-Logik und Dokumentation

Die Pakete können getrennt reviewed werden, aber der Runtime-Cutover erfolgt erst, wenn alle benötigten Teile fertig sind.

---

## 18. Abschlussverifikation & Abnahmekriterien

### Verbindliche Abnahmekriterien

Die Gesamtlösung gilt als abgenommen, wenn:

- **4-Quellen-Parität:** Dieselbe EAN aus Live-Suche, Barcode-Scan, Offline-Dump und lokalem SQLite-Spiegel liefert exakt dieselbe Kategorie-Empfehlung.
- **Original-Issue behoben:** `2 Schnitzel vom Schwein Spar Fein Küche` wird online und offline zuverlässig als `deli_meat` klassifiziert.
- **Keine Komposita-Fehlmatches:** `Schwein` wird unter keinen Umständen wegen `wein` zu `beverages`; `Apfelsaft` landet bei `beverages` statt `produce`.
- **Freitext- & Produkt-Lernfähigkeit:** Manuelle Korrekturen für Barcodes (`product_id`) und Freitexteingaben (`normalized_name`) werden als Haushaltspräferenz persistiert und bei Folgeeingaben auf allen Haushaltsgeräten verwendet.
- **Reverse States:** Nutzer können jede Kategorie auf „Automatisch“ zurücksetzen; die Haushaltspräferenz wird dabei sauber soft-deleted.
- **Merge-Sicherheit:** Merge, Umbenennen und Bearbeiten überschreiben bestehende manuelle Nutzerkategorien niemals.
- **Ehrliches Sonstiges:** Unvollständige oder widersprüchliche Metadaten enden ehrlich in `null` („Sonstiges“) statt geraten zu werden.
- **Atomare Offline-Updates:** Dump-Updates per Patch laufen transaktional; ein simulierter Abbruch lässt den vorherigen Zustand vollständig intakt.

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
- Patch von Baseline N auf N+1;
- Integritätsprüfung der resultierenden SQLite-Datei;
- Klassifikation des Issue-Produkts online und offline;
- zweites Gerät beziehungsweise frische lokale Datenbank;
- Offline-Hinzufügen, spätere Synchronisation und Präferenzübernahme;
- iOS- und Android-Test im Dev Client.

`bun run db:diff` muss am Ende leer sein.

---

## 19. Risikomatrix und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| :--- | :--- | :--- |
| **OFF-Tag-Abdeckung im deutschen Dump < 60 %** | Namens-Fallback trägt mehr Last als erwartet. | Das Evaluierungsskript aus Paket 1 misst die Abdeckung vor dem Cutover. Liegt sie unter 60 %, werden die Token-Regeln des Fallbacks erweitert. |
| **Regeldrift / Widersprüchliche OFF-Tags** | Falsche Zuordnungen bei neuen Produkten. | Ausschließlich kanonische Tags verwenden. Der Kalibrierungsreport wird bei jeder Regelanpassung neu generiert und im PR verglichen. |
| **Kein nativer OFF-Delta-Export** | Erschwerte inkrementelle Updates. | CI verwaltet eine kanonische SQLite-Baseline und erzeugt die SQLite-Patches (Upserts + Deletes) deterministisch selbst. |
| **Absturz während SQLite-Baseline-Tausch** | Beschädigte lokale Offline-Datenbank. | Dreistufiges Dateihandling (`active`, `next`, `recovery`) mit `PRAGMA quick_check` vor dem Detach/Rename. |

