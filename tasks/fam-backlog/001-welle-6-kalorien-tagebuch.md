# 001: Welle 6 — Kalorien & Tagebuch (#81–88)

**Status**: pending
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

- [ ] `#81` Grundumsatz-Formeln (reine Funktionen, mock-frei testbar, Stil wie `src/lib/units.ts`)
- [ ] `#82` TDEE + Zielkalorien — Sicherheitskappung: Ziel darf nie unter den Grundumsatz fallen
- [ ] `#83` Makro-Verteilung mit Presets
- [ ] `#84` Ziel-Setup-Screen
- [ ] `#85` Tagebuch-Screen nach Mahlzeiten
- [ ] `#86` Einträge hinzufügen, bearbeiten, löschen
- [ ] `#87` Tagessummen und Restkalorien
- [ ] `#88` Datumsnavigation im Tagebuch
- [ ] Dashboard-Platzhalter (`aufgenommen = 0`, `ziel = 0`) an echte Daten anschliessen

## Notes

Nach `#84`/`#87` lässt sich Welle 7 (`#91`–`#93`, Fortschrittsring/Makro-Balken/
Tagesübersicht) fortsetzen, die aktuell darauf wartet.
