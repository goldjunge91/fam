# Inventory-Sync: Constraints

Status: verbindlich für den Inventory-Sync-Refactor.
Letzte Festlegung: 2026-09-10.

## Vier Wahrheitsquellen

1. `contract.md` — fachliches Verhalten und Invarianten.
2. `CONSTRAINTS.md` — Arbeits-, Sicherheits- und Qualitätsgrenzen.
3. `owner-file-map.md` — einziger Owner pro Entscheidung, Abhängigkeitsrichtung.
4. Beads — Arbeitsstand, Reihenfolge, Blocker, Abnahmekriterien, Nachweise.

Frühere Pläne, Handoffs und geschlossene Tickets sind keine normative Quelle.

## Arbeitsbereich

- Alle Änderungen laufen in
  `/Users/marco/Github.tmp/family_app/fam-worktrees/inventory-sync-clean/`.
- Die lokale Supabase-Instanz darf für pgTAP-Tests, `db:types`, `db:diff`
  und lokale Verifikation verwendet werden. Kein `supabase start`, kein
  Remote-Projekt.
- Kein Agent-Device, Simulator oder Emulator.
- Keine Git-Kommandos.

## Architektur und Änderungen

- Vor jedem Inkrement: dieses Dokument, den relevanten Contract-Abschnitt,
  das Beads-Ticket, betroffene Owner und ihre Tests lesen.
- KISS, DRY, YAGNI gelten vor jeder neuen Datei oder Abstraktion.
- Jede fachliche Entscheidung hat genau einen Owner aus `owner-file-map.md`.
  Andere Schichten dürfen transportieren und validieren, aber nicht dieselbe
  Regel erneut entscheiden.
- Eine Operation rechtfertigt keine eigene Datei.
- Keine neue Sync-, Queue-, Registry-, Executor- oder Plugin-Schicht.
- Fachliche Änderungen aktualisieren zuerst den Contract. Veraltete
  Implementierungen werden nach dem Cutover entfernt, nicht als Alias erhalten.
- Ungeshipped = Zero Legacy. Kein Decoder, kein Dual-Payload, keine alten
  Spalten.
- Supabase-Schema: nur `supabase/schemas/*.sql`. Migrationen nie manuell.
- Keine neuen Suppressions, übersprungenen Tests oder unimplementierten Stubs.

## Typen und Validierung

- Operationen: diskriminierte Union mit Pflichtfeldern je Variante. Kein
  gemeinsamer Optionalfeld-Payload.
- Kein `any`, `as any`, `as unknown as`, `as never` oder Non-null-Assertion.
- Payloads strikt validieren. Fehlend ≠ `null`. Kein Spread eines DB-Objekts
  in den Request.

## Planung, Commit und Sync

- Fachplanung ist rein: keine globale Uhr, keine Zufalls-ID, kein React,
  keine DB, kein Netzwerk.
- Lokaler Commit: innerhalb der exklusiven SQLite-Transaktion frisch lesen,
  Plan berechnen, Bestand + Ledger + Outbox atomar schreiben. Kein Netzwerk
  in der Transaktion.
- Phase-1-Sync: Push mit Retry, Pull mit Server-als-Basis, einfache
  Konfliktbenachrichtigung. Kein Receipt-basiertes Reconciliation-Protokoll.
- Benachrichtigung und Query-Invalidierung erst nach Commit.

## Fehler und Sicherheit

- Technischer Fehler, fachlicher Konflikt und `unknown` bleiben
  unterscheidbar. Kein leerer Catch, kein Erfolg nach Fehler.
- Auth und RLS serverseitig. SQL parametrisiert. Keine Payloads in Logs.
- Mengen nur an benannten Grenzen normalisieren. Keine zweite Rundung.
- Reads und Retries auf Haushalt und Footprint begrenzt. Keine Abfrage
  pro Listenzeile, keine unbeschränkte Retry-Schleife.

## Inkremente und Lesbarkeit

- Ein Beads-Ticket: beobachtbares Ergebnis, Abnahmekriterien, betroffene
  Dateien, fokussierte Nachweise.
- Dateien werden nach Verantwortung und Lesbarkeit beurteilt, nicht nach
  LOC-Zählung.
- Guard Clauses statt tiefer Verschachtelung. Kommentare erklären
  Invarianten, keine Änderungshistorie.

## Verifikation

| Änderung | Nachweis |
|---|---|
| TypeScript | fokussierte Tests, Biome-Check, `bun run typecheck` |
| Owner oder Importgrenze | `test/conventions/inventory-operation-ownership.test.ts` |
| Lokaler Commit | Erfolgs-, Fehler- und Rollback-Nachweis |
| Supabase-Schema | pgTAP-Tests, `bun run db:diff`, `bun run db:types` |
| Strukturänderung | unveränderte Verhaltenstests |

- Immer `bun run test <datei> --runInBand --watchman=false`, nie `bun test`.
- Tests prüfen Wirkung und Fehlerfälle. Den Owner nicht mocken.
- Vor Abschluss: Korrektheit, Lesbarkeit, Architektur, Sicherheit und
  Performance proportional zum Risiko prüfen. Befunde stehen in Beads.

## Baseline

Unabhängige bestehende Fehler dürfen nicht still behoben oder als Erfolg
des Refactors dargestellt werden.

Eine Änderung aktualisiert nur die zuständige Wahrheitsquelle:

- Verhalten → `contract.md`
- Grenzen → `CONSTRAINTS.md`
- Owner → `owner-file-map.md`
- Status → Beads
