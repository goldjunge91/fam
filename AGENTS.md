# Haushaltsapp (nicht der finale name)

- **Haushaltsapp** ist eine Expo- und React-Native-App für Haushalte und Familien, die geteilte Bestands- und Einkaufslisten mit einem Wöchentlichen Essensplanner und der möglichkeit privatem Kalorien-, Nährwert- und Gewichts-Tracking zu kombinieren.
- **Mental Anchor / Comparison:** Denke an Haushaltsapp als eine datenschutzorientierte, kollaborative Kombination aus _Bring!_ und _MyFitnessPal_ mit strikter Trennung zwischen Haushalts- und Privatdaten.
- **Goal:** Schnelle, zuverlässige mobile Workflows für iOS und Android mit robuster Offline-Fähigkeit und synchronisiertem Haushaltszustand.

---

## What Makes Haushaltsapp Special (1–4 Non-Negotiable Pillars)

1. **Strikte Datentrennung & RLS-Autorität:** Geteilte Haushaltsdaten (Kühlschrank, Vorrat, Einkaufszettel) und private Nutzerdaten (Tracking: Kalorien, Gewicht, Medikamente, Fasten, Vitalwerte, Workouts) sind auf Datenbankebene per Supabase RLS strikt isoliert.
2. **Ausschließlich Declaratives Datenbankschema:** Die Schemadefinitionen in `supabase/schemas/*.sql` sind die einzige Wahrheit. Migrationsdateien werden niemals manuell verfasst, sondern ausschließlich über `bun run db:diff` mit `pg-delta` generiert.
3. **Local-First & Offline-Belastbarkeit:** Lokale SQLite-Datenbank (`expo-sqlite`) mit Outbox-Sync für reibungslose Bedienung auch ohne stabile Netzverbindung.

## Verbindliche Vertragsquellen

- `AGENTS.md` besitzt Arbeitsweise, Tooling und Beitragsprozess.
- `CONSTRAINTS.md` besitzt die verbindlichen Qualitätsgrenzen und wird vor
  jeder Codeänderung gelesen. Es wird nicht abgeschwächt, um eine Änderung
  erfolgreich erscheinen zu lassen.
- `CONTEXT.md` besitzt Domänensprache und Datenbesitz.

Technisches Ist-Verhalten wird durch deklarative Schemas, Produktionscode und
gezielte Tests belegt. Eine Abweichung von einem freigegebenen Vertrag wird
geklärt und nicht stillschweigend als neuer Vertrag behandelt.

## Sprachregel

Der im Änderungsauftrag untersagte K-Begriff darf in Quelltext, Kommentaren,
Dokumentation, UI-Texten, Beads-Tasks und Commit-Nachrichten nicht verwendet
werden. Bestehende Formulierungen werden bei Berührung durch „verbindlich“,
„maßgeblich“ oder eine fachlich präzisere Bezeichnung ersetzt.

---

## Multi-Surface Layer

- **Mobile (iOS & Android):** Hauptzielplattform mit Expo SDK 57, React Native 0.86 und React 19.2. Erfordert für native Module (Kamera, Barcode-Scanner, SQLite, SecureStore, Notifications) einen Dev Client (`scripts/ios-dev.sh`); läuft nicht in Standard Expo Go.
- **Web / Edge Functions / Services:** Supabase Edge Functions (z. B. `auth-confirmed`), es gibt keine Web-Vorschau.
- **Backend & Auth:** Supabase (Postgres, GoTrue Auth, Realtime, Storage) via Docker (`supabase start`); RevenueCat für In-App-Käufe und Abonnements.
- Wir haben jetzt einen Apple-Developer-Account. iOS-Distribution über EAS (TestFlight, App Store) ist damit möglich — `eas submit` und Store-Builds (`preview-testflight`, `production`) können genutzt werden.

## Verbindliche UI-Styling-Architektur

`react-native-unistyles` v3 ist die einzige aktive Styling-Runtime — kein
NativeWind/Tailwind, kein `className`. Genau drei Owner für Design-
Entscheidungen:

1. `src/components/theme/index.ts` — Themes, Paletten, Design-Tokens
   (Abstände, Radien, Schriftmaße/-gewichte, Schatten).
2. `src/components/theme/ThemeProvider.tsx` — Präferenz `system | light |
   dark`, `useTheme()`, `useThemedStyles()`.
3. `src/constants/ui.tsx` + `src/constants/ui-shadow.ts` — gemeinsame
   semantische UI-Primitiven (Typografie, Farben, Flächen, Konturen,
   Interaktionszustände, fertige Schatten-Styles).

Feature-Komponenten erfinden keine eigene Palette/Hexfarben/Tokens — fehlende
projektweite Entscheidungen gehören in genau einen der drei Owner. Nur
Verhalten, Komposition, lokales Layout und begründete native
Integrationsgrenzen bleiben in der Feature-Komponente.

Die Grundregeln (`StyleSheet` nur aus `react-native-unistyles`, Style-Arrays
statt Spread, `StyleSheet.create((theme, rt) => ...)` für theme-abhängige
Styles) werden durch `test/conventions/unistyles-entry-convention.test.ts`,
`theme-owner-colors.test.ts` und die feature-eigenen
`*-nativewind-convention.test.ts` erzwungen — ein Verstoß fällt spätestens
dort auf.

Referenzen: Unistyles-v3-Tutorial (`docs/react-native-unistyles/v3/...`),
Projekt-Skill `.agents/skills/react-native-unistyles-v3/SKILL.md`.

---

## A Note from Marco

Im Marco. Your my agent. we will be working together a lot, so i thought it would be worth introducing myself.
i love to build. i focus on building complex things as simple as possible. i love to find ways to reduce complexity when solving problems.
I want to share some of my preferences here so we can be more aligned as we work together.
"I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising. Channel both 'measure twice, cut once' and 'yagni'. Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion._
Always ask before making changes to the codebase. If you are unsure, ask me. If you are sure, ask me anyway. I will always answer and clarify. I want to be a good partner for you, and I want to make sure we are aligned on the work we are doing together."

The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as 'hard rules', more as 'good defaults'. The developer's preferences should be able to override anything here.
_Of note: Most developer contributions are often controlled remotely. This means you should be careful about accessing data, killing dev servers, and other things that may damage the project instance that the developer is using."_

- **Override Clause:** Anweisungen in dieser Datei sind _starke Standardwerte, keine starre Dogmatik_. Explizite Anweisungen im Prompt des Maintainers überschreiben die `AGENTS.md` jederzeit.

---

## Ways to Hurt Yourself (Safety Guardrails)

- **Niemals Migrationen von Hand schreiben oder editieren:** Ändere stets `supabase/schemas/*.sql`, erzeuge die Migration mit `bun run db:diff` und wende sie mit `bun run db:reset` an.
- **Niemals `bun test` ausführen:** Führe immer `bun run test` aus. `bun test` nutzt die native Bun-Engine, ignoriert `jest.config.js` und schlägt fehl.
- **Niemals vollständige bun run Testsuite ausführen:** Führe nur die Tests aus, die du gerade ändern willst und das Abhänigkeiten zu dein änderung hat. `bun run test` ist teuer und dauert lange. Nutze `bun run test <file>` oder `bun run test:db <file>` für gezielte Tests.
- **Kein `apply_migration` oder Einweg-SQL:** Nutze für Tests die pgTAP-Suite in `supabase/tests/` via `bun run test:db`.
- **Fragen sind Read-Only:** Wenn ein Prompt mit "wie schwer wäre es", "warum passiert X", "sollten wir", "können wir" beginnt, beantworte die Frage, mache Vorschläge, aber ändere keine Dateien ohne Freigabe.
- **Keine stillen Native-Module-Installationen:** Das Hinzufügen nativer Abhängigkeiten erfordert einen Rebuild des Dev-Clients. Weise den Nutzer immer darauf hin.

---

## "Hit Every Surface" & Feature Completeness Checklist

- **RLS & Security Policies:** Jede neue Tabelle in `supabase/schemas/*.sql` muss explizite RLS-Policies und zugehörige pgTAP-Tests in `supabase/tests/` erhalten.
- **Reverse States Rule:** Zu jeder UI-Aktion (z. B. `check_item`, `add_favorite`, `archive_recipe`) muss das logische Gegenstück (`uncheck_item`, `remove_favorite`, `unarchive_recipe`) implementiert werden.
- **Typ-Synchronisation:** `src/lib/database.types.ts` ist ein automatisch erzeugtes Artefakt. Die Datei wird ausschließlich mit `bun run db:types` aus dem lokalen Supabase-Schema erstellt und niemals von Hand editiert. Nach jeder Datenbankänderung muss dieser Generator ausgeführt werden; ist die lokale Datenbank nicht verfügbar, bleibt die Änderung bis zur erfolgreichen Generierung offen.
- **Offline- & Outbox-Parität:** Schema-Erweiterungen an synchronisierten Entitäten müssen sowohl im lokalen SQLite-Schema als auch im Sync-Handler berücksichtigt werden.

---

## Tooling, Commands & CLI Quirks

- **Paketmanager:** `bun` für alle Paketoperationen und Skripte (`bun run <cmd>`).
- **Linter & Formatter:** Biome (`bun run check` zum Prüfen, `bun run check:fix` zum Beheben). Kein ESLint / Prettier. `bun run check` prüft den TypeScript-/TSX-Quellbestand mit Biome.
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`).
- **Tests:** `bun run test` (Jest Unit-Tests) und `bun run test:db` (pgTAP DB-Tests).

## Coding preferences - general

- Keep things simple. Channel "yagni" & "KISS" energy unless told otherwise
- Typesafety is useful, take advantage of it.
- Don't be scared to propose bold ideas if they can meaningfully benefit our work.
- Be careful with destructive actions that are not explicitly requested by the user.
- Tests are good! Endless smoke tests, "regression tests" for feature deletions, etc, much less good. Tests should be focused, not slop.
- Comments are a great way to clarify functionality and how code is used. Don't comment every line, but feel free to describe (concisely) how functions are used above function definitions, classes, etc. do not use it as changelog, short comments easy explained.
- Keep comments up to date! When making changes, it's important to keep things in sync.

## Coding preferences (Typescript focused)

- any is the enemy. Inferred types are our friend. Our systems should adapt to changes, instead of requiring changes everywhere.
- If your TS code looks like a Python dev wrote it, it is bad TS code.
- Avoid one-line functions that are just casting wrappers.
- Write TypeScript in ways that Matt Pocock and Theo would be proud of.
- This project already has a settled stack (state, forms, storage, lists, local DB) — see **Stack conventions in this project** below. Don't default to a different library on top of what's already there just because it's a personal favorite; the taste above is for greenfield projects that don't already have an answer.

## Stack conventions in this project

- **State management:** Zustand for client-side/UI state (`create()` stores, e.g. `src/features/onboarding/onboarding-store.ts`, sync-debug state, form-local state like `src/features/shopping-list/forms/category-form-state.ts`). React Query owns server/cache state (Supabase reads, mutations, `mutateAsync`). Don't duplicate server state into a Zustand store — pull it via React Query and keep Zustand for state that has no server-side source of truth.
- **Lists:** `@shopify/flash-list` (latest) ist die alleinige Konvention für virtualisierte Listen — RNs `FlatList` wird nicht mehr verwendet (#139, Stand 2026-08 alle Vorkommen migriert; `test/conventions/flashlist-convention.test.ts` hält das fest). `@legendapp/list` ist zwar installiert, aber unbenutzt: nicht dafür greifen. FlashList v2 braucht 
- **Gesten & UI-Thread-Animation:** `react-native-gesture-handler` für Swipe-Interaktionen (Vorbild: `inventory-item-row.tsx` mit `ReanimatedSwipeable`), `react-native-worklets`/Reanimated für Animationen auf dem UI-Thread (Vorbild: `animated-icon.tsx`, `week-grid.tsx`, `jiggle-wrapper.tsx`). Bestehendes Muster fortführen, aber nicht proaktiv auf bisher statische Stellen ausweiten.
- **Testhinweis zu FlashList:** die Liste recycelt Zeilen-Views, deshalb spiegelt die Reihenfolge im RNTL-Baum nach einem Re-Sort nicht mehr die Datenreihenfolge (visuell wird über Layout positioniert). Reihenfolge-Logik gehört in eine reine Funktion und wird dort geprüft (Vorbild: `src/features/inventory/visible-items.ts`).
- **Forms:** React Hook Form + Zod (via `@hookform/resolvers`) is the default for structured, validated forms — auth (`sign-in-form.tsx`, `sign-up-form.tsx`), profile edit, onboarding profile step, recipe creation/wizard. Simpler inline forms (e.g. `add-item-form.tsx`) still use plain `useState` and aren't required to migrate just for consistency's sake; use RHF+Zod for new forms with real validation needs, plain state for small inline inputs.
- **Device storage:** `react-native-mmkv` for local key/value storage, in two flavors — `src/lib/storage/device-storage.ts` (unencrypted, non-sensitive UI/device flags, single shared instance) and `src/lib/storage/account-storage.ts` (per-account MMKV instance, encrypted with a key generated via `expo-crypto` and held in `expo-secure-store`, torn down on sign-out/account switch). Account/session data must go through the encrypted per-account instance, never the shared device one.
- **Drizzle:** scoped to the **local SQLite mirror only** (`src/lib/db/schemas/*.ts`, `drizzle.config.ts` with `dialect: 'sqlite', driver: 'expo'`, output under `drizzle/local`). It replaces hand-written SQL for the offline/outbox layer in `src/lib/db/`. It is **not** connected to Supabase/Postgres — the backend schema stays declarative SQL (`supabase/schemas/*.sql`) generated via `bun run db:diff`, per the Non-Negotiable Pillars above. Don't reach for `drizzle-kit` against the Supabase database.

## Questions are read-only

- A question is a request for an answer, not for changes. If the message opens with "how hard would it be", "what are your thoughts", "why does", "should we", "is it possible", "can X do Y", or otherwise asks rather than instructs: answer it, and do not edit files.
- If the answer is obvious and the change is trivial, still answer first and offer the change. Ask before making it.

## Visual and design work

- Do not edit real components first. For any non-trivial Ul, layout, or copy change,ask marco if he want u to build several distinct static mocks, publish them with the html-communication skill, report the URL, and stop. Wait for a pick before implementing.
- Standing constraints: the warm fam mauve/cream palette (`src/components/theme/index.ts`, light and dark). Information-dense, no decorative card/pill chrome, no light-gray subtitle lines above sections. Minimal copy. No em dashes.

# Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing any code.

## Taste & Architectural Rules of Thumb

- **Simplicity & YAGNI:** Halte Lösungen schlank. Vermeide unnötige Abstraktionsschichten oder Wrapper-Funktionen.
- **Typesicherheit ohne `any`:** Inferenz nutzen. Typsysteme sollen sich an Änderungen anpassen. Code soll modernen TypeScript-Standards entsprechen.
- **Feature-First Struktur:** `src/app/` dient ausschließlich dem Routing (Expo Router). Fachlogik gehört nach `src/features/<domain>/`, geteilte UI nach `src/components/`. Kleine Features bleiben flach (`components/`, `hooks/`, `api.ts`, `types.ts`); sobald ein Feature spürbar wächst, wird nach Verantwortungsschicht getrennt statt alles in `components/` zu sammeln — `screens/` (Screens/Routen-Ziele), `sheets/` (Modals/Bottom-Sheets), `forms/` (Formulare & Eingabe-Bausteine), `components/` (reine Anzeige-Komponenten), `hooks/` (React-Query-/Datenzugriffs-Hooks), `domain/` (Domänen-Logik & Konfiguration ohne React). Referenz: `src/features/shopping-list/`.
- **UI & Layout:** Warme Mauve-/Creme-Palette (`src/components/theme/index.ts`, Light & Dark, siehe `docs/design-system/contracts/README.md`), semantisches Styling ausschließlich über Theme-Tokens und die drei verbindlichen UI-Quellen, kein Em-Dash in Copy, Informationsdichte vor Deko.
- **Expo SDK 57:** Vor dem Schreiben nativer Expo-Features stets die versionierte Dokumentation (<https://docs.expo.dev/versions/v57.0.0/>) konsultieren. 
- **Testing Library:** Vor Änderungen an Komponententests die Regeln in `.agents/rules/react-native-testing-library.md` beachten.

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

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
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

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See <https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md> for details and anti-patterns.

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
   bd dolt push
   git push
   git status
   ```

5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**

- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or
  markdown TODO lists.
- Keep persistent project memory in Beads via `bd remember` — do NOT create
  MEMORY.md files.
- Codex 0.129.0+ can load Beads context automatically via native hooks; use
  `/hooks` to inspect/toggle. Otherwise run `bd prime` manually.
<!-- END BEADS INTEGRATION -->

## Native Builds

Vollständige Befehlsreferenz, Schritt-für-Schritt-Anleitung und Fingerprint-
Mechanik: [`scripts/native-build/README.md`](scripts/native-build/README.md).
Hier nur die verbindlichen Grundregeln:

- Jeder Prebuild läuft mit `--no-clean` — auch in CI/EAS. Vorhandene native
  Projekte, Pods, DerivedData, Gradle-/ccache-Caches bleiben erhalten; kein
  automatisches Löschen, auch nicht bei Fehlern.
- Unveränderte native Eingaben → kein Prebuild, kein `pod install`. Reine
  JS-/TS-Änderungen laufen über Metro/Fast Refresh, nie über einen nativen
  Rebuild.
- Ein vollständiger Reset oder das Löschen von Caches braucht Marcos
  ausdrückliche Freigabe. `--approve-rebuild` gibt **nur** ein einmaliges
  inkrementelles Prebuild frei — keine Cache-Löschung.
- Config-Plugins bleiben idempotent; entferntes Plugin → dessen native
  Änderungen gezielt zurückbauen, kein pauschaler Clean-Prebuild.
- Geschwindigkeitsaussagen ("das ist jetzt schneller") nur mit Zeitmessung
  und Cache-Treffer-Beleg (`.build-metrics/builds.jsonl`).

### Erlaubte Build-Einstiege

| Zweck | Befehl |
| --- | --- |
| JS-/TS-Dev mit vorhandenem Dev Client | `bun run start -- --dev-client` |
| iOS-Simulator-Entwicklung | `bun run native:dev -- --target ios-development-simulator` |
| iOS-Geräteentwicklung | `bun run native:dev -- --target ios-development-device --device "<Name>"` |
| Android-Entwicklung | `bun run native:dev -- --target android-development` |
| Lokaler TestFlight-Build | `bun run native:rebuild -- --target ios-preview-testflight` |
| Weitere Distributionsbuilds | `bun run native:rebuild -- --target ios-production\|android-preview\|android-production` |
| Native Config aktualisieren | `bun run native:prebuild -- --platform ios\|android` (`FAM_HARNESS_UI=1` Dev / `0` Release) |

Diagnose/Artefakt-Befehle (`native:status`, `native:status -- --diff`,
`native:baseline`, `native:run`, `native:restore`) sowie Drift-Ursachen und
Freigabeprozess: siehe README oben. Ein Native-Drift wird immer zuerst mit
`native:status -- --diff` untersucht, bevor `--approve-rebuild` verwendet wird.