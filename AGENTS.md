# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Code Guidelines
*Wichtig:* Jede Aenderung an bestehender UI bekommt einen eigenen Commit

# React Native Testing Library in this project

This project uses `@testing-library/react-native`. Its APIs and testing conventions can differ from your training data.
Before writing or changing RNTL tests, read the relevant guide in
`node_modules/@testing-library/react-native/docs/`, starting with
`node_modules/@testing-library/react-native/docs/guides/llm-guidelines.md`.
Prefer those package docs over stale assumptions, and follow deprecation notices.
also make sure to read `.agents/rules/react-native-testing-library.md` for react native testing library rules and guidelines.


# Datenbank: ausschliesslich Declarative Schema

**Migrationsdateien unter `supabase/migrations/` werden niemals von Hand
erstellt oder bearbeitet.** Kein `supabase migration new` mit anschliessendem
Selberschreiben, keine "schnelle Korrektur" in einer bestehenden Datei.

Der Ablauf ist immer:

1. Gewuenschten **Endzustand** in `supabase/schemas/*.sql` eintragen
2. `supabase db diff -f <name>` erzeugt die Migration
3. Generierte Migration reviewen
4. `supabase db reset` (lokal) bzw. `supabase db push` (remote)

Zum Ausprobieren waehrend der Entwicklung `supabase db query` bzw. das
MCP-Werkzeug `execute_sql` verwenden — **nicht** `apply_migration`: das schreibt
bei jedem Aufruf einen Eintrag in die Migrationshistorie und macht spaetere
Diffs leer oder widerspruechlich.

**Warum:** Handgeschriebene Migrationen und generierte Diffs laufen
auseinander. Sobald beides gemischt wird, ist der tatsaechliche Schemazustand
nur noch aus der Historie rekonstruierbar statt an einer Stelle ablesbar.

**Reihenfolge:** Die Dateien in `supabase/schemas/` laufen lexikografisch.
Bei Fremdschluessel-Abhaengigkeiten muss die Elterntabelle zuerst kommen —
entweder ueber die Namensgebung (`01_...`, `02_...`) oder ueber eine explizite
Liste in `schema_paths` in `config.toml`.

## Diff-Engine: immer `pg-delta`

**Nur ueber `bun run db:diff` diffen** — das Script setzt `--use-pg-delta`.

Die Wahl der Engine ist nicht kosmetisch. Die aeltere `migra` (in manchen
CLI-Versionen noch Default) erfasst weder Schema-Privilegien noch
Funktions-Grants noch Kommentare. Schlimmer: Weil sie die Supabase-Default-
Grants auf Tabellen nicht kennt, erzeugt sie Migrationen, die
`revoke ... on public.<tabelle> from authenticated` enthalten — wer die
anwendet, sperrt die App aus.

`pg-delta` erfasst Tabellen, Policies, Trigger, Indizes, Constraints,
Kommentare, Schema-Privilegien und Funktions-Grants. Damit gehoert **alles** in
`supabase/schemas/`; eine handgeschriebene Migration ist nicht noetig.

Gegengeprueft (CLI 2.111, lokal): `pg-delta` erzeugte eine vollstaendige
Migration und meldete danach einen leeren Diff — der Workflow ist idempotent.

### Trotzdem nicht erfasst

Quelle: [Known caveats](https://supabase.com/docs/guides/local-development/declarative-database-schemas#known-caveats).
`create policy` **wird** erfasst — die verbreitete Aussage "RLS wird nicht
gediffed" ist zu pauschal. Offen bleiben:

| Objekt                             | Konsequenz fuer dieses Projekt                    |
| ---------------------------------- | ------------------------------------------------- |
| `alter policy` (Umbenennen)        | Policies nie umbenennen — immer `drop` + `create` |
| `alter publication … add table`    | trifft #44 (Realtime)                             |
| DML (`insert`/`update`/`delete`)   | trifft Seed-Daten → `supabase/seed.sql`           |
| Materialized Views, View-Ownership | bisher nicht verwendet                            |

### Nach jeder Schemaaenderung

```bash
bun run db:diff -- -f beschreibender_name   # Migration erzeugen
bun run db:reset                            # anwenden
bun run test:db                             # pgTAP-Suite
bun run db:advisors                         # Security- und Performance-Linter
bun run db:diff                             # muss jetzt LEER sein
```

Der letzte Schritt ist der wichtigste: Ist der Diff nach dem Anwenden nicht
leer, weichen Schemadateien und Datenbank voneinander ab — dann stimmt die
Deklaration nicht mehr.

## Datenbanktests

**Keine Wegwerf-SQL im Shell.** Datenbankverhalten wird in `supabase/tests/`
als pgTAP-Suite geprueft, nicht mit einmaligen `docker exec psql`-Aufrufen.

- `supabase/tests/helpers.sql` — Werkzeug (`create_user`, `authenticate_as`,
  `as_postgres`, `authenticate_as_anon`), keine Assertions
- `supabase/tests/NN_thema.test.sql` — je eine Suite, eingebunden per `\ir helpers.sql`

Zwei Fallstricke, die beim Aufbau aufgetreten sind:

- **Rollenwechsel wirkt nur in einer Transaktion.** Ausserhalb laeuft alles
  weiter als `postgres` — und der umgeht RLS, sodass jeder Test faelschlich
  gruen waere. pgTAP kapselt jede Datei in eine Transaktion, deshalb passt es.
- **`reset role`, nicht `set role postgres`.** Letzteres scheitert mit
  "permission denied to grant role postgres".

### Remote

`supabase test db --linked` funktioniert **nicht**: Die Verbindung nutzt eine
Rolle ohne CREATE-Recht auf der Datenbank, das Anlegen des `tests`-Schemas
scheitert. Gegen das verlinkte Projekt laufen stattdessen die
Rechte-Zusicherungen:

```bash
bun run db:push   # pusht und prueft danach automatisch
```

Das ist nicht bloss Bequemlichkeit: Auf dem Remote vergeben
ALTER DEFAULT PRIVILEGES `EXECUTE` an `anon` fuer jede neue public-Funktion.
Bisher zweimal zugeschlagen — bei `create_household` und `redeem_invite`.
