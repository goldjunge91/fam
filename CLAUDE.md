# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Vor jeder Codeänderung `CONSTRAINTS.md` im Repository-Root lesen. Die dort festgelegten Grenzen dürfen nicht abgeschwächt werden, um eine Änderung erfolgreich erscheinen zu lassen.

Alles zu nativen Builds, Fingerprint/Lock, Tooling-Grundregeln, Coding-
Konventionen, Beads-Workflow und den "Ways to Hurt Yourself"-Guardrails steht
ausschließlich in `AGENTS.md` — hier keine Duplikate pflegen. Dieser Abschnitt
ergänzt nur Dinge, die AGENTS.md nicht abdeckt.

Erlaubte häufige Einstiege aus dem Repository-Root:

## Commands (Kurzreferenz)

```bash
bun run check         # Biome lint+format
bun run typecheck     # tsc --noEmit
bun run test          # Jest — NIEMALS `bun test`
bun run test:db       # pgTAP, nur bei Supabase-Schema-Änderungen
bun run test:integration
bun run test:functions
```


## Architecture

**Feature-first, drei Schichten:**

- `src/app/` — nur Expo-Router-Routing, keine Fachlogik. `(auth)/`,
  `(app)/`, `household/`, `settings/`, `recipe/`.
- `src/features/<domain>/` — Fachlogik pro Domäne. Schichtung ab Größe:
  `screens/`, `sheets/`, `forms/`, `components/`, `hooks/`, `domain/`.
  Referenz: `src/features/shopping-list/` (siehe dessen `ARCHITECTURE.md`).
- **Android-Feature-Kopien:** plattformübergreifende Dateien bekommen eine
  echte `.android`-Kopie (kein Symlink/Stub), z. B. `component.tsx` →
  `component.android.tsx`.
- `src/components/` — geteilte, domänenlose UI-Bausteine.
- `src/lib/` — Supabase-Client, Env-Handling (`env.ts`), lokaler DB-/Sync-Layer.

**Lokaler DB-Layer (`src/lib/db/`):** SQLite via `expo-sqlite`. `client.ts`
bewusst **nicht** im Barrel `index.ts` re-exportiert (sonst zieht jeder Test,
der aus `@/lib/db` importiert, das native Modul mit). App-Code importiert
`@/lib/db/client` direkt. Migrationen: `migrator.ts` + `migrations.ts`
(App-interne SQLite-Version, unabhängig von Supabase-Migrationen).

**RLS-Trennung:** Ladefolge der Schema-Dateien steht ausschließlich in
`schema_paths` (`supabase/config.toml`) — hier nicht duplizieren. Jede neue
Tabelle braucht eigene Policies + pgTAP-Tests unter `supabase/tests/`.

**Sprachregel:** siehe AGENTS.md — der untersagte K-Begriff darf nirgends
verwendet werden (Code, Kommentare, Docs, UI-Texte, Beads-Tasks, Commits).

**Umgebungsvariablen:** `.env` im Root, gitignored. Nur `EXPO_PUBLIC_*`
landet im Client-Bundle. Details: `README.md`.

**Native Module:** Barcode-Scanner, SQLite, SecureStore, Notifications
laufen nicht in Expo Go — Dev Client zwingend (`bash scripts/ios-dev.sh`).

## Weiterführende Docs

- `.agents/rules/react-native-testing-library.md` — vor Komponententests lesen
- `CONTEXT.md` — Domänenvokabular & Datenbesitz
- `docs/adr/` — Architekturentscheidungen


**Sprachregel:** Der im Änderungsauftrag untersagte K-Begriff darf in Quelltext,
Kommentaren, Dokumentation, UI-Texten, Beads-Tasks und Commit-Nachrichten nicht
verwendet werden. Bestehende Formulierungen werden bei Berührung durch
„verbindlich“, „maßgeblich“ oder eine fachlich präzisere Bezeichnung ersetzt.

## Agent skills / Task tracking

Beads (`bd`) ist der Projekt-Tracker; vollständiges Setup, Regeln und
Session-Completion-Protokoll stehen **ausschließlich in `AGENTS.md`** (dort
einmal konsolidiert, siehe Vorschlag oben). Hier nur der Verweis: `bd prime`
für Kontext, `.agents/skills/beads/SKILL.md` für Details.