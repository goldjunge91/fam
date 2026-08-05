# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

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

| Objekt | Konsequenz fuer dieses Projekt |
|---|---|
| `alter policy` (Umbenennen) | Policies nie umbenennen — immer `drop` + `create` |
| `alter publication … add table` | trifft #44 (Realtime) |
| DML (`insert`/`update`/`delete`) | trifft Seed-Daten → `supabase/seed.sql` |
| Materialized Views, View-Ownership | bisher nicht verwendet |

### Nach jeder Schemaaenderung

```bash
bun run db:diff -- -f beschreibender_name   # Migration erzeugen
bun run db:reset                            # anwenden
bun run db:advisors                         # Security- und Performance-Linter
bun run db:diff                             # muss jetzt LEER sein
```

Der letzte Schritt ist der wichtigste: Ist der Diff nach dem Anwenden nicht
leer, weichen Schemadateien und Datenbank voneinander ab — dann stimmt die
Deklaration nicht mehr.
