# 004: Refresh stale project docs

**Status**: completed
**Created**: 2026-08-08
**Priority**: high

## Description

`README.md`, `docs/ROADMAP.md`, `docs/projekt_status.md`,
`docs/CHANGELOG.md` und `docs/SYNC_ENGINE.md` waren auf dem Stand
2026-08-06 eingefroren und unterschätzten den echten Fortschritt: Epic 4
(Haushalt, #59–66), die Kühlschrank/Einkaufsliste-Screens (#67–69, #71–73)
und der Grossteil der Lebensmittel-DB (#74–78, #80) waren im Code bereits
fertig und getestet, aber noch als offen/geplant markiert. `README.md`
beschrieb das Repo sogar noch als leeres Expo-Template ohne Backend.

## Action Items

- [x] `README.md` — Status-Zeile + Stack-Tabelle korrigiert
- [x] `docs/ROADMAP.md` — Status-Übersicht + Welle-4/5-Überschriften korrigiert
- [x] `docs/projekt_status.md` — Epic-4/5/6(P)-Tabellen + "nächste Schritte" korrigiert
- [x] `docs/CHANGELOG.md` — rückwirkender `[0.6.0]`-Eintrag für die
      nachgetragene Arbeit, "Unreleased" auf Welle 6 aktualisiert
- [x] `docs/SYNC_ENGINE.md` — Verdrahtungsstatus präzisiert (Poll-Sync
      verdrahtet, Realtime-Bridge/Netzwerk-Trigger weiterhin nicht)
- [x] `docs/refactoring_plan.md` — als vollständig umgesetzt markiert

## Notes

Commit `8f0821b`. Wichtigster Nebenfund beim Schreiben: die Sync-Engine ist
**nur poll-basiert** (alle 20s, `src/lib/sync/sync-runner.ts`) verdrahtet —
die Realtime-Bridge (#48) und Netzwerk-/Hintergrund-Trigger (#50) sind
gebaut, aber nicht angeschlossen. Das ist jetzt ein eigener Backlog-Task,
siehe `tasks/fam-backlog/002-sync-engine-realtime-wiring.md`.
