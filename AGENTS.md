# NutriTrack (fam)

- **NutriTrack** ist eine Expo- und React-Native-App für Haushalte und Familien, die geteilte Bestands- und Einkaufslisten mit einem Wöchentlichen Essensplanner und der möglichkeit privatem Kalorien-, Nährwert- und Gewichts-Tracking zu kombinieren.
- **Mental Anchor / Comparison:** Denke an NutriTrack als eine datenschutzorientierte, kollaborative Kombination aus *Bring!* und *MyFitnessPal* mit strikter Trennung zwischen Haushalts- und Privatdaten.
- **Goal:** Schnelle, zuverlässige mobile Workflows für iOS und Android mit robuster Offline-Fähigkeit und synchronisiertem Haushaltszustand.

---

## What Makes NutriTrack Special (1–4 Non-Negotiable Pillars)

1. **Strikte Datentrennung & RLS-Autorität:** Geteilte Haushaltsdaten (Kühlschrank, Vorrat, Einkaufszettel) und private Nutzerdaten (Kalorien, Gewicht, Tagebuch) sind auf Datenbankebene per Supabase RLS strikt isoliert.
2. **Ausschließlich Declaratives Datenbankschema:** Die Schemadefinitionen in `supabase/schemas/*.sql` sind die einzige Wahrheit. Migrationsdateien werden niemals manuell verfasst, sondern ausschließlich über `bun run db:diff` mit `pg-delta` generiert.
3. **Local-First & Offline-Belastbarkeit:** Lokale SQLite-Datenbank (`expo-sqlite`) mit Outbox-Sync für reibungslose Bedienung auch ohne stabile Netzverbindung.

---

## Multi-Surface Layer

- **Mobile (iOS & Android):** Hauptzielplattform mit Expo SDK 57, React Native 0.86 und React 19.2. Erfordert für native Module (Kamera, Barcode-Scanner, SQLite, SecureStore, Notifications) einen Dev Client (`scripts/ios-dev.sh`); läuft nicht in Standard Expo Go.
- **Web / Edge Functions / Services:** Supabase Edge Functions (z. B. `auth-confirmed`), Web-Vorschau via `expo start --web`, Supabase Studio (`localhost:54323`) für lokale Inspektion.
- **Backend & Auth:** Supabase (Postgres, GoTrue Auth, Realtime, Storage) via Docker (`supabase start`); RevenueCat für In-App-Käufe und Abonnements.
- wir haben noch kein Devoloper account für den Apple App Store, daher ist die iOS-Distribution derzeit nicht am funktionieren und wir können nur lokale Builds auf iOS testen.

for CSS styling nativewind docs  @`.claude/nativewind.dev:llms.txt`.

---

## A Note from Marco

Im Marco. Your my agent. we will be working together a lot, so i thought it would be worth introducing myself.

i love to build. i focus on building complex things as simple as possible. i love to find ways to reduce complexity when solving problems.

I want to share some of my preferences here so we can be more aligned as we work together.
> *"I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.*
>
> *Channel both 'measure twice, cut once' and 'yagni'. Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.*
>
> *The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as 'hard rules', more as 'good defaults'. The developer's preferences should be able to override anything here.*
>
> *Of note: Most developer contributions are often controlled remotely. This means you should be careful about accessing data, killing dev servers, and other things that may damage the project instance that the developer is using."*

- **Override Clause:** Anweisungen in dieser Datei sind *starke Standardwerte, keine starre Dogmatik*. Explizite Anweisungen im Prompt des Maintainers überschreiben die `AGENTS.md` jederzeit.

---

## Glossary

| Term | Meaning & Dialect |
| :--- | :--- |
| **`You`** | Der KI-Agent, der den Code liest, plant und bearbeitet. |
| **`We / Maintainers`** | Marco und die Maintainer des Projekts (deine Gesprächspartner). |
| **`User`** | Der Endnutzer der NutriTrack-App bzw. die Person, die App später verwenden wird. |
| **`Household (Haushalt)`** | Die geteilte Entität für gemeinsame Bestände, Einkaufslisten und Einladungen. |
| **`Inventory / Fridge`** | Geteilter Lebensmittelbestand mit Lagerorten (Kühlschrank, Vorrat, Tiefkühler). |
| **`Diary / Log`** | Privates, nutzerspezifisches Ernährungstagebuch (Mahlzeiten, Kalorien, Makronährstoffe). |
| **`Declarative Schema`** | Der deklarative Schemazustand unter `supabase/schemas/*.sql`. |
| **`Outbox`** | Lokale SQLite-Warteschlange für Offline-Mutationen vor dem Push an Supabase. |
| **`Dev Build`** | Natives Binary (`scripts/ios-dev.sh`), das für native Expo-Module zwingend nötig ist. |

---

## Ways to Hurt Yourself (Safety Guardrails)

- **Niemals Migrationen von Hand schreiben oder editieren:** Ändere stets `supabase/schemas/*.sql`, erzeuge die Migration mit `bun run db:diff` und wende sie mit `bun run db:reset` an.
- **Niemals `bun test` ausführen:** Führe immer `bun run test` aus. `bun test` nutzt die native Bun-Engine, ignoriert `jest.config.js` und schlägt fehl.
- **Kein `apply_migration` oder Einweg-SQL:** Nutze für Tests die pgTAP-Suite in `supabase/tests/` via `bun run test:db`.
- **Fragen sind Read-Only:** Wenn ein Prompt mit "wie schwer wäre es", "warum passiert X", "sollten wir", "können wir" beginnt, beantworte die Frage, mache Vorschläge, aber ändere keine Dateien ohne Freigabe.
- **Keine stillen Native-Module-Installationen:** Das Hinzufügen nativer Abhängigkeiten erfordert einen Rebuild des Dev-Clients (`scripts/ios-dev.sh`). Weise den Nutzer immer darauf hin.
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
- **Linter & Formatter:** Biome (`bun run check` zum Prüfen, `bun run check:fix` zum Beheben). Kein ESLint / Prettier.
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`).
- **Tests:** `bun run test` (Jest Unit-Tests) und `bun run test:db` (pgTAP DB-Tests).
- **Datenbank-Workflow:**

```bash
  bun run db:diff -- -f <feature_name>  # Migration erzeugen
  bun run db:reset                      # Lokal anwenden
  bun run test:db                       # pgTAP-Suite validieren
  bun run db:advisors                   # Security/Performance prüfen
  bun run db:diff                       # Muss danach LEER sein
  bun run db:types                      # TypeScript-Typen aktualisieren

```

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

## Visual and design work

- Do not edit real components first. For any non-trivial Ul, layout, or copy change, build several distinct static mocks, publish them with the html-communication skill, report the URL, and stop. Wait for a pick before implementing.
- Standing constraints: the warm fam mauve/cream palette (`src/constants/theme.ts`, light and dark). Information-dense, no decorative card/pill chrome, no light-gray subtitle lines above sections. Minimal copy. No em dashes.
- Avoid continuously repainting CSS animations (pulse, shimmer, blur, spinners); they peg the GPU on high-refresh displays.

# Expo HAS CHANGED

Read the exact versioned docs at <https://docs.expo.dev/versions/v57.0.0/> before writing any code.

## Taste & Architectural Rules of Thumb

- **Simplicity & YAGNI:** Halte Lösungen schlank. Vermeide unnötige Abstraktionsschichten oder Wrapper-Funktionen.
- **Typesicherheit ohne `any`:** Inferenz nutzen. Typsysteme sollen sich an Änderungen anpassen. Code soll modernen TypeScript-Standards entsprechen.
- **Feature-First Struktur:** `src/app/` dient ausschließlich dem Routing (Expo Router). Fachlogik gehört nach `src/features/<domain>/` (mit `components/`, `hooks/`, `api.ts`, `types.ts`), geteilte UI nach `src/components/`.
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
  1. `bun run check` (Biome Lint/Format)
  2. `bun run typecheck` (TypeScript)
  3. `bun run test` (Jest Unit Tests)
  4. `bun run test:db` (sofern DB-Schemas betroffen sind)

# agent-device

Use agent-device only for app/device automation tasks.
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
