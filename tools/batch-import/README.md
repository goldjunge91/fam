# Rezeptkatalog Batch-Import

Lokales redaktionelles Tool fuer den globalen Katalog.

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run tools:recipe-catalog
```

Danach `http://localhost:8787` oeffnen. Eine `catalog.json` der Version 1 kann
direkt als Datei geladen oder in das Textfeld eingefuegt werden. Bildpfade in
`cover` und `steps[].images` werden relativ zum Arbeitsverzeichnis aufgeloest.

Fuer den Altbestand reicht der Button **Vorhandene Templates importieren**. Er
liest die bestehenden `recipe_templates` inklusive Gruppen, Produkten und
Schritten, erzeugt veroeffentlichte Katalogrezepte und kopiert vorhandene
Coverbilder serverseitig aus `recipe-covers` nach `recipe-catalog`. Es werden
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
