# Rezeptextraktion

Extrahiert am 10. September 2026 aus den `main`-Branches der beiden öffentlichen Repositories.

## Waivy

Die aktuellen TypeScript-Quellen enthalten zwei relevante Mengen:

- `ALL_RECIPES`: 9.639 Datensätze. Enthält auch Makrovarianten und alle Rezeptdatensätze aus den eingebundenen Quellen.
- `CATALOG_RECIPES`: 7.641 Datensätze. Deduplizierter Katalog für die browsebare Rezeptauswahl.

Die JSON-Dateien enthalten die vollständigen Rezeptobjekte inklusive Zutaten, Mengen, Schritten, Zeiten, Tags, Kosten- und Nährwertfeldern, soweit sie in der Quelle vorhanden sind.

- [waivy-all-recipes.json](./waivy-all-recipes.json)
- [waivy-catalog-recipes.json](./waivy-catalog-recipes.json)
- [waivy-recipe-index.csv](./waivy-recipe-index.csv)
- [waivy-recipe-images.json](./waivy-recipe-images.json)

Die Bilddatei wird direkt aus dem geklonten Waivy-Checkout erzeugt. Sie folgt
der echten `getRecipeImage`-Auflösung: Overrides, kuratierte Bilder und danach
Makro-/generierte Fallbacks. Für den aktuellen Katalog sind 7.620 Bildquellen
aufgelöst; 21 der 7.641 Katalogrezepte haben keine Zuordnung. Davon sind 662
die redaktionell hervorgehobenen `hasPhoto`-Bilder aus Waivys Katalog-CSV. Die
weiteren Zuordnungen sind Waivys vorhandene Web-/Makro-Fallbacks.

Die im Waivy-Repository liegende `docs/catalog/all-recipes.csv` wurde nicht als Primärquelle verwendet. Sie enthält 7.214 Zeilen und ist gegenüber dem aktuellen TypeScript-Katalog veraltet.

Quelle: [justinsuo/waivy](https://github.com/justinsuo/waivy)

## Konvertierung in den Haushaltsapp-Katalog

Das Konvertierungsscript überführt den deduplizierten Waivy-Katalog in das
direkt importierbare Batchformat `fam.catalog_recipe_batch_import.v2` aus
`tools/batch-import/server.ts`. Es erzeugt stabile UUIDs innerhalb der
verschachtelten Rezeptdaten, Rezept-, Zutaten-, Komponenten- und Schrittwerte
sowie Bildmetadaten und Warnungen für approximierte oder unbekannte Waivy-Einheiten. Die
zusätzlichen Waivy-Metadaten werden als `prep_time_minutes`,
`storage_instructions`, `reheating_instructions`, Kosten-/Gesundheitstipps,
Substitutionen, Air-Fryer- und Variantenfelder sowie `meal_prep_friendly`
übernommen. Zutaten behalten `optional` und `source_note`; beim Datenbankimport
wird `source_note` in die Spalte `note` geschrieben. Der Importer akzeptiert
ältere `schemaVersion: 1`-Dateien weiterhin.

```bash
bun scripts/extract-waivy-recipe-images.ts --waivy-root /private/tmp/waivy-source
bun scripts/convert-waivy-recipes.ts --local-images assets/rezepte/waivy-recipe-photos
# alternativ: Bildquellen direkt aus dem Checkout auflösen
bun scripts/convert-waivy-recipes.ts --waivy-root /private/tmp/waivy-source --local-images assets/rezepte/waivy-recipe-photos
```

Standardeingaben und Ausgabe:

- [waivy-catalog-recipes.json](./waivy-catalog-recipes.json)
- [waivy-ingredients.json](./waivy-ingredients.json)
- [waivy-recipe-images.json](./waivy-recipe-images.json)
- [waivy-fam-catalog-import.json](./waivy-fam-catalog-import.json)

Der Bildimport übernimmt nur URLs und Lizenz-/Attributionsmetadaten. Er lädt
keine externen Bilder herunter. Lokale Waivy-Dateien werden über die exakte
Rezept-ID erkannt und als `localPath` plus stabilem `storagePath` in die
Batchdatei geschrieben. Der Batch-Importer lädt diese lokalen Dateien in den
privaten `recipe-catalog`-Bucket und schreibt den Pfad in Supabase.

Die erzeugte Datei kann direkt gegen `POST /api/validate` geprüft und danach
gegen `POST /api/import` importiert werden.

Der aktuelle deutsche Arbeitsstand
`waivy-fam-catalog-import.de.translation-validated-2547-4710.json` enthält den
vollständigen Katalog mit 7.641 Datensätzen, davon 2.164 vollständig geprüfte
deutsche Rezepte in den Bereichen `sortOrder` 2547–4710. Alle übrigen
Datensätze bleiben dort absichtlich in der Quellsprache. Die Datei ist noch
kein Importstand für die App, bis der gesamte Katalog übersetzt und validiert
ist. Sie ist der einzige behaltene konsolidierte Übersetzungszwischenstand;
fehlgeschlagene Slices und alte Zwischenstände werden nicht als
Projektdateien geführt.

Die Ausgabe startet absichtlich mit `status: "published"`, damit die Rezepte
nach dem Import direkt im Katalog erscheinen. Für einen Redaktionsimport kann
`--status draft` oder `--status archived` verwendet werden. Eigene Dateien
lassen sich über `--input`, `--ingredients` und `--output` angeben.

## Übersetzungsworkflow für Agents

Agents müssen keine eigenen Hilfsscripte schreiben. Der zentrale Runner
`scripts/recipe-translation-workflow.ts` erzeugt pro Agent einen disjunkten
Slice mit `candidate.json`, `source.json`, einer initialen `translated.json`
und `task.json`. Der Agent übersetzt nur `translated.json`; danach prüft der Runner Struktur, Rezeptanzahl,
IDs, Sortierung, Mengen, Zahlen, Einheiten, URLs und sichtbare englische
Textreste.

```bash
# 1. Einen Slice vorbereiten
bun scripts/recipe-translation-workflow.ts prepare \
  --candidate docs/recipe-extraction/waivy-fam-catalog-import.json \
  --source docs/recipe-extraction/waivy-fam-catalog-import.json \
  --from 0 --to 99 --job de-0000-0099 \
  --workdir /tmp/fam-recipe-translation

# 2. Agent übersetzt ausschließlich diese Datei:
#    /tmp/fam-recipe-translation/de-0000-0099/translated.json

# 3. Slice prüfen
bun scripts/recipe-translation-workflow.ts validate \
  --input /tmp/fam-recipe-translation/de-0000-0099/candidate.json \
  --output /tmp/fam-recipe-translation/de-0000-0099/translated.json \
  --source /tmp/fam-recipe-translation/de-0000-0099/source.json \
  --report /tmp/fam-recipe-translation/de-0000-0099/validation-report.json

# 4. Fortschritt aller vorbereiteten/geprüften Jobs anzeigen
bun scripts/recipe-translation-workflow.ts status \
  --dir /tmp/fam-recipe-translation

# 5. Nur bestandene Slices zusammenführen
bun scripts/recipe-translation-workflow.ts merge \
  --base docs/recipe-extraction/waivy-fam-catalog-import.json \
  --slices /tmp/fam-recipe-translation/de-0000-0099/translated.json \
  --reports /tmp/fam-recipe-translation/de-0000-0099/validation-report.json \
  --output /tmp/fam-recipe-translation/waivy-fam-catalog-import.de.json
```

`merge` validiert jeden Slice zusätzlich erneut anhand seines Reports und der
darin gespeicherten Eingabe-/Quellpfade. Ein manipulierter oder nachträglich
veränderter Slice wird daher nicht übernommen. `status` unterscheidet offene
Jobs (`pending`), fehlgeschlagene Prüfungen und bestandene Slices.

## FoodAI

FoodAI enthält keine statische Rezeptdatenbank im Repository. Die Rezeptdatensätze entstehen erst zur Laufzeit:

- KI-Generierung aus dem aktuellen Vorrat über `/api/recipes/generate` und `/api/recipes/weekly`
- RSS-Inspiration aus GuteKueche.de beziehungsweise BBC Good Food
- TheMealDB als Laufzeit-Fallback
- Import eines Rezepts aus einer vom Nutzer angegebenen URL

Deshalb gibt es aus FoodAI keine vollständigen statischen Rezepte zu extrahieren. Die festgestellte Struktur und die Quellen sind in [foodai-static-recipe-inventory.json](./foodai-static-recipe-inventory.json) dokumentiert.

Quelle: [JiroMusik/FoodAI](https://github.com/JiroMusik/FoodAI)
