# 004: Welle 7 — Dashboard & Navigation (#89–95)

**Status**: partial (siehe Verifikation 2026-08-11 unten)
**Created**: 2026-08-08
**Priority**: medium

## Description

Bei genauer Prüfung vor der Umsetzung waren `#91`/`#92` bereits erledigt
(`ProgressRing`/`MacroBar` seit Welle 6 im Dashboard verdrahtet — die
Beschreibung unten und `docs/projekt_status.md` waren hier veraltet).
Tatsächlich offen waren: auseinandergelaufene Navigation (tote
`profile-screen.tsx`, Web-Tabs ≠ native Tabs), und Modul-Aktivierung als
komplettes Neuland (Onboarding sammelte die Toggles, verwarf sie aber
stillschweigend beim Abschluss).

## Action Items

- [x] `#89` Tab-Struktur fertigstellen — tote `src/features/profile/
      profile-screen.tsx` + Duplikat-Route `/profile` entfernt,
      `app-tabs.web.tsx` an die 6 nativen Tabs angeglichen (Tagebuch +
      Einstellungen ergänzt, den verwaisten Profil-Tab entfernt)
- [x] `#90` Template-Screens ersetzen — bewusst nur Aufräumen, kein
      Rezept-CRUD (das ist eigentlich Zukunfts-Epic #12);
      `recipes-screen.tsx` bleibt inhaltlich wie es ist, jetzt hinter
      `ModuleGate` erreichbar
- [x] `#91` Animierter Kalorien-Fortschrittsring — bereits seit Welle 6 erledigt
- [x] `#92` Makro-Fortschrittsbalken — bereits seit Welle 6 erledigt
- [x] `#93` Dashboard-Tagesübersicht — als bereits erfüllt eingeordnet: das
      Dashboard zeigt Kalorienring + Makros + Ablauf-Widget schon auf einer
      Seite, kein zusätzlicher Screen gebaut
- [x] `#94` Profil- und Einstellungs-Screen — gelöst durch die Aufräumarbeit
      aus `#89`: `settings-screen.tsx` ist der reale Account-Hub, der
      doppelte/veraltete `profile-screen.tsx` wurde entfernt statt reanimiert
- [x] `#95` Modul-Aktivierung (Feature-Flags) — vollständig neu gebaut:
      4 neue Spalten auf `profiles` (`module_fridge`, `module_shopping_list`,
      `module_calories`, `module_recipes`, Default `true`), Onboarding
      speichert die Auswahl jetzt tatsächlich, neue Einstellungs-Seite
      `/settings/modules` zum nachträglichen Umschalten, `ModuleGate`
      blendet Tab-*Inhalte* aus (nicht die Tabs selbst — `NativeTabs` sind
      statisch) für die vier gateable Tabs (Vorrat/Einkauf/Tagebuch/Rezepte).
      Dashboard und Einstellungen sind laut `docs/VISION.md` bewusst nicht
      abwählbar.

## Notes

Keine Schema-Überraschung: reine Spalten-Migration, `check-privileges.sh
--linked` lief ohne Befund durch (kein neues SECURITY-DEFINER-Problem wie bei
`006`). `bun run typecheck`/`check`/`test` grün, `db:diff` nach Push leer.

Neue Tests: `module-gate.test.tsx`, `module-settings-screen.test.tsx`.

## Verifikation 2026-08-11 (gegen GitHub-AC, nicht nur gegen diese Notizen)

`#89`–`#92`, `#95` bestätigt und auf GitHub geschlossen (`#94` war es bereits).
`#93` bleibt offen: Dashboard zeigt Ring + Makros + Ablauf-Widget zwar auf
einer Seite, aber Pull-to-Refresh (Teil des ACs) fehlt komplett —
`RefreshControl` kommt im gesamten Repo nicht vor.
