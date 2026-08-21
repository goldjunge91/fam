# Developer Guide

NutriTrack ist eine Expo-/React-Native-App für gemeinsame Haushaltsdaten und
private Ernährungsdaten. Die App läuft auf iOS und Android mit einem Dev Build;
Expo Go reicht wegen SQLite, Kamera, SecureStore und Notifications nicht aus.

Die vollständige Dokumentationslandkarte steht in [docs/README.md](README.md).

## Schnellstart

```bash
bun install
supabase start
bash scripts/ios-dev.sh
```

Für einen vorhandenen iOS-Build genügt `bash scripts/ios-dev.sh --reuse-last`.
Weitere Befehle, Umgebungsvariablen und Test-Accounts stehen im
[Projekt-README](../README.md).

## Architektur

```text
fam/
├── src/
│   ├── app/            # 🚦 NUR Routing & Navigation Expo-Routen und Navigation, 
│   ├── features/       # 🧱 Fachlogik nach Themen sortiert (Feature-First)
│   ├── components/     # 🎨 Wiederverwendbare allgemeine UI-Elemente
│   ├── constants/      # 🎨 Theme, Farben, Schriftarten, Abstände
│   ├── hooks/          # 🎣 App-weite React-Hooks (z.B. Theme, Network)
│   └── lib/            # ⚙️ Supabase-Client, Env-Handling, SQLite-Sync
├── supabase/
│   ├── schemas/        # 🗄️ Deklarative Datenbank-Schemas (*.sql)
│   └── tests/          # 🧪 Datenbank-Tests (pgTAP)
└── docs/               # 📖 Status, Roadmap & Vision
```

### 🧠 Die 4 Grundpfeiler des Systems

1. **Routing (`src/app/`)**: Expo Router nutzt **File-based Routing** (ähnlich wie Next.js). Erstellst du eine Datei `src/app/(app)/fridge.tsx`, entsteht automatisch der Screen für den Kühlschrank.
   - `(auth)/`: Screens für nicht eingeloggte Nutzer (Login, Register).
   - `(app)/`: Hauptanwendung mit Tab-Leiste (Kühlschrank, Rezept, Profil, etc.).

2. **Feature-Ordner (`src/features/<domain>/`)**: Die eigentliche Fachlogik liegt nicht in `src/app/`, sondern isoliert im jeweiligen Feature-Ordner. Ein typisches Feature (z.B. `fridge`) sieht so aus:
   - `components/`: UI-Bausteine nur für dieses Feature (z.B. `FridgeItemCard.tsx`).
   - `hooks/`: Daten-Hooks (z.B. `useFridgeItems.ts`).
   - `api.ts`: API-Aufrufe an Supabase / SQLite.
   - `types.ts`: TypeScript-Typen für dieses Feature.

3. **Styling & Theme (`src/constants/theme.ts`)**: In React Native wird mit standardmäßigem `StyleSheet.create({...})` gearbeitet. Farben und Abstände importierst du aus [`theme.ts`](file:///Users/marco/Github.tmp/family_app/fam/src/constants/theme.ts) (`Colors.light.accent`, `Spacing.three`).

4. **Datenbank & Offline-Sync (Supabase + SQLite)**:
   - **Regel laut [`AGENTS.md`](file:///Users/marco/Github.tmp/family_app/fam/AGENTS.md)**: Das Datenbank-Schema wird **ausschließlich deklarativ** unter `supabase/schemas/*.sql` bearbeitet. Du schreibst Migrationen niemals per Hand!
   - Die lokale SQLite-Datenbank sorgt dafür, dass die App auch ohne Internetverbindung funktioniert. Eine Outbox-Sync-Engine synchronisiert Änderungen im Hintergrund mit Supabase.

---
Shared household data (Bestand, Einkaufsliste) und private Daten (Tagebuch,
Gewicht, Ziele) sind auf Datenbankebene durch RLS getrennt. Der lokale
SQLite-Mirror mit Outbox ist der normale Schreibweg für synchronisierte Daten.

## Arbeitsabläufe

### Feature oder UI ändern

1. Route möglichst dünn halten und Fachlogik im passenden `src/features/`-Modul
   umsetzen.
2. Nur semantische Theme-Tokens und bestehende UI-Komponenten verwenden. Details:
   [Design-System](DESIGN_SYSTEM.md).
3. Gegenläufige Nutzeraktion mitdenken, etwa Wiederherstellen zu Löschen.
4. Prüfen:

   ```bash
   bun run check
   bun run typecheck
   bun run test
   ```

### Datenbank ändern

`supabase/schemas/*.sql` beschreibt ausschließlich den gewünschten Endzustand.
Migrationsdateien werden nie direkt bearbeitet.

```bash
# Schema ändern, dann:
bun run db:diff -- -f beschreibender_name
bun run db:reset
bun run test:db
bun run db:advisors
bun run db:diff
bun run db:types
```

Für neue Tabellen gehören RLS-Policies und passende pgTAP-Tests dazu. Änderungen
an synchronisierten Entitäten brauchen zusätzlich SQLite-Schema und Sync-Handler.

### Qualität und Tests

```bash
bun run check       # Biome: Lint und Format
bun run typecheck   # TypeScript
bun run test        # Jest, nicht: bun test
bun run test:db     # pgTAP, falls das Schema betroffen ist
```

Vor Änderungen an React-Native-Komponententests zuerst
`.agents/rules/react-native-testing-library.md` und die lokale Dokumentation
von `@testing-library/react-native` lesen.
