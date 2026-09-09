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
| `quantity-persistence-boundary`   | Dezimal-Mengenpersistenz, lokale Spiegelung und benannte Mengen-/Read-Grenzen     | `baseline-and-owners`          |
| `local-quantity-operations`       | Insert, Korrektur und Move mit kanonischer Planung und atomarer Outbox-Ausführung  | `quantity-persistence-boundary` |
| `local-lifecycle-operations`      | Open, Consume, Waste und Undo inklusive Provenienz                                 | `local-quantity-operations`    |
| `server-receipt-path`             | RPCs, Receipts, Idempotenz, Snapshot-Basis, RLS und Push-Ack                       | `local-lifecycle-operations`   |
| `unknown-conflict-reconciliation` | Unknown, Konflikte, Pull/Realtime-Reconciliation und sichere Projektion            | `server-receipt-path`          |

Build order: `baseline-and-owners` → `quantity-persistence-boundary` →
`local-quantity-operations` → `local-lifecycle-operations` →
`server-receipt-path` → `unknown-conflict-reconciliation`.

### Aktive V3-Slices

Jeder Slice bearbeitet höchstens vier Produktionsdateien. Tests und Harnesses
werden zusätzlich benannt. Vor jeder neuen Owner-Datei ist der im Contract
geforderte KISS-/DRY-/YAGNI-Check im Beads-Ticket abzulegen.

| Reihenfolge | Slice                                   | Produktionsdateien (max. 4)                                                                                                                                                                        | Primäre Nachweise                                                                  |
| ----------: | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
|           1 | Dezimal-Mengen-/Persistenzgrenze       | `src/lib/inventory-quantity.ts`, `src/lib/db/schemas/inventory.ts`, `src/lib/db/schemas/system.ts`, `supabase/schemas/08_inventory.sql`                                                            | Mengen-Unit-Tests, lokale Schema-Tests, deklarativer `db:diff`-Nachweis             |
|           2 | Insert, Korrektur und Move lokal atomar | `src/features/inventory/inventory-lifecycle.ts`, `src/lib/sync/inventory-quantity.ts`, `src/features/inventory/use-inventory-mutations.ts`, `src/lib/db/outbox.ts`                                 | Lifecycle-Grenzfälle, Mutations-Integration, Rollback-/Outbox-Test, Ownership-Gate |
|           3 | Open, Consume, Waste und Provenienz     | `src/features/inventory/inventory-lifecycle.ts`, `src/lib/sync/inventory-quantity.ts`, `src/features/inventory/use-inventory-mutations.ts`, `src/features/inventory/use-inventory-transactions.ts` | Lifecycle- und Mutations-Tests für Tombstones, Footprint und Ledger                |
|           4 | Server-Receipt, Idempotenz und RLS      | `supabase/schemas/08_inventory.sql`, `supabase/schemas/20_privileges.sql`, `src/lib/sync/push.ts`, `src/lib/sync/mirror-write.ts`                                                                  | Receipt-/RLS-/Atomicity-pgTAP, Push- und Mirror-Integration                        |
|           5 | Unknown und Konfliktauflösung           | `src/lib/sync/push.ts`, `src/lib/sync/mirror-write.ts`, `src/lib/sync/resolve-inventory-conflict.ts`, `src/lib/db/outbox.ts`                                                                       | Antwortverlust, Retry, Konfliktmatrix und Projektion                               |
|           6 | Pull/Realtime, Reads und Shopping-Transfer | `src/lib/sync/pull.ts`, `src/lib/sync/realtime.ts`, `src/features/inventory/use-inventory-items.ts`, `src/features/shopping-list/hooks/use-complete-shopping-run.ts`                            | Pull-/Realtime-Integration, Read-Model und dezimaler Einkaufsabschluss             |

`baseline-and-owners` ist ein dokumentarischer Vorlauf ohne Produktionsdatei.
Die sechs Slices werden erst aktiviert, wenn der jeweilige vorherige Slice
seine Gates erfüllt; kein Slice darf einen unbuildbaren Zwischenzustand als
neue Runtime-Wahrheit veröffentlichen.

Slice 1 verändert in `08_inventory.sql` ausschließlich die deklarative
Speichergrundlage: Tabellen, Spalten, Constraints und die v1-Pflicht für
`location_id`. Mutations-RPCs, `inventory_applied_operations`, der
Snapshot-Read und die dazugehörigen Privilegien werden erst in Slice 4
ergänzt. Slice 1 aktiviert keine fachliche Serveroperation.

### Aktive unabhängige Beads-Reihenfolge

| Reihenfolge | Beads                      | Ergebnis                                                               |
| ----------: | -------------------------- | ---------------------------------------------------------------------- |
|           1 | `fam-9vt.5` → `fam-9vt.1`  | Rebaseline, Aktivierungsgates, kanonische Operationen und Owner-Matrix |
|           2 | `fam-9vt.9`                | Mengen-/Persistenzgrenze über lokale und serverseitige Grenze          |
|           3 | `fam-9vt.2`                | Vertical Cutover für Insert, Korrektur und Move                        |
|           4 | `fam-9vt.10`               | Vertical Cutover für Open, Consume und Provenienz                      |
|           5 | `fam-9vt.3`                | Vertical Cutover für Undo und Reseal                                   |
|           6 | `fam-9vt.11` → `fam-9vt.4` | Reconciliation, Aktivierungsfreigabe und Ableitung der Kind-Tickets    |

Nur dieser unabhängige Baum ist aktiv.

Der Mengen-/Persistenzschritt prüft die Dezimalgrenze gegen ihre Nachweise. Ein
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

### Reset-Baseline und Aktivierungsgrenze

Der aktuelle Reset-Arbeitsbaum ist keine aktivierte Runtime-Wahrheit. Einige
Bestandsverbraucher importieren noch alte oder geplante APIs, während die
zugehörigen Owner-Dateien fehlen. Diese Imports sind bekannte Baseline-Befunde
und keine erlaubte Zielabhängigkeit. Ein Slice darf erst aktiviert werden,
wenn seine direkten Verbraucher auf die in `owner-file-map.md` registrierte
API zeigen und kein Verbraucher eine fehlende Ziel-Datei importiert.

Der Shopping-Abschluss bleibt deshalb in Slice 6. Er ist ein Release-Gate für
den Transferpfad, aber keine zusätzliche Produktionsdatei in Slice 2. Slice 2
kann den kanonischen lokalen Commit beweisen; v1 darf erst nach dem dezimalen
Shopping-Transfer in Slice 6 aktiviert werden.

Die generischen Owner `outbox.ts` und `mirror-write.ts` werden auch von
anderen Domänen verwendet. Die Importlisten in der Owner-Map beschreiben für
diese Dateien nur den Inventory-Sync-Pfad und sind keine vollständige Liste
aller projektweiten Verbraucher. Ein generischer Verbraucher darf dadurch
nicht in einen Inventory-Owner verschoben werden.

Für den Inventory-Pfad bleibt `mirror-write.ts` der einzige
Reconciliation-Owner. Er darf die reinen Operationstypen, Footprints und
Projektionsergebnisse des Lifecycle-Owners verwenden, aber keine zweite
Mengen-, Öffnungs-, Undo- oder Konfliktregel enthalten. Ein neues
`src/lib/sync/reconciliation/`-Verzeichnis oder eine zusätzliche
Adapterdatei würde diese Grenze unnötig verdoppeln und wird nicht angelegt.

## Nachweise und Artefakte

Bestehende Lifecycle-, Mengen-, Mutations-, Push-, Mirror-, Konflikt-,
Outbox- und Einkaufsabschluss-Testdateien bleiben als Pfade erhalten, werden
aber nicht ungeprüft als v1-Nachweis weiterverwendet. Insbesondere die pgTAP-
Dateien 27 bis 31 sowie die Inventory-Push-/Mirror-Integrationstests enthalten
noch alte RPC-Namen, `bigint`, künstlich skalierte Werte oder Legacy-Felder.
Sie werden in ihren bestehenden Dateien schrittweise auf den Dezimal-,
Receipt- und Unknown-Vertrag umgestellt. Payload/Footprint werden in
`src/features/inventory/inventory-lifecycle.test.ts` geprüft; lokale
Atomarität bleibt im vorhandenen Mutations-/Sync-Integrationsaufbau.
Zusätzlich bleiben Lifecycle-, Konflikt- und Mengenpersistenz-Gates
verpflichtend. Das Architektur-Gate
`test/conventions/inventory-operation-ownership.test.ts` ist nur eines von
mehreren Gates und ersetzt die fachlichen Nachweise nicht.

pgTAP `supabase/tests/01_privileges.test.sql`,
`supabase/tests/07_inventory.test.sql` und die bestehenden Inventory-Tests
24 bis 31 bleiben als Dateipfade bestehen. Pro Inkrement werden nur direkt
betroffene Dateien ausgeführt. Tests werden nicht wegen ihres alten
Dateinamens gelöscht; fachlich veraltete Erwartungen werden in derselben
Datei ersetzt und mit dem jeweils betroffenen Contract-Abschnitt begründet.
Grenzen und Befehle stehen in `CONSTRAINTS.md`.

`src/lib/database.types.ts` ausschließlich neu generieren.
Bestehende Supabase-/Drizzle-Migrationen und Snapshots einschließlich
ungetrackter Dateien erhalten. Neue Artefakte aus deklarativen Schemata
ableiten; `drizzle/local/migrations.js` als Index entsprechend ergänzen.
Historische `src/lib/db/migrations.ts` nicht rückwirkend umschreiben.
Kein Löschen unbekannter Migrationen und kein automatischer DB-Reset. Die
Supabase-CLI und die bereits laufende lokale Instanz dürfen für gezielte
pgTAP-Läufe, `db:types`, `db:diff` und die fachliche Verifikation genutzt
werden. Für lokale Befehle ist kein Link erforderlich.

### V1-Aktivierungsgates

Die folgenden Gates müssen gemeinsam grün sein, bevor ein Inventory-v1-
Schreibpfad oder eine neue Runtime-Wahrheit aktiviert wird:

| Gate | Nachweis |
| --- | --- |
| Dezimal-Mengenbasis | `300 g` bleibt `300`; `0,5 Stück` und `0,6 Dose` bleiben gültig; mehr als eine Nachkommastelle wird abgewiesen; kein `* 1000` und keine zweite Rundung |
| Schema-Parität | lokale Drizzle-Spalten, deklaratives Supabase-Schema, generierte `database.types.ts`, Wire-Payload und Mirror verwenden dieselbe Dezimaldarstellung |
| Verbraucher-Parität | Inventory-UI, Mutations-Hooks und Shopping-Transfer nutzen ausschließlich den kanonischen Commit-/Read-Owner; kein direkter Outbox-/Mirror-Schreibpfad im Verbraucher |
| Lagerort-Pflicht | bestehende `location_id = null`-Zeilen sind vor Aktivierung einmalig bereinigt; neue Insert-, Move- und UI-Pfade verlangen einen gültigen Lagerort |
| Owner-/Import-Gate | jede Operation besitzt genau einen Plan-Owner und einen Commit-Owner; keine fehlende Ziel-Datei wird importiert; generische Outbox-/Mirror-Imports bleiben außerhalb des Inventory-Owners zulässig |
| Fachliche Tests | Lifecycle, Mengenpersistenz, lokale Atomarität, Receipt/Idempotenz, Unknown/Reconciliation, Konflikte und pgTAP-RLS laufen fokussiert grün |


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
  selben Abnahmestand. Die laufende lokale Supabase-Instanz darf verwendet
  werden; ein Link ist dafür nicht erforderlich.
- Gemeinsame Dateien werden nacheinander bearbeitet. Laufende In-progress-
  Tickets zuerst lesen, nicht überschreiben oder für einen neuen Plan schließen.

### Risiken und Umgang

| Risiko                                               | Umgang                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Mehrere laufende Arbeiten in denselben Owner-Dateien | Bestehenden Arbeitsstand vor jedem Inkrement prüfen; sequentiell bearbeiten                                    |
| Bekannte Mutationstest-/Harness-Baseline             | Betroffene Reproduktion prüfen und Blocker in `fam-t04` bzw. zugehörigem Ticket führen; keine Testabschwächung |
| Mengen-/Persistenzumstellung überschreitet lokalen Refactor | Eigener Speicher-/Adapterblock; keine gemischte Aktivierung und keine unverifizierte Migration                 |
| Kleine Umzüge ergeben noch kein funktionsfähiges v1  | Zwischenstände nicht aktivieren oder als Featureabschluss ausgeben; Prüfpunkt C/D verlangt Parität             |
| Neue unklare fachliche Voraussetzung                 | Contract vor Umsetzung präzisieren; keine zweite lokale Ersatzregel erfinden                                   |

Die Detailplanung der späteren Sammelaufgaben erfolgt an den Prüfpunkten,
weil mehrere davon bereits in Arbeit sind. Ihre hier genannten Ergebnisse
sind verbindlich; eine noch nicht zerlegte Sammelaufgabe darf nicht direkt
als großer Implementierungsauftrag gestartet werden.
