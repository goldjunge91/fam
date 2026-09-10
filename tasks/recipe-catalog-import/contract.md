# Rezeptkatalog-Importvertrag

## Zweck

Der Import übernimmt die kanonischen Waivy-Rezepte in den globalen,
read-only Rezeptkatalog. Zusatzmetadaten und Bildquellen werden gespeichert,
aber von der aktuellen UI nicht dargestellt.

## Owner und Quelle

- `scripts/convert-waivy-recipes.ts` ist der Owner der Normalisierung und der
  stabilen IDs.
- Ein Waivy-Checkout wird über `--waivy-root` referenziert. Der Checkout ist
  die Quelle für die effektive Bildauflösung, nicht eine manuell gepflegte
  Kopie der Bildliste.
- Die Rezept- und Zutaten-JSON-Dateien bleiben die Eingabe für die bereits
  extrahierten Rezeptdaten.
- Lokale Bilddateien werden über `--local-images` gelesen. Der Dateiname ohne
  Erweiterung muss exakt einer Waivy-`recipe.id` entsprechen. Es gibt keine
  Titel- oder Fuzzy-Zuordnung.

## Bildauflösung

Die Bildauflösung entspricht Waivys `getRecipeImage(id)` und ihrer Reihenfolge:

1. `RECIPE_IMAGE_OVERRIDES`
2. `RECIPE_IMAGES` inklusive der dort zuletzt eingemischten Korrekturen
3. `MACRO_RECIPE_PHOTOS`, danach `GEN_RECIPE_PHOTOS`

Für jedes aufgelöste Bild werden `source_url`, `source_page_url`, `alt_text`,
`source_name`, `license`, `attribution_required`, `attribution_text` und
`verified_match` übernommen. `source_url` ist die tatsächliche Bild-URL;
`source_page_url` ist die Quell-/Attributionsseite. Eine spätere
Lizenz-/Storage-Pipeline kann daraus einen `storage_path` erzeugen.

Der Import lädt keine externen Bilder herunter und schreibt keine fremden
Bilddaten in Supabase Storage. Dadurch bleiben Bildquelle, Lizenzhinweis und
die Entscheidung über spätere lokale Speicherung getrennt.

Lokale Bilder sind davon getrennt: Das Batchformat führt `localPath` als
Importpfad und `storagePath` als stabilen Zielpfad. Der Batch-Importer lädt
`localPath` in den privaten `recipe-catalog`-Bucket hoch und speichert den
Zielpfad in `catalog_recipe_images.storage_path`. `localPath` wird nicht in
der App verwendet und ist nur Bestandteil des redaktionellen Import-JSONs.
Dateien ohne Rezept-ID im gewählten Eingabedatensatz werden als nicht
zugeordnet gemeldet und nicht hochgeladen.

## Datenvertrag

- `scripts/convert-waivy-recipes.ts` erzeugt als Ausgabe das direkt
  importierbare Format `format: fam.catalog_recipe_batch_import.v2` mit
  `schemaVersion: 2`. Die Datei kann unverändert an `/api/validate` und
  anschließend an `/api/import` von `tools/batch-import/server.ts` gesendet
  werden.
- Der produktive Standardimport setzt `status: "published"` und
  `published_at`. Ein Redaktionsimport muss `--status draft` ausdrücklich
  anfordern.
- Die Batchdatei enthält pro Rezept die verschachtelten `components`, `steps`
  und `images`. Der Batch-Importer akzeptiert `schemaVersion: 1` weiterhin für
  bestehende Importe.
- Rezeptmetadaten werden in camelCase im Importformat geführt und beim Import
  in die snake_case-Spalten des `catalog_recipes`-Schemas geschrieben.
- Zutaten führen `optional` und `source_note`; der Importer schreibt
  `source_note` in die Katalogspalte `note`.

- Bildzeilen gehören über `recipe_id` zum Katalogrezept und erhalten eine
  stabile ID aus `waivy:<recipe-id>` und ihrer Position.
- `storage_path` bleibt nullable. Ein Bild darf zunächst ausschließlich über
  `source_url` referenziert werden.
- Eine Zeile muss mindestens `storage_path` oder `source_url` besitzen.
- Die aktuelle UI verwendet nur vorhandene `storage_path`-Werte. Externe
  `source_url`-Werte bleiben für eine spätere UI oder Storage-Pipeline
  verfügbar.
- Zutaten behalten `optional` und `note` im Import-JSON als
  `optional`/`source_note`; beim Kopieren in den Haushalt wird `source_note` zu
  `note`.
- Die bestehenden Waivy-Metadaten werden im Rezept und Katalog gespeichert,
  ohne neue Darstellung in der UI.

## Prüfpunkte

- Der erzeugte Bildmanifest muss nur Rezept-IDs des importierten Katalogs
  enthalten.
- Die Anzahl der Bildzeilen entspricht der Anzahl der Rezept-IDs, die Waivys
  effektive Auflösung liefert.
- Der Import bleibt deterministisch: gleiche Waivy-Quelle und gleiche
  Eingabedaten erzeugen gleiche IDs und gleiche JSON-Werte.
- Fehlende Bilddaten sind zulässig und führen nicht zu einem erfundenen
  Fallback-Bild.
