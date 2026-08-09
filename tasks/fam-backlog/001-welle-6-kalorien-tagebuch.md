# 001: Welle 6 — Kalorien & Tagebuch (#81–88)

**Status**: completed
**Created**: 2026-08-08
**Priority**: high

## Description

Die tatsächlich nächste unbearbeitete Welle laut `docs/ROADMAP.md` — die
einzige ohne jeglichen Client-Code (kein `calorie`/`nutrition`/`diary`/`goal`
im ganzen `src/`-Baum). Das Dashboard hat bereits einen Platzhalter-Kommentar
dafür: `// Platzhalter bis #87 (Tagessummen) und #84 (Ziele) angebunden sind`
in `src/features/dashboard/dashboard-screen.tsx`.

**DB-Schema existiert bereits** — nicht neu bauen, nur konsumieren:
`supabase/schemas/09_tracking.sql` enthält `food_entries` (Tagebuch,
denormalisierte Nährwerte), `weight_entries` (Gewicht/Körpermaße),
`user_goals` (Ziele, historisiert über `valid_from`, Kalorien-Untergrenze
1000–10000 als Schranke). Alle drei streng privat
(`auth.uid() = user_id`, kein `is_household_member`) — beim Bauen der
Hooks/Queries nicht versehentlich aufweichen.

## Action Items

- [x] `#81` Grundumsatz-Formeln (reine Funktionen, mock-frei testbar, Stil wie `src/lib/units.ts`)
- [x] `#82` TDEE + Zielkalorien — Sicherheitskappung: Ziel darf nie unter den Grundumsatz fallen
- [x] `#83` Makro-Verteilung mit Presets
- [x] `#84` Ziel-Setup-Screen
- [x] `#85` Tagebuch-Screen nach Mahlzeiten
- [x] `#86` Einträge hinzufügen, bearbeiten, löschen
- [x] `#87` Tagessummen und Restkalorien
- [x] `#88` Datumsnavigation im Tagebuch
- [x] Dashboard-Platzhalter (`aufgenommen = 0`, `ziel = 0`) an echte Daten anschliessen

## Notes

Nach `#84`/`#87` lässt sich Welle 7 (`#91`–`#93`, Fortschrittsring/Makro-Balken/
Tagesübersicht) fortsetzen, die aktuell darauf wartet.

**`#81`/`#82` implementiert** als reine Funktionen in
`src/features/calorie-tracking/{bmr,tdee}.ts` (+ Tests). Mifflin-St-Jeor
(Default) und Harris-Benedict für `#81`; `#82` liefert TDEE über die 5
Standard-PAL-Multiplikatoren sowie `calculateTargetCalories()` mit
Sicherheitskappung auf `max(Grundumsatz, Geschlechts-Minimum)` (nie still —
`capped`/`cappedReason` im Ergebnis) und einer `rateWarning` außerhalb der
empfohlenen 0,25–1,0 kg/Woche-Spanne. Bewusst keine 1000–10000-Kappung in
dieser Funktion — das bleibt die "letzte Schranke" des DB-Constraints auf
`user_goals.daily_kcal`. Kinder-Profile (kein `activity_level` in
`child_profiles`) bewusst außerhalb dieses Slices.

**`#83`–`#88` + Dashboard-Anschluss implementiert.** Architekturentscheidung:
direkter Supabase-Zugriff + React Query (`src/features/calorie-tracking/api.ts`),
**nicht** der lokale SQLite-Sync-Engine — `food_entries`/`weight_entries`/
`user_goals` sind streng privat pro Account und bewusst nicht in
`src/lib/db/entities.ts` registriert, Muster ist `src/features/household/api.ts`.

- `#83` — `macros.ts`: `calculateMacroTargets()`, drei Presets (`balanced`
  30/40/30, `high_protein` 40/30/30, `low_carb` 30/20/50 %).
- `#84` — `goal-setup-screen.tsx` (Route `/settings/goals`, aus den
  Einstellungen verlinkt): BMR → TDEE → Zielkalorien → Makros als
  Live-Vorschau vor dem Speichern, `user_goals` wird per Insert historisiert
  (nie Update). Fehlende Profildaten blocken das Formular mit Verweis auf
  `/settings/profile`; fehlendes Gewicht fragt es inline ab.
- `#85`/`#86`/`#87`/`#88` — `diary-screen.tsx` (neuer 6. Tab "Tagebuch") +
  `add-food-entry-screen.tsx` (Modal-Route `/add-food-entry`): Datumsnavigation
  (reine Pfeile, kein Loggen in die Zukunft), Tagessummen über
  `daily-totals.ts` (`calculateDailyTotals`, ebenfalls #83-Nachbarschaft),
  CRUD mit Soft-Delete (`deleted_at`), `ProductSearchDropdown`-Wiederverwendung
  aus `inventory/` für Naehrwert-Vorbefuellung.
- Dashboard-Platzhalter (`aufgenommen`/`ziel` = 0) ersetzt durch
  `useCurrentGoal`/`useFoodEntries` + `calculateDailyTotals`.
- Neue Tests: `macros.test.ts`, `daily-totals.test.ts`,
  `goal-setup-screen.test.tsx`, `diary-screen.test.tsx` (Mock der `api.ts`-
  Hooks, Stil wie `invite-modal.test.tsx`). `bun run typecheck`/`lint`/`test`
  gruen, `bun run db:diff` leer (keine Schemaänderung nötig — Tabellen
  existierten bereits).
