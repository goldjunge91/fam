Im Marco. Your my agent. we will be working together a lot, so i thought it would be worth introducing myself.

i love to build. i focus on building complex things as simple as possible. i love to find ways to reduce complexity when solving problems.

I want to share some of my preferences here so we can be more aligned as we work together.

## Coding preferences - general

- Keep things simple. Channel "yagni" energy unless told otherwise
- Typesafety is useful, take advantage of it.
- Don't be scared to propose bold ideas if they can meaningfully benefit our work.
- Be careful with destructive actions that are not explicitly requested by the user.
- Tests are good! Endless smoke tests, "regression tests" for feature deletions, etc, much less good. Tests should be focused, not slop.
- Comments are a great way to clarify functionality and how code is used. Don't comment every line, but feel free to describe (concisely) how functions are used above function definitions, classes, etc.
- Keep comments up to date! When making changes, it's important to keep things in sync.

## Coding preferences (Typescript focused)

- any is the enemy. Inferred types are our friend. Our systems should adapt to changes, instead of requiring changes everywhere.
- If your TS code looks like a Python dev wrote it, it is bad TS code.
- Avoid one-line functions that are just casting wrappers.
- Write TypeScript in ways that Matt Pocock and Theo would be proud of.
- If not already specified in project, I generally like to use the following tech: Convex, Tailwind, React, Vite, pnpm
- When building more complex web and react native apps, I like to pull in Zustand, React Query, Tanstack Start, Clerk (or better-auth if selfhosting), and ArkType (or zod if perf isn't an issue)

## Questions are read-only

- A question is a request for an answer, not for changes. If the message opens with "how hard would it be", "what are your thoughts", "why does", "should we", "is it possible", "can X do Y", or otherwise asks rather than instructs: answer it, and do not edit files.
- If the answer is obvious and the change is trivial, still answer first and offer the change. Ask before making it.

# Visual and design work

- Do not edit real components first. For any non-trivial Ul, layout, or copy change, build several distinct static mocks, publish them with the html-communication skill, report the URL, and stop. Wait for a pick before implementing.
- Standing constraints: dark mode, true black (#000 ) background, white primary text. Information-dense, no decorative card/pill chrome, no light-gray subtitle lines above sections. Minimal copy. No em dashes.
- Avoid continuously repainting CSS animations (pulse, shimmer, blur, spinners); they peg the GPU on high-refresh displays.

# Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing any code.

## Pull Requests

- Make sure titles follow conventions from the repo. They should be simple and easy to understand. Conventional commit styles in projects that use them, i.e. "fix(web): new threads no longer spike CPU"
- PR descriptions should aim for simplicity. Open with a minimal, clear description of the problem. Follow up with how you solved it.
- Add a blurb to the end of the PR description about what model and harness is making the changes.
- **Open a real PR, not a draft.** Drafts do not get review-bot coverage.
- **Rebase onto latest `main` before opening.** Stale branches conflict and waste a review round.
- When asked to monitor or babysit a PR: poll checks and comments newer than the last push; verify each bot finding against the source before acting on it; fix real ones and dismiss false positives with a written reason; fix Cl failures, distinguishing real breaks from known infra flakes. If nothing is new, stay quiet - do not post filler comments. Stop when the repo's review bots are green on the latest commit.
- Merge only per the disposition given in the request (merge when green, or stop and report). If none was given, report and ask.

## React Native Testing Library in this project

This project uses `@testing-library/react-native`. Its APIs and testing conventions can differ from your training data.
Before writing or changing RNTL tests, read the relevant guide in
`node_modules/@testing-library/react-native/docs/`, starting with
`node_modules/@testing-library/react-native/docs/guides/llm-guidelines.md`.
Prefer those package docs over stale assumptions, and follow deprecation notices.
also make sure to read `.agents/rules/react-native-testing-library.md` for react native testing library rules and guidelines.

## Datenbank: ausschliesslich Declarative Schema

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
