# Plan

> Angelegt 2026-08-08 im Rahmen einer Zustandsprüfung (siehe
> `docs/projekt_status.md` / `docs/ROADMAP.md` für den vollständigen Epic-Stand).
> Grund: die Markdown-Roadmap-Docs hinkten dem Code um ~2 Tage hinterher;
> dieses Task-System hält den *nächsten Arbeits*-Stand aktuell, damit das
> nicht wieder passiert.

## Active Projects

- **fam-housekeeping** — Aufräumarbeiten nach dem Auth/Onboarding-Sprint
  (Commit uncommitted changes, toter Code, fehlende Tests, Doku-Refresh).
  Status: **completed** (2026-08-08).
- **fam-backlog** — nächste Epics/Wellen laut `docs/ROADMAP.md`.
  Status: **MVP komplett** (2026-08-12). Gate D (#70) verifiziert. Am
  2026-08-11 wurden 32 zuvor als "fertig" geführte Issues einzeln gegen ihre
  Akzeptanzkriterien im Code geprüft (nicht nur gegen Commit-Messages): 17
  waren wirklich fertig und wurden erst jetzt auf GitHub geschlossen; 15
  hatten eine Lücke, davon `#78` und `#80` trotz vorheriger ✅-Markierung
  komplett unimplementiert — alle 15 wurden noch am selben Tag geschlossen.
  Am 2026-08-12 wurde die letzte offene MVP-Welle (Welle 8, Datenschutz,
  #96–#99) implementiert, und #79 (war im Code bereits fertig, nur nicht
  verifiziert) geschlossen. GitHub-Milestone "Phase 1 - MVP" hat damit 0
  offene Issues. Details in `docs/projekt_status.md` und
  `tasks/fam-backlog/README.md`. Offen bleiben nur die Phase-2–4-Epics
  (#11–#24).


## Verweise

- Vollständiger Epic/Issue-Stand: `docs/projekt_status.md`
- Wellen-Reihenfolge + Gates: `docs/ROADMAP.md`
- Sync-Engine-Architektur (inkl. offener Realtime-Verdrahtung): `docs/SYNC_ENGINE.md`
