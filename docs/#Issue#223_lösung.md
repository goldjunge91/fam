# Issue #223 — Lösungsplan: Kategorisierung der Einkaufsliste

Status: Vorschlag, noch nicht umgesetzt. Es wurden keine Code-Dateien verändert.

Bezug: [#223](https://github.com/goldjunge91/fam/issues/223) (`guessCategory("2 Schnitzel vom Schwein Spar Fein Küche")` → `Getränke`).

---

## 1. Ausgangslage

### 1.1 Der gemeldete Bug

[shopping-categories.ts:406-460](src/features/shopping-list/domain-logik/shopping-categories.ts#L406-L460) teilt die Keywords einer Kategorie an `SUBSTRING_MIN_LENGTH = 4` in zwei Gruppen: kürzere Keywords laufen über `containsWholeWord()`, Keywords ab vier Zeichen matchen als freier Substring. `wein` hat exakt vier Zeichen und trifft deshalb als freier Substring in `Sch**wein**`. `deli_meat` wird in der Schleife zwar vorher geprüft, besitzt aber nur `schweinefleisch`, und das kommt im Namen nicht vor. Also gewinnt `beverages`.

Das ist strukturell: jedes deutsche Kompositum, das ein Keyword ab vier Zeichen enthält, kann so kippen. Eine Whitelist pro Fehlfall skaliert nicht.

### 1.2 Der zweite, schwerere Bug

Die Kategorie ist heute nicht editierbar, und sie wird beim Bearbeiten sogar zerstört:

- [add-item-form.tsx:85-87](src/features/shopping-list/forms/add-item-form.tsx#L85-L87): `useEffect` überschreibt `category` bei jeder Namensänderung, es gibt kein sichtbares Feld dafür.
- [edit-item-form.tsx:51](src/features/shopping-list/forms/edit-item-form.tsx#L51): jedes Speichern setzt `category: guessCategory(trimmed)` und wirft damit eine gespeicherte Kategorie weg.

Die bisherige Begründung "der Nutzer kann ja korrigieren" trifft also nicht zu. Solange das so bleibt, ist jede Fehlklassifikation für den Nutzer endgültig.

### 1.3 Die verschenkte Datenquelle

Bei Artikeln aus der Produktsuche oder vom Barcode-Scan liegt ein Open-Food-Facts-Produkt vor, aber die Kategorie wird trotzdem aus dem Freitextnamen geraten. Der einzige Kategoriebezug ist heute [open-food-facts.ts:102](src/lib/open-food-facts.ts#L102): `raw.categories.split(',')[0]`, also die erste, oft sehr allgemeine und sprachabhängige Anzeigekategorie. Verwendet wird das Feld für die Einsortierung gar nicht.

OFF liefert stattdessen `categories_tags`: kanonische, sprachunabhängige Taxonomie-IDs samt Elternkategorien (`en:pork`, `en:meats`, `en:fruit-juices`). Das ist die richtige Primärquelle.

Quellen: [OFF API](https://openfoodfacts.github.io/openfoodfacts-server/api/), [Tag-Schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_tags/), [Schema-Änderungslog](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-api-and-product-schema-change-log/).

---

## 2. Zielarchitektur

Eine deterministische Auflösungskette, absteigend nach Verlässlichkeit:

```text
1. Manuelle Wahl am Eintrag        (category_source = 'user')
2. Haushaltspräferenz zum Produkt  (category_source = 'household_preference')
3. OFF-Taxonomie (categories_tags) (category_source = 'off_taxonomy')
4. Konservativer Namens-Fallback   (category_source = 'name_fallback')
5. Sonstiges (null)
```

Das Ergebnis wird als Snapshot am Einkaufslisteneintrag gespeichert, nicht bei jeder Anzeige neu berechnet.

Die Haushaltspräferenz steht bewusst über OFF: OFF beschreibt das Produkt, eine Einkaufskategorie beschreibt den Einkaufsworkflow. Ein Haushalt sortiert Tofu, Pflanzenmilch oder Fertiggerichte legitim anders ein als unsere globale Standardzuordnung.

### Scope-Entscheidungen

| Entscheidung | Begründung |
| --- | --- |
| Keine store-spezifischen Präferenzen | Die marktspezifische Laufstrecke deckt `stores.category_order` bereits ab. `store_id` lässt sich später gezielt ergänzen. |
| Kein LLM, kein Netzaufruf beim Hinzufügen | Local-First-Säule. Der Mapper ist eine reine Funktion über bereits vorhandene Tags. |
| Keine Lernautomatik aus `product_usage` | Eine implizite Statistik, die Kategorien still ändert, ist nicht debugbar. Die explizite Haushaltspräferenz aus Baustein 4 löst denselben Bedarf sichtbar. |
| Namensheuristik bleibt, wird aber degradiert | Freitextartikel ohne Produktbezug brauchen sie weiterhin, aber nur noch als letzte Stufe. |

---

## 3. Bausteine

### Baustein 1: Stabile Kategorie-IDs statt Labels

Heute steht das deutsche Label (`"Getränke"`) in `shopping_list_items.category`, während `stores.category_order` bereits IDs (`beverages`) speichert ([shopping-categories.ts:364-390](src/features/shopping-list/domain-logik/shopping-categories.ts#L364-L390)). Zwei Repräsentationen derselben Sache.

```ts
export type ShoppingCategoryId =
  | 'produce' | 'bakery' | 'deli_meat' | 'pantry_canned' | 'pantry_dry'
  | 'breakfast' | 'snacks' | 'beverages' | 'dairy' | 'frozen'
  | 'drugstore' | 'checkout';
```

- `shopping_list_items.category` → `category_id`
- `shopping_history.category` → `category_id`
- Label, Farbe, `sortOrder`, `storageKind` bleiben reine Darstellungsdaten in `SHOPPING_CATEGORIES`.
- `sortOrderForCategory`, `storageKindForCategory`, `colorForCategory`, `distinctCategoryColors`, `effectiveSortOrder` nehmen künftig eine ID statt eines Labels; `CATEGORY_BY_LABEL` wird zu `CATEGORY_BY_ID`.
- Bestandsdaten werden einmalig per Label→ID-Mapping migriert. Unbekannte Labels werden zu `null` (Sonstiges), nicht geraten.

Damit können Labels umbenannt oder lokalisiert werden, ohne gespeicherte Daten zu beschädigen.

### Baustein 2: OFF-Taxonomie vollständig durchreichen

`OpenFoodFactsProduct.category?: string` wird zu `categoryTags: readonly string[]` ([open-food-facts.ts:9](src/lib/open-food-facts.ts#L9)).

Die Tags müssen jede Produktherkunft erreichen, sonst liefern Live-Suche, Scan und Offline-Dump unterschiedliche Ergebnisse für dieselbe EAN:

| Herkunft | Änderung |
| --- | --- |
| Live-Suche | `categories_tags` in `SEARCH_FIELDS` ([open-food-facts.ts:128](src/lib/open-food-facts.ts#L128)) |
| Barcode-Abfrage | `fields`-Parameter inkl. `categories_tags` ([open-food-facts.ts:424](src/lib/open-food-facts.ts#L424)) |
| Offline-Dump | neue Spalte `products.categories_tags` (JSON-Array) in [create_custom_dump.py:87](scripts/dump_data/create_custom_dump.py#L87) und im Lesepfad [off-dump.ts](src/lib/off-dump/off-dump.ts) |
| Lokaler Produktspiegel | SQLite-Spalte `products.off_category_tags` ([migrations.ts:80](src/lib/db/migrations.ts#L80)) |
| Supabase | `products.off_category_tags text[]` ([05_products.sql](supabase/schemas/05_products.sql)) |
| Persistierung / Sync | `persist-off-product.ts`, `entities.ts`, `serialize.ts` |

`raw.categories.split(',')[0]` entfällt ersatzlos.

**API-Version:** OFF empfiehlt inzwischen v3.6 für Produktabfragen, v2 ist deprecated. Die Volltextsuche hängt weiterhin am Legacy-Endpunkt `cgi/search.pl`. Der Versionswechsel des Barcode-Endpunkts ist eine eigene, kleine Änderung und sollte nicht mit der Taxonomie-Arbeit vermischt werden; für diesen Plan reicht es, `fields=...,categories_tags` an den bestehenden Endpunkt zu hängen.

### Baustein 3: Deterministischer Taxonomie-Mapper

Neues Domänenmodul `src/features/shopping-list/domain-logik/off-category-mapping.ts`:

```ts
export function classifyOffCategory(
  tags: readonly string[],
): ShoppingCategoryId | null;
```

Regeln nur über kanonische Tags, mit expliziter Spezifitätsstufe:

| Beispiel-Tags | Kategorie |
| --- | --- |
| `en:pork`, `en:cold-cuts`, `en:sausages` | `deli_meat` |
| `en:breads`, `en:rolls` | `bakery` |
| `en:waters`, `en:fruit-juices`, `en:sodas` | `beverages` |
| `en:milks`, `en:yogurts`, `en:cheeses` | `dairy` |
| `en:frozen-foods` | `frozen` |

Kernregel: **spezifisch schlägt allgemein.** Ein Produkt trägt gleichzeitig `en:plant-based-foods-and-beverages` und `en:fruit-juices`. Jede Regel bekommt eine Spezifitätsstufe; gewinnt die höchste. Bei gleicher Stufe und widersprüchlichen Kategorien liefert der Mapper `null` statt aufgrund der Array-Reihenfolge zu raten.

Eigenschaften: deterministisch, offline, unit-testbar, unabhängig von OFF-Anzeigetexten, kein Netz und kein LLM zur Laufzeit.

**Kalibrierung vor dem Cutover** über ein Skript (`scripts/dump_data/evaluate_categories.py` oder ein Node-Skript gegen die Dump-Datei), das den Mapper gegen alle rund 405.000 Dump-Produkte laufen lässt und ausgibt:

- Klassifikationsabdeckung gesamt und je Kategorie
- Anteil mehrdeutiger Produkte (`null` wegen Konflikt)
- Konfliktmatrix zwischen Kategoriepaaren
- 50 Zufallsstichproben pro Kategorie für manuelle Sichtprüfung
- die bekannten Fehlklassen: Schwein/Wein, Apfel/Apfelsaft

Der Report wird als Artefakt des Schritt-1-PRs mit eingecheckt, damit die Regelbasis nachvollziehbar ist.

### Baustein 4: Nutzerkorrekturen als Haushaltswissen

Neue synchronisierte Tabelle in einer neuen Schemadatei `supabase/schemas/21_shopping_category_preferences.sql` (nach `08_inventory`, wegen der FKs auf `households` und `products`; `schema_paths` in `supabase/config.toml` entsprechend ergänzen):

```sql
create table if not exists public.shopping_category_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  category_id text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, product_id)
);
```

Eigenschaften:

- Haushaltsmitglieder sehen dieselbe Zuordnung, andere Haushalte sind nicht betroffen.
- OFF-Produktdaten bleiben global und unverändert.
- RLS: Lesen und Schreiben nur für Mitglieder des Haushalts, analog `shopping_list_items` in [08_inventory.sql](supabase/schemas/08_inventory.sql).
- Dazu gehören zwingend: SQLite-Spiegel ([migrations.ts](src/lib/db/migrations.ts)), Eintrag in `ENTITIES` und `ALL_ENTITIES` ([entities.ts:23](src/lib/db/entities.ts#L23)), Outbox-Push, Pull-Cursor, pgTAP-Tests unter `supabase/tests/`.
- Reverse State: "Auf automatisch zurücksetzen" setzt `deleted_at` und löscht damit die Präferenz. Ohne das ist die Reverse-States-Regel aus AGENTS.md verletzt.

### Baustein 5: Kategorie wird editierbar

Hinzufügen und Bearbeiten bekommen eine Kategorieauswahl mit:

- den zwölf Kategorien
- Option "Automatisch"
- sichtbarer aktueller Empfehlung samt Herkunft

Verhalten:

| Situation | Ergebnis |
| --- | --- |
| Nutzer ändert nichts | Empfehlung bleibt automatisch und folgt dem Namen |
| Nutzer wählt manuell | `category_source = 'user'`, keine automatische Überschreibung mehr |
| Manuelle Wahl bei verknüpftem Produkt | zusätzlich Haushaltspräferenz speichern |
| Nutzer wählt "Automatisch" | Präferenz löschen, Kette neu auswerten |
| Nutzer ändert danach den Namen | manuelle Kategorie bleibt |
| Bearbeiten und Speichern | gespeicherte Kategorie bleibt, `guessCategory()` in [edit-item-form.tsx:51](src/features/shopping-list/forms/edit-item-form.tsx#L51) entfällt |

Das ist eine echte UI-Änderung. Nach Projektregel werden zuerst mehrere statische Mocks der Kategorieauswahl gebaut, in einem eigenen Unterordner abgelegt, per Artifact veröffentlicht und zur Auswahl vorgelegt. Erst danach wird implementiert.

### Baustein 6: Kategorie-Provenienz am Eintrag

```ts
export type CategorySource =
  | 'user'
  | 'household_preference'
  | 'off_taxonomy'
  | 'name_fallback';
```

Gespeichert als `shopping_list_items.category_source text` (nullable für Sonstiges). Das ist nicht Kosmetik, sondern Voraussetzung für korrektes Verhalten:

- Nutzerwerte dürfen nie automatisch überschrieben werden.
- Der Merge in [shopping-list-merge.ts](src/lib/db/shopping-list-merge.ts) erhöht nur die Menge und behält die bestehende Kategorie.
- Verbesserte Taxonomieregeln dürfen automatische Zuordnungen nachziehen, ohne Nutzerentscheidungen anzufassen.
- Messbar wird, wie oft OFF genügt und wie oft der Fallback greift.

### Baustein 7: Namensheuristik als letzter Fallback

`guessCategory()` bleibt, aber nur noch für Freitexteingaben, Produkte ohne OFF-Tags und unvollständige Offline-Daten. Der längenbasierte Substring-Pfad verschwindet vollständig und wird durch explizites, gewichtetes Matching ersetzt:

1. **Normalisierung:** Kleinschreibung, Mengen und Einheiten abtrennen (`2`, `500g`), Bindestriche auflösen, Füllwörter entfernen (`vom`, `aus`, `mit`).
2. **Präfixmarker mit Vorrang:** `tk-`, `tiefkühl`, `gefroren` routen direkt nach `frozen`.
3. **Gewichtetes Matching pro Token:**
   - Ganzwort-Treffer (`schnitzel`, `schwein`, `saft`): Gewicht 100
   - Wortende (`*saft`, `*brot`, `*müsli`, `*suppe`, `*butter`, `*öl`): Gewicht 80
   - Wortanfang (`apfel*` in `apfelsaft`): Gewicht 20, wirkt nur als Modifikator
   - Freie Teilstrings mitten im Wort: verboten. `wein` in `schwein` kann damit nicht mehr treffen.
4. **Auswertung:** höchste Gesamtsumme gewinnt. Gleichstand oder kein Treffer ergibt `null`.

`Apfelsaft` wird so korrekt zu `beverages` (Wortende `saft`, 80) statt `produce` (Wortanfang `apfel`, 20). `Schwein` erreicht `beverages` gar nicht mehr und trifft `deli_meat` per Ganzwort.

Da die Heuristik nicht mehr für 400.000 Produktnamen zuständig ist, darf sie klein und konservativ bleiben.

---

## 4. Offline-Dump-Lebenszyklus

Der Dump ist Teil der Lösung, nicht nur Umgebung: ohne `categories_tags` im Dump liefert der Offline-Pfad systematisch andere Kategorien als die Live-Suche.

### 4.1 Was heute problematisch ist

- [create_custom_dump.py:73](scripts/dump_data/create_custom_dump.py#L73) löscht die bestehende Datenbank, verarbeitet den kompletten OFF-Export neu und veröffentlicht eine neue SQLite-Datei. Jeder Lauf produziert einen Volldownload für alle Clients.
- [off-dump.ts:117-135](src/lib/off-dump/off-dump.ts#L117-L135) hängt beim Start die vorhandene Datei an und lädt eine neue Version anschließend direkt auf denselben Pfad. Eine angehängte SQLite-Datei unter der laufenden Connection auszutauschen ist nicht nur verschwenderisch, sondern kann den Stand beschädigen.

### 4.2 Erweiterter Dump-Inhalt

```text
products
  code, product_name, brand, quantity, stores, nutriscore, <nutrition fields>
  categories_tags   TEXT   JSON-Array kanonischer OFF-Tags
  last_modified_t   INTEGER OFF-Änderungszeitpunkt

dump_meta
  schema_version    Schema der SQLite-Datei
  data_version      enthaltener Produktstand (Datum)
  generated_at
  source_cursor
```

### 4.3 CI erzeugt kanonischen Dump plus Patch

OFF empfiehlt für größere Datenmengen die täglichen Exporte; einen stabil dokumentierten öffentlichen Delta-Export gibt es aktuell nicht, OFF nutzt intern `last_modified_t` ([OFF API](https://openfoodfacts.github.io/openfoodfacts-server/api/), [Search-a-licious](https://openfoodfacts.github.io/search-a-licious/users/tutorial/)). Also erzeugt [update_dump.yml](./.github/workflows/update_dump.yml) die Deltas selbst:

1. Vorherigen kanonischen Dump aus dem letzten Release laden.
2. Aktuellen OFF-JSONL-Export streamen.
3. Deutsche Produkte normalisieren, inklusive `categories_tags`.
4. Neue oder geänderte Produkte per Barcode upserten.
5. Gelöschte oder nicht mehr DE-zugeordnete Produkte entfernen.
6. Patch aus dem Unterschied erzeugen.
7. Dump und Patch validieren (`quick_check`, Zeilenzahlen, Stichproben).
8. Patch und Manifest veröffentlichen.

Der Volllauf bleibt nötig, weil der Export keine verlässlichen Lösch-Tombstones garantiert. Der Unterschied ist nur, dass daraus nicht jedes Mal eine neue Client-Volldatei wird.

### 4.4 Patch-Format

SQLite-Patch statt großer JSON-Datei:

```text
patch_meta      from_version, to_version, schema_version, upsert_count, delete_count
product_upserts gleiche Spalten wie off_dump.products
product_deletes code
```

Die App hängt beide Dateien an und lässt SQLite den Bulk-Import machen:

```sql
insert into off_dump.products (...)
select ... from off_patch.product_upserts
on conflict(code) do update set ...;

delete from off_dump.products
where code in (select code from off_patch.product_deletes);
```

Keine großen JavaScript-Arrays im Speicher.

### 4.5 Release-Manifest

```json
{
  "schemaVersion": 2,
  "latestVersion": "2026-08-22",
  "baseline": { "version": "2026-08-01", "url": "...", "sha256": "...", "size": 123456789 },
  "patches": [
    { "from": "2026-08-01", "to": "2026-08-02", "url": "...", "sha256": "...", "size": 123456 }
  ]
}
```

Die Version steht zusätzlich in `dump_meta` innerhalb der Datei, damit Dateiinhalt und `app_meta` nicht unbemerkt auseinanderlaufen.

### 4.6 Update auf dem Gerät

1. Vorhandenen Dump sofort für die Offline-Suche nutzen.
2. Manifest TTL-gesteuert im Hintergrund prüfen (bestehendes `CHECK_TTL_MS`-Gate).
3. Patchkette von lokaler zu neuester Version bestimmen.
4. Patches in temporäre Dateien laden.
5. Prüfsumme, Schema und `from_version` validieren.
6. Patches nacheinander je in einer SQLite-Transaktion anwenden.
7. `data_version` in derselben Transaktion mitschreiben.
8. Bei Fehler zurückrollen, alte Version weiterverwenden.

Ein Absturz mitten im Patch beschädigt den vorherigen Stand nicht, weil Produktänderung und Versionswechsel in derselben Transaktion liegen.

### 4.7 Wann trotzdem eine Baseline geladen wird

Erster Download, neue `schema_version`, fehlende oder beschädigte Datei, lokale Version älter als die unterstützte Patchkette, Patchsumme größer als die Baseline, manueller Entwickler-Reparaturlauf.

Auch dann wird die aktive Datei nicht überschrieben:

1. als `off-dump.next.db` herunterladen
2. `quick_check`, Schema, Version, Prüfsumme validieren
3. aktive Datenbank kontrolliert detachen
4. Dateien atomar tauschen
5. neue Datei attachen
6. alte Datei erst danach entfernen

Die bisherige Version bleibt bis zum erfolgreichen Wechsel als Recovery-Datei liegen.

### 4.8 Veröffentlichungsrhythmus

Täglich bis mehrmals wöchentlich ein Patch, monatlich eine neue Baseline plus Bereinigung der Patchkette. Die App prüft höchstens einmal täglich, lädt nur im Hintergrund bei geeigneter Verbindung, und die Suche arbeitet währenddessen mit dem vorhandenen Stand weiter.

---

## 5. Umsetzung in fünf reviewbaren Schritten

Jeder Schritt ist ein eigener PR gegen aktuelles `main`, jeder für sich lauffähig.

### Schritt 1: Taxonomie-Pipeline, kein Verhaltenswechsel

- `categories_tags` in `SEARCH_FIELDS`, Barcode-Lookup und `OpenFoodFactsProduct`
- Dump-Skript um `categories_tags` und `last_modified_t` erweitern
- `off-category-mapping.ts` mit Unit-Tests
- Kalibrierungsskript gegen den vollen Dump, Report eingecheckt

Definition of Done: `bun run check`, `bun run typecheck`, `bun run test` grün; Report zeigt Abdeckung und Konflikte; die App verhält sich unverändert.

### Schritt 2: Datenmodell

- `category` → `category_id`, neue Spalte `category_source` in `shopping_list_items` und `shopping_history`
- `products.off_category_tags text[]`
- `shopping_category_preferences` inklusive RLS
- SQLite-Migration, `ENTITIES`/`ALL_ENTITIES`, Outbox, Pull, Mirror-Write
- Label→ID-Backfill für Bestandszeilen

Definition of Done: `bun run db:diff -- -f shopping_category_ids` erzeugt die Migration, `bun run db:reset`, `bun run test:db` mit neuen pgTAP-Tests, `bun run db:advisors` sauber, `bun run db:diff` danach leer, `bun run db:types`.

### Schritt 3: UX-Mocks und Kategorieauswahl

- mehrere statische Varianten der Kategorieauswahl, als Artifact veröffentlicht
- nach Auswahl: Implementierung in `add-item-form.tsx` und `edit-item-form.tsx`
- `guessCategory()`-Aufruf beim Speichern entfernen

Definition of Done: Auswahl getroffen und implementiert; Kategorie überlebt Bearbeiten und Umbenennen; RNTL-Tests nach `.agents/rules/react-native-testing-library.md`.

### Schritt 4: Cutover der Auflösungskette

- `resolveCategory()` als einziger Einstiegspunkt, Kette aus Abschnitt 2
- neue Namensheuristik aktiv, alter längenbasierter Matcher entfernt
- Merge-Regeln abgesichert

Definition of Done: alle Abnahmekriterien aus Abschnitt 7 erfüllt.

### Schritt 5: Dump-Delta-Pipeline

Kann parallel zu Schritt 3 und 4 laufen, hängt nur an Schritt 1.

- `dump_meta`, Patch-Erzeugung, Manifest in `update_dump.yml`
- Client: Patchkette, transaktionale Anwendung, atomarer Baseline-Tausch mit Detach

Definition of Done: Patch-Anwendung und Rollback in Integrationstests; Baseline-Tausch tauscht nie unter aktiver Connection.

---

## 6. Migrations- und Kompatibilitätsstrategie

- **Alte Clients:** Zwischen Schritt 2 und der App-Auslieferung lesen ältere Installationen weiterhin `category`. Deshalb wird die Spalte zunächst nur ergänzt, der Backfill läuft mit, und die alte Spalte wird erst in einem späteren Release entfernt. Kein Rename in einem Zug.
- **Unbekannte Labels** beim Backfill werden `null`, nicht geraten.
- **Dump-Schemawechsel** erzwingt ohnehin eine neue Baseline, alte Clients bleiben auf `schema_version 1` bis zum App-Update.
- **`stores.category_order`** bleibt unverändert, es speichert bereits IDs.

---

## 7. Abnahmekriterien

Die Lösung ist fertig, wenn:

- `2 Schnitzel vom Schwein Spar Fein Küche` online und offline als `deli_meat` klassifiziert wird;
- dieselbe EAN aus Live-Suche, Barcode-Scan, Dump und lokalem Produktspiegel dieselbe Empfehlung liefert;
- `Schwein` unter keinen Umständen wegen `wein` zu `beverages` wird;
- `Apfelsaft` über OFF beziehungsweise den Fallback zu `beverages` wird;
- Nutzer die Kategorie beim Hinzufügen und Bearbeiten ändern und auf "Automatisch" zurücksetzen können;
- eine Korrektur auf einem zweiten Gerät desselben Haushalts wiederverwendet wird und andere Haushalte nicht beeinflusst;
- Merge, Umbenennen und Bearbeiten eine Nutzerkategorie nie überschreiben;
- fehlende oder widersprüchliche Metadaten ehrlich in Sonstiges enden statt geraten zu werden;
- ein Dump-Update als Patch ankommt und ein Abbruch mittendrin den vorherigen Stand intakt lässt.

---

## 8. Risiken und offene Punkte

| Risiko | Umgang |
| --- | --- |
| OFF-Tagabdeckung für DE-Produkte unbekannt | Schritt 1 misst sie vor dem Cutover. Bleibt sie unter etwa 60 Prozent, trägt der Namens-Fallback mehr Last als geplant und braucht mehr Regelarbeit. |
| Regelpflege des Mappers wächst | Nur kanonische Tags, keine Anzeigetexte. Der Kalibrierungsreport zeigt bei jeder Regeländerung die Auswirkung. |
| Spaltenumbenennung trifft viele Aufrufer | Schritt 2 ergänzt statt umzubenennen, Entfernung der Altspalte in einem eigenen späteren PR. |
| Delta-Pipeline ist eigenständige Komplexität | Als Schritt 5 abgetrennt. Die Kategorisierung funktioniert auch ohne sie, nur mit den bisherigen Volldownloads. |
| Kein öffentlicher OFF-Delta-Export | Wir erzeugen Deltas selbst aus zwei aufeinanderfolgenden Volldumps. |
