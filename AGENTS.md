# Haushaltsapp (nicht der finale name)

- **Haushaltsapp** ist eine Expo- und React-Native-App für Haushalte und Familien, die geteilte Bestands- und Einkaufslisten mit einem Wöchentlichen Essensplanner und der möglichkeit privatem Kalorien-, Nährwert- und Gewichts-Tracking zu kombinieren.
- **Mental Anchor / Comparison:** Denke an Haushaltsapp als eine datenschutzorientierte, kollaborative Kombination aus _Bring!_ und _MyFitnessPal_ mit strikter Trennung zwischen Haushalts- und Privatdaten.
- **Goal:** Schnelle, zuverlässige mobile Workflows für iOS und Android mit robuster Offline-Fähigkeit und synchronisiertem Haushaltszustand.

---

## What Makes Haushaltsapp Special (1–4 Non-Negotiable Pillars)

1. **Strikte Datentrennung & RLS-Autorität:** Geteilte Haushaltsdaten (Kühlschrank, Vorrat, Einkaufszettel) und private Nutzerdaten (Tracking: Kalorien, Gewicht, Medikamente, Fasten, Vitalwerte, Workouts) sind auf Datenbankebene per Supabase RLS strikt isoliert.
2. **Ausschließlich Declaratives Datenbankschema:** Die Schemadefinitionen in `supabase/schemas/*.sql` sind die einzige Wahrheit. Migrationsdateien werden niemals manuell verfasst, sondern ausschließlich über `bun run db:diff` mit `pg-delta` generiert.
3. **Local-First & Offline-Belastbarkeit:** Lokale SQLite-Datenbank (`expo-sqlite`) mit Outbox-Sync für reibungslose Bedienung auch ohne stabile Netzverbindung.

---

## Multi-Surface Layer

- **Mobile (iOS & Android):** Hauptzielplattform mit Expo SDK 57, React Native 0.86 und React 19.2. Erfordert für native Module (Kamera, Barcode-Scanner, SQLite, SecureStore, Notifications) einen Dev Client (`scripts/ios-dev.sh`); läuft nicht in Standard Expo Go.
- **Web / Edge Functions / Services:** Supabase Edge Functions (z. B. `auth-confirmed`), Web-Vorschau via `expo start --web`, Supabase Studio (`localhost:54323`) für lokale Inspektion.
- **Backend & Auth:** Supabase (Postgres, GoTrue Auth, Realtime, Storage) via Docker (`supabase start`); RevenueCat für In-App-Käufe und Abonnements.
- Wir haben jetzt einen Apple-Developer-Account. iOS-Distribution über EAS (TestFlight, App Store) ist damit möglich — `eas submit` und Store-Builds (`preview-testflight`, `production`) können genutzt werden.

for CSS styling nativewind docs @`.claude/nativewind.dev:llms.txt`.

---

## A Note from Marco

Im Marco. Your my agent. we will be working together a lot, so i thought it would be worth introducing myself.

i love to build. i focus on building complex things as simple as possible. i love to find ways to reduce complexity when solving problems.

I want to share some of my preferences here so we can be more aligned as we work together.

> _"I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising._
>
> _Channel both 'measure twice, cut once' and 'yagni'. Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion._
>
> _The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as 'hard rules', more as 'good defaults'. The developer's preferences should be able to override anything here._
>
> _Of note: Most developer contributions are often controlled remotely. This means you should be careful about accessing data, killing dev servers, and other things that may damage the project instance that the developer is using."_

- **Override Clause:** Anweisungen in dieser Datei sind _starke Standardwerte, keine starre Dogmatik_. Explizite Anweisungen im Prompt des Maintainers überschreiben die `AGENTS.md` jederzeit.

---

## Glossary

| Term                                                   | Meaning & Dialect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`You`**                                              | Der KI-Agent, der den Code liest, plant und bearbeitet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **`We / Maintainers`**                                 | Marco und die Maintainer des Projekts (deine Gesprächspartner).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **`User`**                                             | Der Endnutzer der Haushaltsapp-App bzw. die Person, die App später verwenden wird.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **`Household (Haushalt)`**                             | Die geteilte Entität für gemeinsame Bestände, Einkaufslisten und Einladungen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **`Inventory / Fridge`**                               | Geteilter Lebensmittelbestand mit Lagerorten (Kühlschrank, Vorrat, Tiefkühler). Eigenständiger Bestandseintrag, optional angereichert durch ein Product. Siehe `CONTEXT.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`Product`**                                          | Globaler, nicht haushaltsgebundener Katalogeintrag (Barcode/Nährwerte). Keine Identität mit Inventory/Shopping-List-Items, nur optionale Anreicherung. Siehe `CONTEXT.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **`Externe Produktdatenbank (OFF / Open Food Facts)`** | Externe, quelloffene, crowdsourced Lebensmitteldatenbank (`openfoodfacts.org`, kurz **OFF**) — nicht Teil von Haushaltsapp, sondern eine Datenquelle: Produktsuche per Name/Barcode, Nährwerte, Marke, und die kanonische Kategorie-Taxonomie (`categories_tags`, z. B. `en:porks`). OFF ist die Quelle, aber nicht die Wahrheit — Treffer werden lokal übernommen/gespiegelt (`OpenFoodFactsProduct` in `src/lib/open-food-facts.ts`, `off_category_tags`/`off_last_modified_at`-Spalten auf `Product`), nie 1:1 als eigene Identität behandelt. Der Klassifikator (`src/features/shopping-list/classification/`) nutzt `categories_tags` als eines von mehreren Signalen zur automatischen Einkaufslisten-Kategorie. Details: `docs/issue#223_V2.md` Abschnitte 6–7. |
| **`Tracking`**                                         | Oberbegriff für alle privaten, per RLS isolierten Nutzerdaten (Nutrition Tracking, Medications & Symptoms, Fasting, Vital Logs, Workouts). Siehe `CONTEXT.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **`Nutrition Tracking`**                               | Ernährungs- und Gewichtsteil von Tracking: Mahlzeiten, Gewicht, Ziele. Eine Tracking-Domäne unter mehreren, kein Oberbegriff.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **`Declarative Schema`**                               | Der deklarative Schemazustand unter `supabase/schemas/*.sql`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **`Outbox`**                                           | Lokale SQLite-Warteschlange für Offline-Mutationen vor dem Push an Supabase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **`Dev Build`**                                        | Natives Binary (`scripts/ios-dev.sh`), das für native Expo-Module zwingend nötig ist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## Ways to Hurt Yourself (Safety Guardrails)

- **Niemals Migrationen von Hand schreiben oder editieren:** Ändere stets `supabase/schemas/*.sql`, erzeuge die Migration mit `bun run db:diff` und wende sie mit `bun run db:reset` an.
- **Niemals `bun test` ausführen:** Führe immer `bun run test` aus. `bun test` nutzt die native Bun-Engine, ignoriert `jest.config.js` und schlägt fehl.
- **Niemals vollständige bun run Testsuite ausführen:** Führe nur die Tests aus, die du gerade ändern willst und das Abhänigkeiten zu dein änderung hat. `bun run test` ist teuer und dauert lange. Nutze `bun run test <file>` oder `bun run test:db <file>` für gezielte Tests.
-
- **Kein `apply_migration` oder Einweg-SQL:** Nutze für Tests die pgTAP-Suite in `supabase/tests/` via `bun run test:db`.
- **Keine Lokale Datenbank** benutzen niemals supabase Start / stop benutzen.
- **Fragen sind Read-Only:** Wenn ein Prompt mit "wie schwer wäre es", "warum passiert X", "sollten wir", "können wir" beginnt, beantworte die Frage, mache Vorschläge, aber ändere keine Dateien ohne Freigabe.
- **Keine stillen Native-Module-Installationen:** Das Hinzufügen nativer Abhängigkeiten erfordert einen Rebuild des Dev-Clients. Weise den Nutzer immer darauf hin.
- **Laufende Prozesse schützen:** Beende keine aktiven Simulator-Sessions, Metro-Server oder Docker-Container, es sei denn, es wurde ausdrücklich angewiesen.

---

## 7. "Hit Every Surface" & Feature Completeness Checklist

- **RLS & Security Policies:** Jede neue Tabelle in `supabase/schemas/*.sql` muss explizite RLS-Policies und zugehörige pgTAP-Tests in `supabase/tests/` erhalten.
- **Reverse States Rule:** Zu jeder UI-Aktion (z. B. `check_item`, `add_favorite`, `archive_recipe`) muss das logische Gegenstück (`uncheck_item`, `remove_favorite`, `unarchive_recipe`) implementiert werden.
- **Typ-Synchronisation:** Nach jeder Datenbankänderung muss `bun run db:types` ausgeführt werden, um `src/lib/database.types.ts` synchron zu halten.
- **Offline- & Outbox-Parität:** Schema-Erweiterungen an synchronisierten Entitäten müssen sowohl im lokalen SQLite-Schema als auch im Sync-Handler berücksichtigt werden.

---

## Tooling, Commands & CLI Quirks

- **Paketmanager:** `bun` für alle Paketoperationen und Skripte (`bun run <cmd>`).
- **Linter & Formatter:** Biome (`bun run check` zum Prüfen, `bun run check:fix` zum Beheben). Kein ESLint / Prettier. `bun run check` validiert zusätzlich `src/global.css` gegen die Tailwind-CLI (`bun run check:css`) — fängt kaputte Arbitrary-Value-Syntax (z. B. Leerzeichen in `bg-[rgba(31, 26, 33, 0.3)]`), die sonst erst als Metro-Hänger bei 99% auffällt.
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`).
- **Tests:** `bun run test` (Jest Unit-Tests) und `bun run test:db` (pgTAP DB-Tests).
- **Datenbank-Workflow:**

```bash
  bun run db:diff -- -f <feature_name>  # Migration erzeugen
  bun run test:db                       # pgTAP-Suite validieren
  bun run db:advisors                   # Security/Performance prüfen
  bun run db:diff                       # Muss danach LEER sein
  bun run db:types                      # TypeScript-Typen aktualisieren

```

## Native Fingerprint & Build Lock

`native-build-lock.json` sperrt gebaute native Artefakte (`native-artifacts/`) an einen Fingerprint-Hash (`@expo/fingerprint`, je Plattform). `bun run native:status` bricht hart ab, sobald der aktuelle Fingerprint vom gelockten abweicht — das ist beabsichtigt, kein Bug. Vor einem erneuten "Mismatch"-Debugging immer zuerst `docs/native-fingerprint-drift-debugging.md` lesen (Root Cause, Ausschlussverfahren, Diff-Tool) statt bei Null anzufangen.

**Löst einen neuen Fingerprint aus** (Rebuild nötig):

- Jede Änderung unter `ios/` bzw. `android/` (getrackte Dateien).
- `app.json`/`app.config.*` — außer den unten explizit ausgenommenen Feldern.
- Neue/geänderte native Dependency (`bun add`, `package.json`-Dependencies, nicht Scripts).
- Config-Plugins selbst (`plugins/*.js`) und ihre Optionen in `app.json`.
- `.gitignore`-Inhalt (wird als Hash-Quelle gelesen, nicht nur als Ignore-Regel).
- `package.json`-Scripts (außer `android`/`ios`, wenn sie kein `run` enthalten — Default-Skip von `@expo/fingerprint`).

**Löst KEINEN neuen Fingerprint aus** (bewusst über `fingerprint.config.js`/`.fingerprintignore` ausgenommen, siehe `docs/native-fingerprint-drift-debugging.md`):

- `version`, `ios.buildNumber`, `android.versionCode` in `app.json`.
- Anzeigename/Beschreibung (`name`, `description`) in `app.json`.
- EAS-Projekt-Metadaten (`extra.eas`) in `app.json`.
- Das `extra`-Feld in `app.json` generell (nur zur Laufzeit über `expo-constants` sichtbar).
- `eas.json`/`.easignore` (Abwägung: steuert *wie* gebaut wird, nicht was kompiliert wird — Restrisiko dokumentiert).
- Lokal generierte Xcode-Dateien (`project.xcworkspace`, `xcuserdata`, `.DS_Store`, `.xcode.env.local`).

**Bei echtem Mismatch:**

```bash
bun run native:status -- --diff        # zeigt die abweichende Fingerprint-Quelle direkt
bun run native:baseline -- --approve-rebuild   # Baseline nach geprüfter, gewollter Änderung neu setzen
```

**Zwei Build-Pfade, bewusst getrennt:**

- `native:dev -- --target <dev-target>` — Inner Loop (`expo run:*`), für Simulator/Emulator während der Entwicklung. Läuft in-place, profitiert von ccache und DerivedData-Wiederverwendung. Baseline-Mismatch blockiert hier nur als Warnung.
- `native:rebuild -- --target <target> --approve-rebuild` — Release-Pfad (`eas build --local`), reproduzierbar/signiert, für TestFlight/Production. Blockiert hart bei Mismatch.

ccache ist für beide Pfade verdrahtet (`plugins/withIosCcacheDir.js`, `scripts/native-build.ts`) — Xcode reicht Build-Settings nicht als Env-Vars an Compile-Subprozesse durch, deshalb eigenständige Wrapper-Skripte statt Env-Var-Vertrauen. Für den TestFlight-Pfad zusätzlich `EAS_LOCAL_BUILD_WORKINGDIR` (festes statt zufälliges Arbeitsverzeichnis pro `eas build --local`-Lauf). Details, Messwerte und die verworfenen Lösungswege: `docs/native-fingerprint-drift-debugging.md`.

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
- **Lists:** `@shopify/flash-list` (v2) ist die alleinige Konvention für virtualisierte Listen — RNs `FlatList` wird nicht mehr verwendet (#139, Stand 2026-08 alle Vorkommen migriert; `test/conventions/flashlist-convention.test.ts` hält das fest). `@legendapp/list` ist zwar installiert, aber unbenutzt: nicht dafür greifen. FlashList v2 braucht **kein** `estimatedItemSize` mehr und auch kein `initialNumToRender`/`windowSize`/`maxToRenderPerBatch`-Tuning, das Recycling regelt die Liste selbst. Zwei Fallstricke: FlashList hat kein cssInterop, `className`/`contentContainerClassName` wirken nicht — RN-Styles nutzen; und `gap` im `contentContainerStyle` greift nicht, Zeilenabstände kommen über `ItemSeparatorComponent`. Eine nicht scrollende Liste innerhalb eines scrollenden `Screen` (früher `FlatList` mit `scrollEnabled={false}`) wird **nicht** zu FlashList, sondern direkt per `.map()` abgebildet — eine virtualisierte Liste im ScrollView unterstützt FlashList nicht.
- **Drag-Reorder-Listen:** `react-native-reorderable-list` bleibt bewusst die Lösung (`category-order-sheet.tsx`, `recipe-wizard-step-steps.tsx`) — kein Ersatz durch FlashList oder eine gesture-handler-Eigenlösung.
- **Gesten & UI-Thread-Animation:** `react-native-gesture-handler` für Swipe-Interaktionen (Vorbild: `inventory-item-row.tsx` mit `ReanimatedSwipeable`), `react-native-worklets`/Reanimated für Animationen auf dem UI-Thread (Vorbild: `animated-icon.tsx`, `week-grid.tsx`, `jiggle-wrapper.tsx`). Bestehendes Muster fortführen, aber nicht proaktiv auf bisher statische Stellen ausweiten.
- **Testhinweis zu FlashList:** die Liste recycelt Zeilen-Views, deshalb spiegelt die Reihenfolge im RNTL-Baum nach einem Re-Sort nicht mehr die Datenreihenfolge (visuell wird über Layout positioniert). Reihenfolge-Logik gehört in eine reine Funktion und wird dort geprüft (Vorbild: `src/features/inventory/visible-items.ts`).
- **Forms:** React Hook Form + Zod (via `@hookform/resolvers`) is the default for structured, validated forms — auth (`sign-in-form.tsx`, `sign-up-form.tsx`), profile edit, onboarding profile step, recipe creation/wizard. Simpler inline forms (e.g. `add-item-form.tsx`) still use plain `useState` and aren't required to migrate just for consistency's sake; use RHF+Zod for new forms with real validation needs, plain state for small inline inputs.
- **Device storage:** `react-native-mmkv` for local key/value storage, in two flavors — `src/lib/storage/device-storage.ts` (unencrypted, non-sensitive UI/device flags, single shared instance) and `src/lib/storage/account-storage.ts` (per-account MMKV instance, encrypted with a key generated via `expo-crypto` and held in `expo-secure-store`, torn down on sign-out/account switch). Account/session data must go through the encrypted per-account instance, never the shared device one.
- **Drizzle:** scoped to the **local SQLite mirror only** (`src/lib/db/schemas/*.ts`, `drizzle.config.ts` with `dialect: 'sqlite', driver: 'expo'`, output under `drizzle/local`). It replaces hand-written SQL for the offline/outbox layer in `src/lib/db/`. It is **not** connected to Supabase/Postgres — the backend schema stays declarative SQL (`supabase/schemas/*.sql`) generated via `bun run db:diff`, per the Non-Negotiable Pillars above. Don't reach for `drizzle-kit` against the Supabase database.

## Questions are read-only

- A question is a request for an answer, not for changes. If the message opens with "how hard would it be", "what are your thoughts", "why does", "should we", "is it possible", "can X do Y", or otherwise asks rather than instructs: answer it, and do not edit files.
- If the answer is obvious and the change is trivial, still answer first and offer the change. Ask before making it.

## Visual and design work

- Do not edit real components first. For any non-trivial Ul, layout, or copy change, build several distinct static mocks, publish them with the html-communication skill, report the URL, and stop. Wait for a pick before implementing.
- Standing constraints: the warm fam mauve/cream palette (`src/constants/theme.ts`, light and dark). Information-dense, no decorative card/pill chrome, no light-gray subtitle lines above sections. Minimal copy. No em dashes.
- Avoid continuously repainting CSS animations (pulse, shimmer, blur, spinners); they peg the GPU on high-refresh displays.

# Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing any code.

## Taste & Architectural Rules of Thumb

- **Simplicity & YAGNI:** Halte Lösungen schlank. Vermeide unnötige Abstraktionsschichten oder Wrapper-Funktionen.
- **Typesicherheit ohne `any`:** Inferenz nutzen. Typsysteme sollen sich an Änderungen anpassen. Code soll modernen TypeScript-Standards entsprechen.
- **Feature-First Struktur:** `src/app/` dient ausschließlich dem Routing (Expo Router). Fachlogik gehört nach `src/features/<domain>/`, geteilte UI nach `src/components/`. Kleine Features bleiben flach (`components/`, `hooks/`, `api.ts`, `types.ts`); sobald ein Feature spürbar wächst, wird nach Verantwortungsschicht getrennt statt alles in `components/` zu sammeln — `screens/` (Screens/Routen-Ziele), `sheets/` (Modals/Bottom-Sheets), `forms/` (Formulare & Eingabe-Bausteine), `components/` (reine Anzeige-Komponenten), `hooks/` (React-Query-/Datenzugriffs-Hooks), `domain/` (Domänen-Logik & Konfiguration ohne React). Referenz: `src/features/shopping-list/`.
- **UI & Layout:** Warme Mauve-/Creme-Palette (`src/constants/theme.ts`, Light & Dark, siehe `docs/DESIGN_SYSTEM.md`), semantisches Styling ausschließlich über Theme-Tokens, kein Em-Dash in Copy, Informationsdichte vor Deko.
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
also make sure to read `.agents/rules/react-native-testing-library.md` for react native testing library rules and guidelines.

## Verification & Pull Request Instructions

- **Lokale Verifikation vor Fertigstellung:**
  1. `bun run check` (Biome Lint/Format + Tailwind-CSS-Validierung)
  2. `bun run typecheck` (TypeScript)
  3. `bun run test` (Jest Unit Tests)
  4. `bun run test:db` (sofern DB-Schemas betroffen sind)

# agent-device

Use agent-device only for app/device automation tasks and Marco approved it!
For a normal app-driving task, start immediately. Do not probe first with `--help`, `--version`, `devices`, `appstate`, `snapshot`, or `screenshot`; open the requested app in the foreground and continue from its initial interactive snapshot.
For TV, Fire TV, or Vega OS tasks, read `agent-device help tv`.
For exploratory QA, read `agent-device help dogfood`.
For logs, network, audio, traces, or runtime failures, read `agent-device help debugging`.
For React Native component trees, props/state/hooks, slow renders, or rerenders, read `agent-device help react-devtools`.
For React Native JavaScript heap growth, heap snapshots, or retained-object leaks, read `agent-device help cdp`.
For React Native apps, overlays, Metro/Fast Refresh blockers, and routing to React DevTools or debugging evidence, read `agent-device help react-native`.

Use the CLI in the integrated terminal.
If `agent-device` is not on PATH but the user installed it globally in another shell, resolve the absolute binary path instead of using `npx -y agent-device@latest`.
Prefer `open -> snapshot -i -> act -> re-snapshot -> verify -> close` where supported; otherwise follow target-specific help.
Keep mutating commands against one session serial.

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
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
