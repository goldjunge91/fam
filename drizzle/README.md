# Lokale SQLite-Migrationen

`src/lib/db/schemas/` enthält die lokalen Schema-Definitionen, nach Domäne
getrennt. `src/lib/db/schemas/index.ts` bündelt sie für Drizzle Kit. Neue lokale
Änderungen werden mit folgendem Befehl erzeugt:

```sh
bun run drizzle-kit generate --config drizzle.config.ts
```

Drizzle Kit schreibt die versionierten SQL-Dateien, Snapshots und das für
Metro gebündelte `local/migrations.js` nach `drizzle/local/`. Diese Dateien
werden committed und nicht manuell editiert oder umsortiert.

Die handgeschriebene Kette in `src/lib/db/migrations.ts` ist bei V21
eingefroren. `drizzle-baseline.ts` prüft deren vollständigen Schema-Fingerprint
und markiert nur die erste Drizzle-Migration als bereits ausgeführt. Alle
späteren Migrationen, beginnend mit `local_recipe_preferences`, führt
`drizzle-migrator.ts` über dieselbe serialisierte SQLite-Verbindung aus.

## Zod-Schemas

Formular- und Eingabevalidierung liegt zentral unter `src/lib/db/zod/`, zum
Beispiel `recipe-form-schema.zod.ts` und `auth.zod.ts`. Diese Schemas bilden
keine SQLite-Zeilen ab. Falls künftig DB-nahe Insert-, Select- oder
Row-Validatoren entstehen, werden sie beim zugehörigen Modul unter
`src/lib/db/schemas/` co-located.
