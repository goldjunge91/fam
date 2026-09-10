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

Die Ausgabe startet absichtlich mit `status: "published"`, damit die Rezepte
nach dem Import direkt im Katalog erscheinen. Für einen Redaktionsimport kann
`--status draft` oder `--status archived` verwendet werden. Eigene Dateien
lassen sich über `--input`, `--ingredients` und `--output` angeben.

## FoodAI

FoodAI enthält keine statische Rezeptdatenbank im Repository. Die Rezeptdatensätze entstehen erst zur Laufzeit:

- KI-Generierung aus dem aktuellen Vorrat über `/api/recipes/generate` und `/api/recipes/weekly`
- RSS-Inspiration aus GuteKueche.de beziehungsweise BBC Good Food
- TheMealDB als Laufzeit-Fallback
- Import eines Rezepts aus einer vom Nutzer angegebenen URL

Deshalb gibt es aus FoodAI keine vollständigen statischen Rezepte zu extrahieren. Die festgestellte Struktur und die Quellen sind in [foodai-static-recipe-inventory.json](./foodai-static-recipe-inventory.json) dokumentiert.

Quelle: [JiroMusik/FoodAI](https://github.com/JiroMusik/FoodAI)
