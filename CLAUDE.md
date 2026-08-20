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
- `src/features/<domain>/` — Fachlogik pro Domäne (`inventory`, `shopping-list`, `meal-planner`, `recipes`, `calorie-tracking`, `household`, `auth`, `onboarding`, `premium`, `settings`, `dashboard`, `navigation`), jeweils mit `components/`, `hooks/`, `api.ts`, `types.ts`.
- `src/components/` — geteilte, domänenlose UI-Bausteine (`screen.tsx`, `card.tsx`, `text-field.tsx`, etc.).
- `src/lib/` — Supabase-Client, Env-Handling (`env.ts`, wirft klaren Fehler bei fehlenden `EXPO_PUBLIC_*`-Variablen), lokaler DB-/Sync-Layer.

**Lokaler DB-Layer (`src/lib/db/`):** SQLite via `expo-sqlite`. `client.ts` ist bewusst **nicht** im Barrel `index.ts` re-exportiert — es ist die einzige Datei, die das native Modul lädt; würde sie mit-exportiert, zöge jeder Unit-Test, der irgendetwas aus `@/lib/db` importiert, das native Modul mit und schlüge fehl. App-Code importiert `@/lib/db/client` direkt, reine Logik nie. Migrationen laufen über `migrator.ts` + `migrations.ts` (App-interne SQLite-Schemaversion, unabhängig von den Supabase-Migrationen).


**Datenbank-Trennung (RLS):** `supabase/schemas/` ist nummeriert und lädt in dieser Reihenfolge: `01_private` → `02_profiles` → `03_households` → `04_privileges` → `05_products` → `06_household_invites` → `07_child_profiles` → `08_inventory` → `09_tracking` → `10_realtime` → `11_recipes` → `12_recipe_storage` → `13_recipe_step_storage` → `14_meal_plans` → `15_recipe_templates`. Geteilte Haushaltsdaten (Inventar, Einkaufsliste) und private Nutzerdaten (Tracking/Tagebuch) sind strikt per RLS getrennt — jede neue Tabelle braucht eigene Policies + pgTAP-Tests unter `supabase/tests/`.


**Umgebungsvariablen:** `.env` im Root, gitignored. Nur `EXPO_PUBLIC_*`-Variablen landen im Client-Bundle. Lokale Werte via `supabase status`; für Produktion ist ein eigener SMTP-Server zwingend (Supabase-Default-Mailversand ist auf 2 Mails/Stunde begrenzt und liefert seit 2026-06-03 bei neuen Free-Projekten keine anpassbaren Auth-Templates mehr). Details in `README.md`.

**Native Module:** Barcode-Scanner, SQLite, SecureStore, Notifications laufen nicht in Expo Go — Dev Client zwingend (`bash scripts/ios-dev.sh`). Nach jeder neuen nativen Dependency neu bauen, sonst `Cannot find native module`-Fehler beim Metro-Reload.

## Weiterführende Docs

- `docs/VISION.md`, `docs/ROADMAP.md`
- `.agents/rules/react-native-testing-library.md` — RNTL-Konventionen für diesen Codebase (vor Komponententests lesen)

## Agent skills

### Issue tracker

GitHub Issues (`gh`-CLI) gegen `goldjunge91/fam`. Siehe `docs/agents/issue-tracker.md`.

### Domain docs

Single-Context (`CONTEXT.md` + `docs/adr/` im Root). Siehe `docs/agents/domain.md`.
