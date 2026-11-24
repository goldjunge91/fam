# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Erklärungs- & Schreibstil (80 % ASD-STE100 Issue 9)

Wende bei allen Erklärungen, Dokumentationen und technischen Beschreibungen folgende Regeln an:

### 1. Sprachstil (Vereinfachtes Technisches Deutsch nach ASD-STE100)
- **Kurze Sätze:** Schreibe maximal 20 Wörter pro Satz.
- **Ein Gedanke pro Satz:** Vermeide Schachtelsätze und verschachtelte Nebensätze.
- **Aktiv statt Passiv:** Nutze direkte, aktive Verben. Vermeide Passiv-Konstruktionen („wird gemacht“) und Nominalstil (keine Wortketten auf „-ung“).
- **Keine Füllwörter:** Streiche Einleitungen, Floskeln, Metaphern und unnötige Adjektive.
- **Präzise Fachbegriffe:** Behalte wichtige Fachbegriffe bei. Erkläre jeden Fachbegriff bei der ersten Nennung in einem kurzen Satz.
- **Listen nutzen:** Stelle Abläufe, Schritte und Bedingungen immer als Aufzählungspunkte dar.

### 2. Visuelle Struktur & Diagramme
- **Kompakter Einstieg:** Beginne jede Erklärung mit einer Zusammenfassung in genau zwei kurzen Sätzen.
- **Diagramm einbauen:** Ergänze komplexe Abläufe, Architekturen oder Ursache-Wirkungs-Zusammenhänge immer durch ein übersichtliches Mermaid- oder SVG-Diagramm.
- **Interaktive HTML-Ansicht:** Wenn ein Thema veränderbare Parameter, Zustände oder Berechnungen enthält, erstelle zusätzlich eine interaktive Einzeldatei-HTML-Visualisierung zum Ausprobieren.


Tooling-Grundregeln, Coding-
Konventionen, Beads-Workflow und den "Ways to Hurt Yourself"-Guardrails steht
ausschließlich in `AGENTS.md` — hier keine Duplikate pflegen. Dieser Abschnitt
ergänzt nur Dinge, die AGENTS.md nicht abdeckt.

## Architecture

**Feature-first, drei Schichten:**

- `src/app/` — nur Expo-Router-Routing, keine Fachlogik. `(auth)/`,
  `(app)/`, `household/`, `settings/`, `recipe/`.
- `src/features/<domain>/` — Fachlogik pro Domäne. Schichtung ab Größe:
  `screens/`, `sheets/`, `forms/`, `components/`, `hooks/`, `domain/`.
  Referenz: `src/features/shopping-list/` (siehe dessen `ARCHITECTURE.md`).
- **Android-Feature-Kopien:** plattformübergreifende Dateien bekommen eine
  echte `.android`-Kopie (kein Symlink/Stub) wenn nötig hier folgenden wir best practics von Expo z. B. `component.tsx` →
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

@AGENTS.md