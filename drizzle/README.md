# Lokale SQLite-Migrationen

`src/lib/db/schemas/` enthält die lokalen Schema-Definitionen, nach Domäne
getrennt. `src/lib/db/schemas/index.ts` bündelt sie für Drizzle Kit. Neue
Schemaänderungen werden mit folgendem Projektbefehl erzeugt:

```sh
bun run db:local:generate
```

Drizzle Kit erzeugt die versionierte SQL-Datei und den Snapshot unter einem
neuen Verzeichnis in `drizzle/local/`; `drizzle/local/migrations.js` wird als
Migration-Registry aktualisiert. Alle drei Artefakte werden committed.

Die Schema-DDL in einer generierten Migration stammt von Drizzle Kit. Muss eine
Änderung zusätzlich Daten erhalten oder umformen, wird die nötige
Datenmigration manuell in derselben SQL-Datei ergänzt. Beispiel:
`20260924140706_lazy_anthem` erstellt Tabelle und Indizes für `outbox_history`
und fügt danach ein `INSERT ... SELECT` ein, das vorhandene Outbox-Einträge
übernimmt. Bereits ausgeführte Migrationen werden nicht nachträglich geändert
oder umsortiert; nötige Korrekturen kommen in eine neue Migration.

Beim Öffnen der lokalen Datenbank führt `src/lib/db/local-client.ts` den
offiziellen Drizzle-Expo-SQLite-Migrator mit `drizzle/local/migrations.js` aus.
Das geschieht direkt auf der nativen SQLite-Verbindung, bevor sie der App
bereitgestellt wird. Danach laufen App-Zugriffe über den serialisierten
Datenbank-Proxy. Der Runner führt die in `migrations.js` registrierten
Migrationen aus; eine zusätzliche handgeschriebene Runner-Kette oder ein
eigener `drizzle-migrator.ts` existiert nicht.

Hinweis zum aktuellen Bestand: `20260907120000_inventory_expiry_user_set_backfill/migration.sql`
liegt zwar im Ordner, hat aber keinen Snapshot und ist nicht in
`migrations.js` registriert. Es gibt keinen Laufzeitaufruf dafür; der normale
App-Start führt diesen Backfill daher nicht aus.

## Zod-Schemas

`src/lib/db/zod/` enthält gemeinsame Eingabe- und Formularschemas, darunter
Auth, Onboarding, Profil und Rezeptformulare. Das ist nicht der Ablageort für
alle Zod-Schemas: feature-spezifische Validierung bleibt beim zuständigen
Feature. Die Dateien unter `src/lib/db/zod/` validieren keine SQLite-Zeilen;
das lokale Datenbankschema selbst ist mit Drizzle unter
`src/lib/db/schemas/` definiert. Aktuell gibt es keine Zod-Insert-, Select- oder
Row-Validatoren für dieses SQLite-Schema.
