# Inventory-Sync: Ausführungsplan

Status: V3-Reset am 2026-09-09 übernommen; die aktive Umsetzung läuft über
den unabhängigen Beads-Baum `fam-9vt`.

Quellen: `CONSTRAINTS.md` setzt Qualitätsgrenzen, `contract.md` Zielverhalten.
Beads verfolgt Arbeit. Die verbindliche Datei-/Owner-Matrix steht in
`owner-file-map.md`; dort stehen Zielnamen, erlaubte Exporte, Verantwortung
und die Zuordnung zu den `fam-9vt`-Slices.

## Capability Map und Abhängigkeitsrichtung

Die Map zerlegt die Neuimplementierung in sechs vertikale, unabhängig
prüfbare Fähigkeiten. Sie ergänzt den Contract nicht, sondern benennt die
konkreten Produktions-Owner und ihre Abhängigkeitsrichtung. `quality-ratchets`
ist eine durchgängige Gate-Schicht, keine abschließende Aufräumphase.

| Modul-ID                          | Verantwortung                                                                      | Abhängigkeiten                 |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| `baseline-and-owners`             | Contract-Gates, fehlende Owner, KISS-/DRY-/YAGNI-Nachweise und Aktivierungsgrenzen | —                              |
| `integer-persistence-boundary`    | Integer-Persistenz, lokale Spiegelung und benannte Mengen-/Read-Grenzen            | `baseline-and-owners`          |
| `local-quantity-operations`       | Insert, Korrektur und Move mit kanonischer Planung und atomarer Outbox-Ausführung  | `integer-persistence-boundary` |
| `local-lifecycle-operations`      | Open, Consume, Waste und Undo inklusive Provenienz                                 | `local-quantity-operations`    |
| `server-receipt-path`             | RPCs, Receipts, Idempotenz, Snapshot-Basis, RLS und Push-Ack                       | `local-lifecycle-operations`   |
| `unknown-conflict-reconciliation` | Unknown, Konflikte, Pull/Realtime-Reconciliation und sichere Projektion            | `server-receipt-path`          |

Build order: `baseline-and-owners` → `integer-persistence-boundary` →
`local-quantity-operations` → `local-lifecycle-operations` →
`server-receipt-path` → `unknown-conflict-reconciliation`.

### Aktive V3-Slices

Jeder Slice bearbeitet höchstens vier Produktionsdateien. Tests und Harnesses
werden zusätzlich benannt. Vor jeder neuen Owner-Datei ist der im Contract
geforderte KISS-/DRY-/YAGNI-Check im Beads-Ticket abzulegen.

| Reihenfolge | Slice                                   | Produktionsdateien (max. 4)                                                                                                                                                                        | Primäre Nachweise                                                                  |
| ----------: | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
|           1 | Integer-Persistenzgrenze                | `src/lib/inventory-quantity.ts`, `src/lib/db/schemas/inventory.ts`, `src/lib/db/schemas/system.ts`, `supabase/schemas/08_inventory.sql`                                                            | Mengen-Unit-Tests, lokale Schema-Tests, pgTAP-Integer-/Atomicity-Tests             |
|           2 | Insert, Korrektur und Move lokal atomar | `src/features/inventory/inventory-lifecycle.ts`, `src/lib/sync/inventory-quantity.ts`, `src/features/inventory/use-inventory-mutations.ts`, `src/lib/db/outbox.ts`                                 | Lifecycle-Grenzfälle, Mutations-Integration, Rollback-/Outbox-Test, Ownership-Gate |
|           3 | Open, Consume, Waste und Provenienz     | `src/features/inventory/inventory-lifecycle.ts`, `src/lib/sync/inventory-quantity.ts`, `src/features/inventory/use-inventory-mutations.ts`, `src/features/inventory/use-inventory-transactions.ts` | Lifecycle- und Mutations-Tests für Tombstones, Footprint und Ledger                |
|           4 | Server-Receipt, Idempotenz und RLS      | `supabase/schemas/08_inventory.sql`, `supabase/schemas/20_privileges.sql`, `src/lib/sync/push.ts`, `src/lib/sync/mirror-write.ts`                                                                  | Receipt-/RLS-/Atomicity-pgTAP, Push- und Mirror-Integration                        |
|           5 | Unknown und Konfliktauflösung           | `src/lib/sync/push.ts`, `src/lib/sync/mirror-write.ts`, `src/lib/sync/resolve-inventory-conflict.ts`, `src/lib/db/outbox.ts`                                                                       | Antwortverlust, Retry, Konfliktmatrix und Projektion                               |
|           6 | Pull/Realtime und Read-Verbraucher      | `src/lib/sync/pull.ts`, `src/lib/sync/realtime.ts`, `src/features/inventory/use-inventory-items.ts`, `src/features/shopping-list/hooks/use-complete-shopping-run.ts`                               | Pull-/Realtime-Integration, Read-Mapping und Einkaufsabschluss                     |

`baseline-and-owners` ist ein dokumentarischer Vorlauf ohne Produktionsdatei.
Die sechs Slices werden erst aktiviert, wenn der jeweilige vorherige Slice
seine Gates erfüllt; kein Slice darf einen unbuildbaren Zwischenzustand als
neue Runtime-Wahrheit veröffentlichen.

### Aktive unabhängige Beads-Reihenfolge

| Reihenfolge | Beads                      | Ergebnis                                                               |
| ----------: | -------------------------- | ---------------------------------------------------------------------- |
|           1 | `fam-9vt.5` → `fam-9vt.1`  | Rebaseline, Aktivierungsgates, kanonische Operationen und Owner-Matrix |
|           2 | `fam-9vt.9`                | Integer-Persistence-Boundary über lokale und serverseitige Grenze      |
|           3 | `fam-9vt.2`                | Vertical Cutover für Insert, Korrektur und Move                        |
|           4 | `fam-9vt.10`               | Vertical Cutover für Open, Consume und Provenienz                      |
|           5 | `fam-9vt.3`                | Vertical Cutover für Undo und Reseal                                   |
|           6 | `fam-9vt.11` → `fam-9vt.4` | Reconciliation, Aktivierungsfreigabe und Ableitung der Kind-Tickets    |

Nur dieser unabhängige Baum ist aktiv.

Der Integer-Schritt prüft die Persistenzgrenze gegen ihre Nachweise. Ein
späterer Schritt darf keinen Zwischenzustand als aktivierte v1-Wahrheit
veröffentlichen. Jede fachliche Änderung bleibt in einem eigenen Inkrement
mit höchstens vier handbearbeiteten Produktionsdateien; Tests werden separat
benannt. Vor jeder neuen Owner-Datei ist der KISS-/DRY-/YAGNI-Check im Beads-
Ticket verpflichtend.

## Owner-/Dateimatrix

Die einzige aktive Dateimatrix ist
[`owner-file-map.md`](owner-file-map.md). Sie ersetzt jede ältere oder
fragmentierte Dateiliste. Ein Dateiname, eine Exportgrenze oder eine
Verantwortung darf nur dort für die V3-Implementierung verwendet werden.

Screens, Sheets, Zeilen, Gruppierung, Lagerorte, Produktsuche und
Haltbarkeitsdaten bleiben außerhalb der Matrix, bis ein konkreter Contract-
Verstoß einen Verbraucheranpassung verlangt. Ein Suchtreffer allein ist kein
Änderungsauftrag. Keine vorsorgliche Umbenennung und keine Datei pro Operation.

## Nachweise und Artefakte

Bestehende Lifecycle-, Mengen-, Mutations-, Push-, Mirror-, Konflikt-,
Outbox- und Einkaufsabschluss-Tests werden weiterverwendet. Payload/Footprint
werden in `src/features/inventory/inventory-lifecycle.test.ts` geprüft;
lokale Atomarität im vorhandenen Mutations-/Sync-Integrationsaufbau.
Der einzige geplante neue Testpfad bleibt das vorgeschriebene Architektur-Gate:
`test/conventions/inventory-operation-ownership.test.ts`.

pgTAP `supabase/tests/01_privileges.test.sql`,
`supabase/tests/07_inventory.test.sql` und die bestehenden Inventory-Tests
24 bis 31 bleiben. Pro Inkrement nur direkt betroffene Dateien ausführen.
Tests werden nicht wegen ihres alten Dateinamens gelöscht. Strukturänderungen
behalten Erwartungen; Änderungen des fachlichen Vertrags erhalten eigene
gezielte Nachweise. Grenzen und Befehle stehen in `CONSTRAINTS.md`.

`src/lib/database.types.ts` ausschließlich neu generieren.
Bestehende Supabase-/Drizzle-Migrationen und Snapshots einschließlich
ungetrackter Dateien erhalten. Neue Artefakte aus deklarativen Schemata
ableiten; `drizzle/local/migrations.js` als Index entsprechend ergänzen.
Historische `src/lib/db/migrations.ts` nicht rückwirkend umschreiben.
Kein Löschen unbekannter Migrationen, kein automatischer DB-Reset und kein
`supabase start`. Die bereits laufende lokale Supabase-Instanz darf für
gezielte pgTAP-Läufe, `db:types`, `db:diff` und die fachliche Verifikation
genutzt werden. Remote-/Linked-Nachweise bleiben ausgeschlossen.

### Regeln für jedes weitere Inkrement

Die Implementierungsregeln I1–I6 aus `CONSTRAINTS.md` sind Bestandteil jeder
Abnahme, einschließlich der Einstiegstickets. Das Ticket nennt vor dem Edit
den relevanten Contract-Abschnitt und danach die tatsächlichen Test-/Review-
Nachweise. Fehlende Toolabdeckung bleibt explizit offen.

- Genau ein beobachtbares Ergebnis und höchstens drei Abnahmepunkte.
- Höchstens vier handbearbeitete Produktionsdateien. Tests und Harnesses
  werden zusätzlich vollständig genannt. Bei größerem Umfang vor Code in
  weitere Schritte teilen. Generierte Migrationen/Typen werden zusätzlich
  vollständig genannt; sie sind kein versteckter Zusatzumfang.
- Exakte Dateipfade, direkte Verbraucher, Blocker und vollständigen
  fokussierten Testbefehl im bestehenden Ticket oder einer Kindaufgabe
  festhalten. Keine neue Produktionsdatei durch die Aufgabenzerlegung.
- Test: `bun run test <datei> --runInBand --watchman=false`, jeden fokussierten
  Lauf innerhalb des Limits aus CONSTRAINTS. Bei TS-Änderungen zusätzlich
  `bun run typecheck` und fokussiertes Biome. Git-Kommandos gehören nicht zum
  Agentenprüfpfad.
- Schemaänderungen ausschließlich deklarativ; generierte Artefakte,
  `bun run db:types`, `bun run db:diff` und gezielte DB-Nachweise gehören zum
  selben Abnahmestand. Die bereits laufende lokale Supabase-Instanz darf
  verwendet werden; Remote-/Linked-Nutzung und `supabase start` bleiben
  ausgeschlossen.
- Gemeinsame Dateien werden nacheinander bearbeitet. Laufende In-progress-
  Tickets zuerst lesen, nicht überschreiben oder für einen neuen Plan schließen.

### Risiken und Umgang

| Risiko                                               | Umgang                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Mehrere laufende Arbeiten in denselben Owner-Dateien | Bestehenden Arbeitsstand vor jedem Inkrement prüfen; sequentiell bearbeiten                                    |
| Bekannte Mutationstest-/Harness-Baseline             | Betroffene Reproduktion prüfen und Blocker in `fam-t04` bzw. zugehörigem Ticket führen; keine Testabschwächung |
| Integer-Umstellung überschreitet lokalen Refactor    | Eigener Speicher-/Adapterblock; keine gemischte Aktivierung und keine unverifizierte Migration                 |
| Kleine Umzüge ergeben noch kein funktionsfähiges v1  | Zwischenstände nicht aktivieren oder als Featureabschluss ausgeben; Prüfpunkt C/D verlangt Parität             |
| Neue unklare fachliche Voraussetzung                 | Contract vor Umsetzung präzisieren; keine zweite lokale Ersatzregel erfinden                                   |

Die Detailplanung der späteren Sammelaufgaben erfolgt an den Prüfpunkten,
weil mehrere davon bereits in Arbeit sind. Ihre hier genannten Ergebnisse
sind verbindlich; eine noch nicht zerlegte Sammelaufgabe darf nicht direkt
als großer Implementierungsauftrag gestartet werden.
