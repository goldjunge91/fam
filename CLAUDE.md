# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The rest of this file supplements `AGENTS.md` with commands and architecture detail that file doesn't cover.

## Commands

```bash
bun install && bun start        # Metro starten ('i' iOS, 'a' Android, 'w' Web)
bun run ios / android / web     # native Targets direkt starten
bash scripts/ios-dev.sh         # voller Dev-Client-Build+Install+Metro-Flow (siehe --reuse-last, --no-metro, --device)
```

Quality gate vor jedem Commit (siehe auch AGENTS.md "Verification"):

```bash
bun run check        # Biome lint+format + Tailwind-CSS-Validierung (src/global.css), bun run check:fix zum Beheben
bun run typecheck    # tsc --noEmit
bun run test         # Jest unit tests — NIEMALS `bun test` (nutzt Buns Runner, ignoriert jest.config.js)
bun run test:db      # pgTAP gegen lokales Postgres (nur bei Supabase-Schema-Änderungen)
```

Einzelnen Test ausführen: `bun run test -- <pfad-oder-namensmuster>` (Jest-Pattern-Matching, z. B. `bun run test -- units.test.ts`).

Weitere Testarten:

```bash
bun run test:integration   # jest.integration.config.js, *.integration.test.ts, --forceExit
bun run test:functions     # Deno-Tests für supabase/functions
bun run e2e                # Maestro-Flows gegen laufenden Simulator/Emulator (Dev Build + supabase start + Testaccount nötig)
bun run e2e:household-create / e2e:household-join / e2e:all
```

Lokales Backend:

```bash
supabase start / status / stop
supabase db reset          # Migrationen neu anwenden
bun run db:advisors        # Security/Performance-Advisors, lokal
```
Studio unter `http://localhost:54323`.

Datenbank-Workflow ist in AGENTS.md dokumentiert (`db:diff` → `db:reset` → `test:db` → `db:advisors` → `db:diff` muss leer sein → `db:types`). Migrationsdateien unter `supabase/migrations/` niemals von Hand bearbeiten — einzige Quelle der Wahrheit sind `supabase/schemas/*.sql` (Reihenfolge über `schema_paths` in `supabase/config.toml`, Elterntabellen vor Fremdschlüsseln).

Test-Accounts für lokale Entwicklung:

```bash
bash scripts/create-user-with-household.sh [anzahl|email passwort name haushalt]
bun run user:create / user:list / user:clean / user:delete
```

## Architecture

**Feature-first, drei Schichten:**
- `src/app/` — ausschließlich Expo-Router-Routing (file-based), keine Fachlogik. `(auth)/` = nicht eingeloggt, `(app)/` = Haupt-Tabs, `household/`, `settings/`, `recipe/` = verschachtelte Stacks.
- `src/features/<domain>/` — Fachlogik pro Domäne (`inventory`, `shopping-list`, `meal-planner`, `recipes`, `calorie-tracking`, `household`, `auth`, `onboarding`, `premium`, `settings`, `dashboard`, `navigation`). Kleine Features bleiben flach (`components/`, `hooks/`, `api.ts`, `types.ts`); ab spürbarer Größe wird nach Verantwortungsschicht getrennt statt alles in `components/` zu sammeln — `screens/` (Screens/Routen-Ziele), `sheets/` (Modals/Bottom-Sheets), `forms/` (Formulare & Eingabe-Bausteine), `components/` (reine Anzeige-Komponenten), `hooks/` (React-Query-/Datenzugriffs-Hooks), `domain/` (Domänen-Logik & Konfiguration ohne React). Referenz: `src/features/shopping-list/` (siehe dessen `ARCHITECTURE.md`).
- `src/components/` — geteilte, domänenlose UI-Bausteine (`screen.tsx`, `card.tsx`, `text-field.tsx`, etc.).
- `src/lib/` — Supabase-Client, Env-Handling (`env.ts`, wirft klaren Fehler bei fehlenden `EXPO_PUBLIC_*`-Variablen), lokaler DB-/Sync-Layer.

**Lokaler DB-Layer (`src/lib/db/`):** SQLite via `expo-sqlite`. `client.ts` ist bewusst **nicht** im Barrel `index.ts` re-exportiert — es ist die einzige Datei, die das native Modul lädt; würde sie mit-exportiert, zöge jeder Unit-Test, der irgendetwas aus `@/lib/db` importiert, das native Modul mit und schlüge fehl. App-Code importiert `@/lib/db/client` direkt, reine Logik nie. Migrationen laufen über `migrator.ts` + `migrations.ts` (App-interne SQLite-Schemaversion, unabhängig von den Supabase-Migrationen).


**Datenbank-Trennung (RLS):** `supabase/schemas/` ist nummeriert und lädt in dieser Reihenfolge (siehe `schema_paths` in `supabase/config.toml`): `01_private` → `02_profiles` → `03_households` → `05_products` → `06_household_invites` → `07_child_profiles` → `08_inventory` → `09_tracking` → `10_realtime` → `11_recipes` → `12_recipe_storage` → `13_recipe_step_storage` → `14_meal_plans` → `15_recipe_templates` → `16_medications_and_symptoms` → `17_fasting` → `18_vital_logs` → `19_workouts` → `20_privileges`. Geteilte Haushaltsdaten (Inventar, Einkaufsliste) und private Nutzerdaten (Tracking/Tagebuch) sind strikt per RLS getrennt — jede neue Tabelle braucht eigene Policies + pgTAP-Tests unter `supabase/tests/`.


**Umgebungsvariablen:** `.env` im Root, gitignored. Nur `EXPO_PUBLIC_*`-Variablen landen im Client-Bundle. Lokale Werte via `supabase status`; für Produktion ist ein eigener SMTP-Server zwingend (Supabase-Default-Mailversand ist auf 2 Mails/Stunde begrenzt und liefert seit 2026-06-03 bei neuen Free-Projekten keine anpassbaren Auth-Templates mehr). Details in `README.md`.

**Native Module:** Barcode-Scanner, SQLite, SecureStore, Notifications laufen nicht in Expo Go — Dev Client zwingend (`bash scripts/ios-dev.sh`). Nach jeder neuen nativen Dependency neu bauen, sonst `Cannot find native module`-Fehler beim Metro-Reload.

## Weiterführende Docs

- `docs/VISION.md`, `docs/ROADMAP.md`
- `.agents/rules/react-native-testing-library.md` — RNTL-Konventionen für diesen Codebase (vor Komponententests lesen)

## Agent skills

### Issue tracker

GitHub Issues (`gh`-CLI) gegen `goldjunge91/fam`. Siehe `docs/agents/issue-tracker.md`.

### Triage labels

Standard-Vokabular (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Siehe `docs/agents/triage-labels.md`.

### Domain docs

Single-Context (`CONTEXT.md` + `docs/adr/` im Root). Siehe `docs/agents/domain.md`.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
