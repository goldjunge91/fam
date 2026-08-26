# Lokale SQLite-Migrationen

`src/lib/db/drizzle-schema.ts` ist die Definition des lokalen Schemas. Neue
lokale Änderungen werden mit folgendem Befehl erzeugt:

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
