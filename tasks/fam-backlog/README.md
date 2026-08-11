# Project: Fam Backlog

**Status**: planning
**Created**: 2026-08-08
**Updated**: 2026-08-09

## Overview

Die tatsächlich nächsten offenen Arbeiten laut `docs/ROADMAP.md`, als Tasks
statt nur als Prosa-Absatz in einer Markdown-Datei — damit sie beim nächsten
Statuscheck nicht wieder "unsichtbar" werden. Reihenfolge folgt der
empfohlenen Priorität aus `docs/projekt_status.md`.

## Tasks

- [~] 001-welle-6-kalorien-tagebuch.md - Kalorien & Tagebuch (#81-88); #81/#82/#87 verifiziert & geschlossen, #83-#86/#88 haben je eine AC-Lücke (siehe Datei)
- [x] 002-sync-engine-realtime-wiring.md - Realtime-Bridge (#48) + Netzwerk-Trigger (#50) anschliessen
- [x] 003-gate-d-two-device-verification.md - #70 Zwei-Geräte-Sync verifiziert (Gate D)
- [~] 004-welle-7-dashboard-polish.md - Dashboard & Navigation (#89-95); #89-92/#95 verifiziert & geschlossen, #93 fehlt Pull-to-Refresh
- [ ] 005-welle-8-datenschutz.md - Datenschutz & Compliance (#96-99)
- [x] 006-sqlite-locking-und-datenleck.md - Sperrfehler, Datenleck, Zugriffsluecken behoben, Geräte-Check bestätigt
- [x] 007-einstellungen-und-entwicklerbereich.md - Einstellungs-Menue, Entwickler-Bereich, benannte Zurueck-Wege

## Verifikation 2026-08-11

Zusätzlich zu den Tasks oben wurden 32 als "fertig" geführte GitHub-Issues aus
den Wellen 4/5/P (Haushalt, Kühlschrank, Lebensmittel-DB — für diese Wellen
gibt es keine eigenen Task-Dateien, da sie schon vor dieser Session als
erledigt galten) einzeln gegen ihre Akzeptanzkriterien im Code geprüft. 17
waren wirklich fertig und wurden jetzt erst auf GitHub geschlossen. 15 haben
eine Lücke:

- **Haushalt**: `#65` — Kinder-Profil beim Mahlzeit-Loggen nicht wählbar
- **Kühlschrank**: `#69` (kein Undo), `#71` (kein MHD-Sortier-Toggle), `#73`
  (Widget versteckt sich nicht bei 0 Artikeln, kein Tap-Through)
- **Lebensmittel-DB**: `#74`/`#75`/`#76` je eine AC-Lücke; `#78` und `#80`
  sind trotz vorheriger ✅-Markierung **nicht implementiert**

Details je Issue in `docs/projekt_status.md`. Alle 15 bleiben bewusst offen.

## Progress

- Total subtasks: 7
- Completed: 4 (002, 003, 006, 007)
- Partial (AC-Lücken verifiziert): 2 (001, 004)
- Pending: 1 (005)
- Zusätzlich 15 Issue-Lücken außerhalb dieser Task-Dateien offen (Haushalt/
  Kühlschrank/Lebensmittel-DB, siehe oben)
