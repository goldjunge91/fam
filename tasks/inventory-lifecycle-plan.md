# Implementation Plan: `inventory-lifecycle`

Spec: `docs/specs/household-capabilities/inventory-lifecycle.md`
Mockups (freigegeben, Option C): `docs/specs/household-capabilities/mockups/inventory-lifecycle/`
Tasks tracked in **bd** (nicht `tasks/todo.md` — Projektvorgabe laut CLAUDE.md/AGENTS.md). Epic: `fam-lem`.

`tasks/plan.md` gehört zu einem anderen, laufenden Vorhaben (Rezeptvorschläge
aus dem Bestand) und wurde nicht angerührt — dieser Plan liegt deshalb unter
eigenem Dateinamen.

## Overview

Neues Fam-Modul: ein `transactions`-Ledger für jede Bestandsbewegung
(in/out/waste, 24h-Undo) plus ein Öffnen/Versiegelt/Vakuum-Zustand an
`fridge_items` mit automatisch berechneter Haltbarkeit nach dem Öffnen. Die
Änderung ist überwiegend additiv (neue Tabelle, drei neue Spalten) und
ersetzt das bestehende Mengen-Delta-Verhalten nicht.

## Architecture Decisions

- **Foundation-first statt vertikaler User-Slices.** Die klassische
  vertikale Slicing-Empfehlung passt hier schlecht: es gibt keine
  unabhängigen User-Stories, sondern eine einzige zusammenhängende
  Datenschicht (Schema → reine Funktionen → Sync → Hooks → UI), bei der jede
  Schicht auf der Existenz der vorherigen aufbaut. Reihenfolge folgt daher
  dem Abhängigkeitsgraphen, nicht Feature-Scheiben — das ist die
  dokumentierte Ausnahme, keine übersehene Slicing-Möglichkeit.
- **Platzhalter-Werte zulässig für die Haltbarkeitsberechnung.** `fam-lem.2`
  darf mit den ungeprüften EverShelf-Werten aus `opened-expiry-rules_v1/v2.md`
  entwickelt werden; die fachliche Prüfung (`fam-lem.8`) läuft parallel und
  aktualisiert die Werte, ohne die Funktionssignatur zu ändern (Tabelle rein
  → Tage-Zahl raus bleibt stabil).
- **UI erst nach Freigabe.** `fam-lem.7` war bis zur Mockup-Freigabe
  blockiert (AGENTS.md Visual-Work-Regel: keine echten Komponenten vor
  Freigabe). Freigabe liegt jetzt vor (Option C).

## Dependency Graph

```
fam-lem.1 (Schema: transactions + fridge_items-Spalten)
    │
    ├── fam-lem.2 (Haltbarkeitsberechnung, reine Funktion)
    ├── fam-lem.3 (Split/Merge beim Öffnen/Rückgängigmachen)
    ├── fam-lem.4 (SQLite-Mirror + Sync-Handler-Parität)
    └── fam-lem.5 (db:types)
            │
            └── fam-lem.6 (Mutation-Hooks: consume/waste/move/open/undo)
                    │
                    └── fam-lem.7 (UI, nach Mockup-Freigabe)

fam-lem.8 (Recherche: Tageswerte-Prüfung) — läuft parallel, speist finale
Werte in fam-lem.2 ein, blockiert es aber nicht (Platzhalter erlaubt)
```

## Task List (bd)

| bd-Id | Titel | Size | Depends on |
| --- | --- | --- | --- |
| `fam-lem.1` | Schema: `transactions`-Tabelle + `fridge_items`-Spalten (inkl. Backfill, RLS ohne UPDATE/DELETE) | M (Schema-Datei, Migration, pgTAP-Test) | — |
| `fam-lem.2` | Haltbarkeitsberechnung als reine Funktion | S–M | `fam-lem.1` |
| `fam-lem.3` | Split/Merge-Logik beim Öffnen/Rückgängigmachen (inkl. `open`-Buchung, manuelles Wieder-Versiegeln) | S–M | `fam-lem.1` |
| `fam-lem.4` | Lokales SQLite-Mirror-Schema + Sync-Handler-Parität | M | `fam-lem.1` |
| `fam-lem.5` | `db:types` nach Schema-Änderung | XS | `fam-lem.1` |
| `fam-lem.6` | Mutation-Hooks (consume/waste/move/open/undo, move atomar über beide Zeilen) | M–L | `fam-lem.2`, `fam-lem.3`, `fam-lem.4`, `fam-lem.5` |
| `fam-lem.7` | UI: Öffnen-Aktion, Waste-Grund-Auswahl, Transaktionshistorie | L (mehrere Screens/Sheets) | `fam-lem.6` |
| `fam-lem.8` | Recherche: Tageswerte gegen Lebensmittelsicherheits-Richtlinien | S (Doku) | — (parallel, speist `fam-lem.2`) |
| `fam-lem.9` | Release-Gate: Platzhalterwerte durch `fam-lem.8`-Ergebnis ersetzen | XS | `fam-lem.2`, `fam-lem.8` |

`fam-lem.9` ist neu seit dem Doubt-Review (Befund #5): ohne diese Task gab es
keinen Tracker-Zwang, die Platzhalter-Haltbarkeitswerte vor Release
tatsächlich zu ersetzen. Die Epic `fam-lem` gilt erst als fertig, wenn auch
`fam-lem.9` geschlossen ist.

`fam-lem.6` und `fam-lem.7` sind am ehesten grenzwertig groß (mehrere Hooks
bzw. mehrere Screens/Sheets) — bei Bedarf beim Anfassen weiter in
Unter-Tasks pro Aktion (consume / waste / move / open / undo bzw. pro
Screen) aufteilen statt als einen Sitzungsblock zu bearbeiten.

## Verification per Task

- `fam-lem.1`: `bun run db:diff` danach leer, `bun run test:db`, `bun run db:advisors` ohne neue Findings.
- `fam-lem.2`: `bun run test -- opened-expiry` (oder passender Dateiname) grün, eine Testzeile pro Produktgruppe/Lagerort/Fallback/Vakuum/`expiry_user_set`-Schutz.
- `fam-lem.3`: `bun run test` für die Split/Merge-Funktion grün, inkl. Merge-Fallback-Fall.
- `fam-lem.4`: manueller Offline-Test im Dev-Client (Flugmodus → Aktion → Reconnect → Sync korrekt).
- `fam-lem.5`: `bun run db:types`, danach `bun run typecheck` grün.
- `fam-lem.6`: `bun run typecheck` grün, jede Zeile aus der Buchungs-Tabelle in der Spec hat einen Hook-Pfad.
- `fam-lem.7`: RNTL-Tests grün, manueller Abgleich gegen `mockup-option-c-full-flow.html`.
- `fam-lem.8`: kein Code — Dokument-Review durch Marco.

## Checkpoints

**Checkpoint A — nach `fam-lem.1`:** Schema/RLS/pgTAP stehen und sind grün,
`db:diff` leer. Vor Fortsetzung kurz mit Marco gegenchecken (Migrationen sind
generiert, nicht von Hand geschrieben — Fehler hier sind teuer zu korrigieren).

**Checkpoint B — nach `fam-lem.2`–`fam-lem.5` (parallelisierbar):** alle vier
Bausteine unabhängig grün getestet, bevor `fam-lem.6` sie zusammenführt.

**Checkpoint C — nach `fam-lem.6`:** Alle Buchungsarten (in/out/waste,
Korrektur, Verschieben, Undo) funktionieren end-to-end gegen die lokale
Test-DB, bevor UI-Arbeit beginnt.

**Checkpoint D — nach `fam-lem.7`:** vollständiger manueller Durchlauf im
Dev-Client gegen `mockup-option-c-full-flow.html`, dann Review mit Marco vor
PR.

## Parallelization

- `fam-lem.2`, `fam-lem.3`, `fam-lem.4`, `fam-lem.5` sind nach `fam-lem.1`
  unabhängig voneinander (reine Funktionen bzw. Sync-Layer, kein geteilter
  State) — parallelisierbar über mehrere Sessions/Agents.
- `fam-lem.8` läuft komplett unabhängig und parallel zum gesamten Rest.
- `fam-lem.1` (Schema) und `fam-lem.6`/`fam-lem.7` (bauen auf allem auf)
  müssen sequenziell bleiben.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Platzhalter-Haltbarkeitswerte laufen unbemerkt in Produktion, bevor `fam-lem.8` abgeschlossen ist | Mittel — falsche Sicherheitsempfehlung an Nutzer | `fam-lem.2`-Funktion klar als "vorläufige Werte" kommentieren; `fam-lem.8` vor Release-Freigabe der Funktion als Slot einplanen, nicht nur "irgendwann" |
| Split/Merge-Logik (`fam-lem.3`) erzeugt inkonsistente `fridge_items`-Zeilen bei gleichzeitiger Bearbeitung durch zwei Haushaltsmitglieder (Sync-Konflikt) | Mittel — doppelte/verlorene Mengen | Merge-Fallback ist in der Spec bereits vorgesehen (Original bleibt als eigenständiger Eintrag, wenn sie sich geändert hat); pgTAP/Unit-Test für genau diesen Fall in `fam-lem.3` |
| `fam-lem.6` wird beim Anfassen größer als geplant (5 Hooks in einer Session) | Niedrig — Session-Größe | Bei Bedarf pro Hook (consume/waste/move/open/undo) in `bd` weiter aufsplitten, bevor Implementierung beginnt |

## Open Questions

- Keine offenen fachlichen Fragen mehr auf Spec-Ebene — UI ist freigegeben
  (Option C), Datenmodell und Verhalten sind entschieden. Einzig offen:
  Ergebnis von `fam-lem.8` (Tageswerte-Recherche), abgesichert durch das
  Release-Gate `fam-lem.9`.
- Eine mechanische Detailfrage bleibt bewusst bei der Implementierung
  (`fam-lem.3`): ob "manuelles Wieder-Versiegeln nach 24h" eine eigene
  `open`-Buchung mit `quantity = 0` schreibt oder ganz ohne Buchung auskommt
  (der `quantity > 0`-Constraint verbietet `0` aktuell) — siehe
  `inventory-lifecycle.md`, Abschnitt "Manuelles 'Wieder versiegeln'".

## Doubt-Review

Ein adversarialer Fresh-Context-Review (general-purpose Subagent, ARTIFACT =
dieser Plan + Spec, CONTRACT = Spec-Erfolgskriterien) fand 8 Befunde vor der
Freigabe dieses Plans — alle als "valid + actionable" eingestuft und direkt
im Datenmodell/den bd-Tasks behoben (Backfill, `open`-Transaktionstyp +
`previous_expiry_date`, RLS ohne UPDATE/DELETE, korrigierte
Testdatei-Nummer, Release-Gate `fam-lem.9`, `reason`-Constraint verschärft,
Verschieben-Atomizität, manuelles Wieder-Versiegeln). Details siehe
`inventory-lifecycle.md`, Abschnitt "Doubt-Review (Phase 2)". Ein zweiter
Zyklus war nicht nötig — keine der Korrekturen warf neue offene Fragen auf.
Cross-Model-Review wurde in diesem Zyklus nicht angeboten; auf Wunsch
nachholbar (Gemini/Codex CLI oder manuell).
