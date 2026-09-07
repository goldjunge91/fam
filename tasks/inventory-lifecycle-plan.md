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

## Implementation Review Addendum (2026-09-07)

Dieser Abschnitt ist append-only. Die ursprüngliche Planung, der damalige
Doubt-Review und die dort dokumentierten Entscheidungen bleiben als Verlauf
erhalten. Die folgenden Punkte aktualisieren ausschließlich den
Umsetzungsstatus und die noch erforderlichen Arbeitsschritte.

### Review-Ergebnis

**Status: Request changes, nicht releasefähig.** Die Grundstruktur ist
vorhanden: Schemaquellen, lokale Spiegelung, Ledger-Typen, Open-Logik,
Historien-UI und fokussierte Tests existieren. Die Verifikation war grün für
59 relevante Inventory-Tests, 43 Sync-/Outbox-Tests und den Typecheck. Diese
Tests beweisen jedoch nicht die vollständige fachliche Abdeckung aus der Spec.

Die lokale Supabase-Datenbank und pgTAP wurden gemäß AGENTS.md nicht gestartet;
RLS- und echte Upgradepfade sind deshalb in diesem Review nicht ausgeführt
worden. Die Arbeitskopie enthielt bereits unabhängige Änderungen, die nicht
angefasst wurden.

### Befunde und verbindliche Nachverfolgung

| ID | Severity | Befund | Erforderliche Auflösung | Bead |
| --- | --- | --- | --- | --- |
| IR-1 | **Critical** | Ein Move wird lokal gemeinsam enqueued, beim Remote-Push aber als unabhängige Bestands-, `out`- und `in`-Requests verarbeitet. Ein Teilfehler kann einen halben Move persistieren. | Gruppierte Outbox-Mutation plus autorisierte serverseitige Transaktion mit Idempotenzschlüssel. Erfolg, Teilfehler und Retry testen. | `fam-lem.10`, danach `fam-lem.6` |
| IR-2 | **Critical** | `use-complete-shopping-run` erzeugt beim Überführen eines Einkaufsartikels nur `fridge_items`, aber keine `transactions`-Zeile mit `type = 'in'`. | Alle produktiven Mengenpfade auditieren und die Ledger-Buchung in derselben lokalen atomaren Mutation schreiben. Doppelbuchungen und quantity=0 testen. | `fam-lem.11`, danach `fam-lem.6` |
| IR-3 | **Critical** | Undo ist produktiv nur für `open` vorhanden. `in`, `out`, `waste`, Move, 24-Stunden-Grenze und idempotente Wiederholungsbehandlung fehlen. `undone` bleibt ohne belastbare Provenienz ungenutzt. | Inverse Buchungen für alle Typen, Korrekturbuchung nach 24 Stunden und maschinenlesbare Reversal-Provenienz implementieren. Den Konflikt zwischen append-only/RLS und `undone=true` ausdrücklich lösen. | `fam-lem.12` |
| IR-4 | **Required** | Der `expiry_user_set`-Backfill steht im deklarativen Schema, fehlt aber in der tatsächlich generierten Servermigration und im lokalen Upgradepfad. | Ausrollbare Migrationen müssen bestehende gesetzte MHD-Werte schützen. Upgrade- und pgTAP-Test ergänzen. | `fam-lem.1` |
| IR-5 | **Required** | Der direkte MHD-Schnellzugriff setzt bei manueller Datumsänderung `expiry_user_set` nicht zuverlässig auf `true`. | Alle manuellen MHD-Eingabepfade auf den gemeinsamen Schutzvertrag umstellen und testen. | `fam-lem.6` |
| IR-6 | **Required** | Split/Undo bewahrt nicht alle Lifecycle-Metadaten und sucht beim Undo anhand loser Attribute irgendeinen passenden versiegelten Lot. Identische Lots können falsch gemerged werden. | Stabile Ursprungsreferenz/Provenienz persistieren, relevante Metadaten erhalten und Duplicate-Lot-Fallback testen. | `fam-lem.3`, danach `fam-lem.12` |
| IR-7 | **Required** | Die lokalen Constraints für `transactions.reason` sind nicht vollständig paritygleich zum Servermodell. | Lokales Schema und Sync-Grenze müssen erlaubte Gründe und Waste-Kopplung wie Supabase erzwingen. | `fam-lem.4` |
| IR-8 | **Required** | `opened-expiry.ts` enthält weiterhin vorläufige Werte; Recherche und Release-Swap sind offen. | Geprüfte Werte dokumentieren, Platzhalter ersetzen und das Gate erst nach vollständiger Cross-Surface-Verifikation schließen. | `fam-lem.8`, `fam-lem.9` |

### Revidierte Ausführungsreihenfolge

Die ursprüngliche Dependency-Graph-Dokumentation bleibt oben erhalten. Für die
offenen Befunde gilt zusätzlich folgende Reihenfolge:

1. `fam-lem.1` schließt den realen Server- und lokalen Backfill sowie die
   vollständige Constraint-/RLS-Basis.
2. `fam-lem.2` bis `fam-lem.5` vervollständigen Berechnung, Split-Grundlage,
   Mirror und generierte Typen. `fam-lem.8` läuft unabhängig weiter.
3. `fam-lem.10` baut die atomare gruppierte Mutation und den serverseitigen
   Transaktionspfad. `fam-lem.11` schließt parallel die Ledger-Abdeckung aller
   Bestands-Schreibpfade.
4. `fam-lem.6` integriert die Hooks einschließlich Move, MHD-Schnellzugriff
   und der geprüften Ledger-Abdeckung.
5. `fam-lem.12` implementiert das allgemeine, idempotente Undo auf Basis der
   stabilen Split-Provenienz und des atomaren Hook-Vertrags.
6. Erst danach wird `fam-lem.7` als UI-Schnittstelle abgeschlossen.
7. `fam-lem.9` bleibt das letzte Release-Gate: geprüfte Ablaufwerte,
   abgeschlossene Critical-/Required-Findings, fokussierte Tests und die
   dokumentierte manuelle Offline-/Plattformverifikation.

### Aktualisierte Bead-Landkarte

| Bead | Rolle nach dem Review | Abhängigkeiten |
| --- | --- | --- |
| `fam-lem.1` | Schema, reale Migrationen, Backfill, RLS und pgTAP | — |
| `fam-lem.2` | Haltbarkeitsfunktion mit vollständiger Regelmatrix und Schutz vor Überschreiben | `.1` |
| `fam-lem.3` | Split/Merge mit stabiler Ursprungsreferenz und Metadatenerhalt | `.1` |
| `fam-lem.4` | Lokale Constraint- und Sync-Parität, gruppierbare Outbox-Primitiven | `.1` |
| `fam-lem.5` | Generierte Typen und widerspruchsfreie Typgrenzen | `.1` |
| `fam-lem.10` | Atomare Move-/Mehrzeilenmutation über Outbox und Server | `.1`, `.4`, `.5` |
| `fam-lem.11` | Vollständige Ledger-Abdeckung inklusive Einkaufslisten-Abschluss | `.1`, `.4`, `.5` |
| `fam-lem.6` | Hook-Orchestrierung auf den beiden neuen Fundamenten | `.2`, `.3`, `.4`, `.5`, `.10`, `.11` |
| `fam-lem.12` | Undo für alle Typen, 24-Stunden-Korrektur und Idempotenz | `.3`, `.6` |
| `fam-lem.7` | UI für den vollständigen Mutation-/Undo-Vertrag | `.6`, `.11`, `.12` |
| `fam-lem.8` | Fachliche Prüfung der Ablaufwerte | parallel |
| `fam-lem.9` | Letztes Release-Gate inklusive aller neuen Befunde | `.2`, `.7`, `.8`, `.10`, `.11`, `.12` |

Die Beads wurden entsprechend aktualisiert. Keine bestehende Aufgabe wurde
geschlossen oder entfernt. Die neuen Aufgaben `.10` bis `.12` existieren
gezielt als eigene Tracker-Einheiten, damit die drei Critical-Findings nicht
erneut in den bereits großen Hook- oder UI-Aufgaben verschwinden.

### Neue Checkpoints

**Checkpoint E, nach `fam-lem.10` und `fam-lem.11`**

- [ ] Move kann bei Fehler zwischen den Legs vollständig zurückgerollt werden.
- [ ] Einkaufslisten-Abschluss und alle weiteren Mengenpfade erzeugen genau
      eine passende Ledger-Buchung.
- [ ] Lokale und Remote-Tests beweisen Retry- und Offline-Verhalten.

**Checkpoint F, nach `fam-lem.12`**

- [ ] Alle Transaktionstypen haben einen getesteten Undo- oder
      Korrekturpfad.
- [ ] Wiederholtes Undo ist sicher und der Reversal-Zusammenhang bleibt
      historisch nachvollziehbar.
- [ ] Split-Inplace, Split-Merge und Merge-Fallback sind mit identischen Lots
      getestet.

**Checkpoint G, vor `fam-lem.9`-Abschluss**

- [ ] Backfill funktioniert im Server- und lokalen Upgradepfad.
- [ ] MHD-Schnellzugriff, lokale Constraints und generierte Typen sind
      verifiziert.
- [ ] Geprüfte Ablaufwerte ersetzen alle Platzhalter.
- [ ] Fokussierte Tests, Typecheck, Check, relevante DB-Prüfungen sowie der
      manuelle Dev-Client-Durchlauf sind dokumentiert.

### Zählkorrektur: zehn eigenständige Abweichungen

Die vorherige Review-Tabelle hat mehrere Befunde zur besseren Zuordnung zu
acht Gruppen zusammengezogen. Für die vollständige Nachverfolgbarkeit werden
hier dieselben Ergebnisse in zehn eigenständige Abweichungen aufgelöst. Diese
Aufschlüsselung ersetzt nichts aus der vorherigen Tabelle.

| ID | Severity | Eigenständige Abweichung | Bead |
| --- | --- | --- | --- |
| CR-1 | **Critical** | Remote-Move ist nicht atomar: lokale Gruppierung verhindert nicht, dass der Server Bestandsänderung, `out` und `in` als getrennte Requests verarbeitet. | `fam-lem.10` |
| CR-2 | **Critical** | Der Einkaufslisten-Abschluss erzeugt Bestandszugänge ohne `transactions`-Buchung mit `type = 'in'`. | `fam-lem.11` |
| CR-3 | **Critical** | Undo unterstützt produktiv nur `open`; inverse Buchungen für `in`, `out`, `waste` und Move fehlen. | `fam-lem.12` |
| CR-4 | **Critical** | Undo ist nicht sicher nachvollziehbar/idempotent: `undone` wird nicht am Ursprung geführt, wiederholtes Undo bleibt möglich und der Open-Vorzustand wird nicht in jedem Pfad korrekt als aktueller Gegenbuchungszustand behandelt. | `fam-lem.12` |
| CR-5 | **Required** | Der Backfill `expiry_user_set=true` fehlt in der tatsächlich ausrollbaren Servermigration und im lokalen Upgradepfad. | `fam-lem.1` |
| CR-6 | **Required** | Der direkte MHD-Schnellzugriff setzt bei manueller Datumsänderung `expiry_user_set` nicht zuverlässig auf `true`. | `fam-lem.6` |
| CR-7 | **Required** | Beim Split werden Lifecycle-Metadaten der neuen geöffneten Zeile nicht vollständig bewahrt, unter anderem `expiry_user_set` und `vacuum_sealed`. | `fam-lem.3` |
| CR-8 | **Required** | Split-Undo identifiziert die Ursprungszeile nur über Attribute und kann bei identischen Lots den falschen Bestand zusammenführen. | `fam-lem.3`, `fam-lem.12` |
| CR-9 | **Required** | Das lokale SQLite-Modell erzwingt die erlaubte Menge der Waste-Gründe nicht vollständig wie das Supabase-Modell. | `fam-lem.4` |
| CR-10 | **Required** | Vorläufige Haltbarkeitswerte und das noch offene Release-Gate verhindern eine fachliche Freigabe. | `fam-lem.8`, `fam-lem.9` |

Damit ist der Review-Stand nicht acht, sondern zehn offene Abweichungen. Die
größeren Bead-Aufgaben wurden deshalb nicht weiter verborgen vergrößert:
`fam-lem.10` bis `.12` bleiben die expliziten Nachverfolgungseinheiten für
Atomizität, Ledger-Abdeckung und Undo; die übrigen sieben Abweichungen sind in
den fachlich zuständigen bestehenden Beads verankert.

## Implementation Decision Addendum (2026-09-07)

Der im Review identifizierte Backfill-Konflikt ist entschieden. Supabase
Declarative Schema Diff erfasst DML nicht; deshalb ist für den bereits
bestehenden Backfill `expiry_date -> expiry_user_set = true` eine einmalige,
explizit freigegebene Forward-Migration zulässig. Die Ausnahme ist auf diesen
idempotenten Datenabgleich beschränkt. Alle normalen Schemaänderungen bleiben
an den deklarativen Workflow mit `bun run db:diff` gebunden. Der Server- und
der lokale Upgradepfad müssen denselben Backfill enthalten und werden jeweils
gezielt verifiziert.

## Increment 1 Status Addendum (2026-09-07)

Dieser append-only Eintrag dokumentiert den ersten Implementierungsslice. Die
ursprüngliche Planung und alle Review-Befunde bleiben unverändert.

- **CR-2 / `fam-lem.11`:** Der Einkaufsabschluss schreibt pro Transfer
  `fridge_items` und genau eine `transactions(type = 'in')`-Zeile gemeinsam
  mit `enqueueMutations`.
- **CR-5 / `fam-lem.1`:** Der einmalige Server-Backfill und der lokale
  Drizzle-Upgradepfad sind angelegt; der lokale Upgrade-Test beweist die
  idempotente Übernahme bestehender MHD-Werte.
- **CR-6 / `fam-lem.6`:** Edit-Sheet und beide Plattform-Schnellzugriffe
  setzen bei manueller MHD-Änderung `expiry_user_set = true`.
- **CR-7/8 / `fam-lem.3`:** Split-Metadaten bleiben erhalten; die stabile
  Ursprungs-ID wird als `[Split] origin=<ID>` in `notes` persistiert. Undo
  merged nur diese Zeile; Legacy- und Duplicate-Lot-Fälle fallen sicher
  zurück.
- **CR-9 / `fam-lem.4`:** Das lokale `transactions_reason_check` und die
  generierte Drizzle-Migration erzwingen die drei erlaubten Waste-Gründe.

Verifiziert: lokaler pgTAP-Test `24_inventory_lifecycle.test.sql` 17/17,
lokale Schema-/Upgrade-Integration 31/31, Lifecycle-/Mutations-/Shopping-
Jest-Tests fokussiert grün, UI-Suites 17/17, `bun run typecheck`,
`bun run check` und `git diff --check` grün. `db:diff` konnte nach einem
Shadow-DB-Healthcheck-Reset nicht abschließen; die Ursache war der lokale
temporäre PostgreSQL-Container, nicht ein gemeldeter Schema-Diff. Die offenen
Befunde CR-1, CR-3, CR-4 und CR-10 bleiben ausdrücklich offen.

## Verification Correction Addendum (2026-09-07)

Die historische Diff-Notiz im vorherigen Addendum beschreibt nur den ersten
Versuch. Beim zweiten Lauf mit deaktivierter Supabase-CLI-Telemetrie wurde die
Shadow-Datenbank erfolgreich initialisiert; `bun run db:diff` endete mit
`No schema changes found`. `db:advisors` meldete ebenfalls keine Findings.

## Increment 2 Status Addendum (2026-09-07)

Dieser Abschnitt ist append-only. Keine vorherige Planung, Review-Abweichung
oder offene Aufgabe wurde entfernt. Der Slice schließt CR-1 technisch ab,
ohne die weiterhin offenen CR-3, CR-4 und CR-10 vorwegzunehmen.

- **CR-1 / `fam-lem.10`:** Ein Move wird lokal als ein `move`-Outbox-Eintrag
  mit `operation_id` geführt. Der Server-RPC `move_fridge_item` sperrt den
  Bestand, prüft erwarteten Lagerort und Menge, aktualisiert den Bestand und
  schreibt `out`/`in` als eine PostgreSQL-Transaktion. Wiederholungen derselben
  Operation sind idempotent; unvollständige oder widersprüchliche Ledgerdaten
  werden abgelehnt.
- **Lokale Parität:** `transactions.operation_id`, der `move`-Outbox-Op und
  der Drizzle-Upgradepfad sind generiert. Der lokale Mirror setzt die drei
  betroffenen Datensätze gemeinsam; ein Fehler in einer Ledgerzeile rollt die
  lokale Mutation vollständig zurück.
- **Server-/Privilege-Pfad:** Die Migration
  `20260907004709_inventory_move_atomic.sql` und die nachgelagerte, von der
  deklarativen Engine erzeugte `20260907005742_inventory_move_privileges.sql`
  sind geprüft. Der RPC ist für `authenticated` ausführbar, nicht für `anon`.
- **Live-Nachweis:**
  `bun run verify:inventory-move` ist als lokales, hart auf
  `127.0.0.1`/`localhost` begrenztes Skript verfügbar. Es prüft Erfolg, Retry,
  Remote-Rollback und gibt die IDs sowie Studio-Abfragen aus. Die Testdaten
  bleiben für die manuelle Studio-Prüfung bestehen.

### Verifikation des Slices

- Coalesce-Regression: 30/30 Jest-Tests.
- Hook-Vertrag: 5/5 Jest-Tests.
- Lokale Move-/Rollback-Integration: 2/2 Tests.
- Lokales Schema inklusive Upgrade: 33/33 Tests.
- Serverseitiger pgTAP-Move-/RLS-/Idempotenztest: 13/13 Tests.
- Vollständiger lokaler Push-Integrationslauf: 14/14 Tests.
- Live-Skript gegen `http://127.0.0.1:54321`: PASS.
- `bun run typecheck`, `bun run check` und `git diff --check`: PASS; die vier
  broken-symlink-Warnungen unter `.claude/skills` bestehen unabhängig vom
  Slice weiter.

Die Browser-Variante bleibt für diesen Nachweis bewusst ausgeschlossen: Die
Expo-SDK-57-Dokumentation kennzeichnet SQLite-Websupport als instabil/alpha,
verlangt WASM sowie COEP/COOP-Header und unterstützt
`withExclusiveTransactionAsync` im Web nicht. Der terminalbasierte Lauf gegen
den lokalen Supabase-Container ist deshalb der belastbare Cross-Surface-Test
für genau diesen Sync-Vertrag.

**Nächster Tracker-Schritt:** `fam-lem.11` bleibt offen und wird als nächstes
über alle weiteren mengenverändernden Schreibpfade auditiert. Erst danach
folgt die Integration beider Fundament-Slices in `fam-lem.6`.

## Increment 2 Review Correction Addendum (2026-09-07)

Dieser Abschnitt ergänzt den vorherigen Increment-2-Nachweis append-only. Keine
vorherige Planung, Review-Abweichung oder Verifikation wurde entfernt.

- **Migrationskompatibilität:** Der historische Schlüssel
  `20260901043557_chunky_ken_ellis` bleibt in `drizzle/local/migrations.js`
  erhalten. Ein Upgrade einer vor dem Commit `4443253` migrierten SQLite-Datei
  führt die Plus-Migration dadurch nicht erneut aus.
- **Coalescing-Reihenfolge:** Beim Eintreffen eines `move` wird die offene
  Gruppe desselben Bestandseintrags mit `finish(group)` abgeschlossen und aus
  `open` entfernt. Spätere Updates starten eine neue Gruppe und behalten ihre
  Reihenfolge relativ zum Move.
- **Regressionstests:** Die Upgrade-Kompatibilität sowie die Sequenzen
  `Update → Move → Update` und `Insert → Move → Delete` sind als fokussierte
  Tests festgehalten.

## Increment 3 Status Addendum (2026-09-07)

Dieser Abschnitt ist append-only. Keine vorherige Planung, Review-Abweichung,
Verifikation oder offene Aufgabe wurde entfernt.

- **`fam-lem.4` / lokale Constraint-Parität:** Das Drizzle-Schema erzwingt nun
  zusätzlich `transactions_operation_id_move_type` und den partiellen Unique-
  Index `transactions_operation_type_idx`. Damit sind `operation_id`-Zeilen
  lokal auf `in`/`out` begrenzt und pro Operation ist höchstens je eine dieser
  beiden Ledgerzeilen möglich. Die Migration wurde generiert und in
  `drizzle/local/migrations.js` registriert; der historische Backfill-Eintrag
  `20260907120000_inventory_expiry_user_set_backfill` blieb erhalten.
- **Lokale Append-only-Grenze:** `applyLocalMirrorWrite` weist `update`,
  `delete` und `restore` für `transactions` vor jeder SQLite-Schreiboperation
  ab. Die bestehende Push-Grenze bleibt als zweite Verteidigungsschicht
  aktiv.
- **Pull-Parität:** Der reale lokale Supabase-Pull ist für `transactions` mit
  `household_id`-Scoping sowie dem stabilen `created_at`-/`id`-Cursor geprüft.
  Zwei Ledgerzeilen mit gleichem Zeitstempel werden korrekt geordnet; ein
  späterer Datensatz wird genau einmal nachgezogen.
- **Gruppierte Outbox:** Die bereits vorhandenen Move-Tests bleiben der
  Nachweis für gemeinsame lokale Spiegelung, genau einen Outbox-Eintrag,
  Rollback bei Teilfehlern, atomaren Remote-RPC, Retry-Idempotenz und das
  Ausbleiben halber Moves.

### Verifikation des Slices

- Lokales Schema-/Upgrade-Integration: **34/34**.
- Drizzle-Migrationsrunner: **3/3**.
- Mirror-Write-Integration: **22/22**.
- Outbox-/Retry-/Entity-Integration: **49/49**.
- Pull gegen den laufenden lokalen Supabase-Container: **12/12**.
- Coalesce-Reihenfolge: **32/32**.
- Lokale Move-/Rollback-Integration: **2/2**.
- Push gegen den laufenden lokalen Supabase-Container: **14/14**.
- `bun run check`: **PASS**; nur der bekannte Browserslist-Hinweis bleibt.
- `bun run db:diff`: **No schema changes found**.
- `bun run db:types`: ohne inhaltliche Änderung an den generierten Typen.
- `bun run typecheck`: weiterhin rot wegen der fünf bereits dokumentierten
  Fehler in den parallelen `.11`-Änderungen, `push.ts` und dem historischen
  Migrationstest; kein Fehler stammt aus dem lokalen Constraint-Slice.

Damit sind die technischen Acceptance-Kriterien von `fam-lem.4` erfüllt. Der
manuelle Dev-Client-Durchlauf bleibt als Plattform-/Produktionsverifikation
separat und ist kein Grund, die lokale SQLite-/Sync-Parität erneut offen zu
lassen.
