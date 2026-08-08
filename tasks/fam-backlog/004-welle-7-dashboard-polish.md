# 004: Welle 7 — Dashboard & Navigation (#89–95)

**Status**: pending
**Created**: 2026-08-08
**Priority**: medium

## Description

Teilweise schon vorhanden: `dashboard-screen.tsx` (204 Zeilen) zeigt bereits
das Ablauf-Widget (#73). Grösster Rest hängt an Welle 6
(`001-welle-6-kalorien-tagebuch.md`): `#91`–`#93` brauchen echte
Kalorien-/Zieldaten statt der aktuellen Platzhalter (`aufgenommen = 0`,
`ziel = 0`). `recipes-screen.tsx` (18 Zeilen) und die `settings/`-Screens
sind noch echte Gerüste.

## Action Items

- [ ] `#89` Tab-Struktur fertigstellen
- [ ] `#90` Template-Screens (Recipes, Settings) durch echte Screens ersetzen
- [ ] `#91` Animierter Kalorien-Fortschrittsring (braucht Welle 6)
- [ ] `#92` Makro-Fortschrittsbalken (braucht Welle 6)
- [ ] `#93` Dashboard-Tagesübersicht (braucht Welle 6)
- [ ] `#94` Profil- und Einstellungs-Screen
- [ ] `#95` Modul-Aktivierung (Feature-Flags)

## Notes

`#91`–`#93` blockiert von `001-welle-6-kalorien-tagebuch.md`. `#89`, `#90`,
`#94`, `#95` sind unabhängig und könnten vorgezogen werden.
