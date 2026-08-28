# Rezeptkatalog Batch-Import

Lokales redaktionelles Tool fuer den globalen Katalog.

Vom Projektverzeichnis aus starten:

```bash
EXPO_NO_DOTENV=1 dotenv -o -e .env.development.local bun run tools:recipe-catalog
```

Danach `http://localhost:8787` im Browser oeffnen. Eine `catalog.json` der
Version 1 kann dort als Datei geladen oder in das Textfeld eingefuegt werden.
Anschliessend **Validieren** und danach **Importieren** klicken. Bildpfade in
`cover` und `steps[].images` werden relativ zum Projektverzeichnis aufgeloest.
Die `.env.development.local` muss `EXPO_PUBLIC_SUPABASE_URL` und den
`SUPABASE_SECRET_KEY` enthalten.
Validierung und Import zeigen ihren Status direkt im Browser. Batch-Imports
laufen als Hintergrundjob mit Fortschrittsbalken; im Terminal werden Start,
Fortschritt, Abschluss und Fehler mit Job-ID protokolliert.
Eine fertige Vorlage liegt unter `tools/batch-import/catalog.example.json`.
Ein vollständiges Bildbeispiel mit drei Zutaten-Gruppen und zwölf Schritten liegt
unter `tools/batch-import/examples/mediterrane-gemuese-lasagne.json`.

Fuer den Altbestand reicht der Button **Vorhandene Templates importieren**. Er
liest die bestehenden `recipe_templates` inklusive Gruppen, Produkten und
Schritten, erzeugt veroeffentlichte Katalogrezepte und verwendet vorhandene
Coverbilder direkt aus `recipe-covers`, ohne eine zweite Datei anzulegen. Es werden
keine Schrittbilder erwartet, weil das alte Template-Schema keine hatte. Der
Vorgang ist ueber `template:<id>` idempotent und kann erneut ausgefuehrt werden.
Der Template-Import laeuft als Hintergrundjob; das UI zeigt Fortschritt und
aktuelles Rezept an. Doppelte `externalId` oder Slugs in JSON-Batches werden
vor dem Import abgewiesen.

Beispiel:

```json
{
  "schemaVersion": 1,
  "recipes": [{
    "externalId": "fam-spaghetti-001",
    "slug": "spaghetti-bolognese",
    "title": "Spaghetti Bolognese",
    "status": "published",
    "components": [{
      "key": "sauce",
      "name": "Bolognese",
      "items": [{"key": "meat", "ingredientName": "Hackfleisch", "grams": 500, "unit": "g"}]
    }],
    "steps": [{"position": 0, "text": "Sauce kochen.", "ingredientKeys": ["meat"]}]
  }]
}
```
