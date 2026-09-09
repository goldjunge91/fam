# Inventory-Sync: Ausführungsplan

Status: V3-Capability-Map am 2026-09-09 übernommen; Ausführung erfolgt
schrittweise über den unabhängigen Beads-Baum `fam-9vt`.

Quellen: `CONSTRAINTS.md` setzt Qualitätsgrenzen, `contract.md` Zielverhalten.
Beads verfolgt Arbeit. Dieser Plan ist der einzige aktive Ausführungsplan.

Frühere Planentwürfe, Ticketkopplungen und Zwischenreihenfolgen sind keine
Arbeitsgrundlage.

## Capability Map und Abhängigkeitsrichtung

Diese Map ist jetzt die einzige aktive fachliche Reihenfolge. Der Contract
bleibt die einzige normative Verhaltensquelle; die Map und der Ausführungsplan
beschreiben nur Abhängigkeiten und Nachweise. Historische Beads werden nicht
automatisch übernommen. Jeder neue Implementierungsschritt entsteht unter
`fam-9vt` und darf nur von anderen `fam-9vt`-Tickets abhängen.

| Modul-ID | Verantwortung | Abhängigkeiten |
| --- | --- | --- |
| `rebaseline-and-activation` | Current-vs-Contract-Matrix, Ticket-Neuzuordnung, Aktivierungsinvarianten und offene Entscheidungen | — |
| `canonical-contract-and-ownership` | Operationsregister, diskriminierte Union, stabile IDs, Footprint, Provenienz, Ergebnis-Matrix und exakte Owner | `rebaseline-and-activation` |
| `integer-persistence-boundary` | SQLite-, Supabase-, Wire-, Outbox- und Read-Grenzen als harte Voraussetzung nachweisen | `rebaseline-and-activation`, `canonical-contract-and-ownership` |
| `quantity-operations-cutover` | Vollständiger Vertical Cutover für `in`, `out`, `waste`, `correct` und `move` | `canonical-contract-and-ownership`, `integer-persistence-boundary` |
| `open-consume-provenance-cutover` | Ledgerfreies Öffnen, Consume-Rest, Split-Provenienz und MergeSnapshotV1 über alle Schichten | `canonical-contract-and-ownership`, `integer-persistence-boundary` |
| `undo-reseal-cutover` | Append-only Undo über `reversal_of` und explizites `reseal_inventory` über alle Schichten | `canonical-contract-and-ownership`, `integer-persistence-boundary`, `open-consume-provenance-cutover` |
| `reconciliation-and-activation` | `success`/`conflict`/`invalid`/`unknown`, Receipts, Snapshots, Push/Pull/Realtime, Quarantäne und Aktivierungsfreigabe | `quantity-operations-cutover`, `open-consume-provenance-cutover`, `undo-reseal-cutover` |
| `simplification-and-ratchets` | Entfernen alter Contract-Pfade sowie unbegründeter Duplikate und Nachweis aller Ratchets | `reconciliation-and-activation` |

Build order: `rebaseline-and-activation` →
`canonical-contract-and-ownership` → `integer-persistence-boundary` →
die drei vertikalen Operations-Cutovers → `reconciliation-and-activation` →
`simplification-and-ratchets`.

Ein Vertical Cutover umfasst Lifecycle-Planung, lokalen exklusiven Commit,
Outbox/Wire/RPC, Receipt/Snapshot, Reconciliation, betroffene Reads und
fokussierte Tests. Kein lokaler oder serverseitiger Teil wird vorher als neue
v1-Wahrheit aktiviert. Alte und neue fachliche Entscheidungen dürfen nicht
parallel bestehen; der ersetzte Aufrufpfad wird im selben Inkrement entfernt.
Die Ratchets aus `CONSTRAINTS.md` gelten für jedes Modul.

## Verbindliche Dateimatrix

Keine Datei pro Operation. Fehlende Owner dürfen nach dokumentierter
KISS-/DRY-/YAGNI-Prüfung erstellt werden. Die Matrix führt tatsächliche
Kernänderungen auf; unveränderte Dateien werden nicht als Arbeitspakete
inventarisiert. Sie ist eine Owner-Referenz für die neuen `fam-9vt`-Specs,
keine eigenständige Reihenfolge und kein Auftrag, alle genannten Dateien
gemeinsam zu ändern. Pfade gelten relativ zur Repositorywurzel.

### Bestehende Owner gezielt ändern

| Datei | Verbleibende Aufgabe | Was entfällt / wohin die Logik geht |
| --- | --- | --- |
| `src/features/inventory/inventory-lifecycle.ts` | Reine Fachpläne, kanonische Operationstypen, Payloadvalidierung und Footprint | Open-/Undone-Notes-Heuristiken entfallen; keine DB-/React-/Sync-Imports |
| `src/lib/sync/inventory-quantity.ts` | Gemeinsamer lokaler Schreibpfad: frisch lesen, Plan anwenden, Bestand/Ledger/Outbox atomar schreiben | Payloadparser und Entscheidungen → Lifecycle; fünf bisherige Einzelmodule hier zusammenführen |
| `src/features/inventory/use-inventory-mutations.ts` | Bestehende Hooks und Query-Invalidierung | Fachentscheidungen → Lifecycle; lokale Befehle → vorhandener Schreibpfad |
| `src/features/inventory/use-inventory-transactions.ts` | Verlauf lesen, gruppieren und beschriften | Eigene Undo-Zeit-/Typheuristik → Lifecycle; keine zweite Undo-Regel |
| `src/lib/sync/push.ts` | RPC-Transport, Reihenfolge, Retry und Ack | Parser/Footprint → Lifecycle; bestehendes completeInventoryPush nutzen; Basisübernahme → mirror-write |
| `src/lib/sync/mirror-write.ts` | Konsistenter Snapshot und atomare lokale Projektion | Eigene Facharithmetik → Lifecycle; keine direkte Übernahme historischer Ack-Ergebniszeilen |
| `src/lib/db/outbox-conflicts.ts` | Konflikt- und Abhängigkeitsdaten lesen | Eigene Operationsliste und entity_id=Footprint-Annahme entfernen |
| `src/lib/sync/resolve-inventory-conflict.ts` | Discard/Reconfirm orchestrieren | Neue Absicht über lokalen Schreibpfad; Projektion über mirror-write; unbekannten Ausgang zuerst klären |
| `src/features/shopping-list/hooks/use-complete-shopping-run.ts` | Einkaufsabschluss orchestrieren | Doppelte Inventory-/Ledger-Erzeugung → lokaler Schreibpfad; übriger Abschluss bleibt |

Die Kernänderungen werden durch die folgenden Integrations- und
Persistenzanpassungen ergänzt.

### Fünf Produktionsdateien nach Zusammenführung löschen

| Datei | Ersatz |
| --- | --- |
| `src/lib/sync/inventory-quantity-correction.ts` | Parser/Typen in Lifecycle; lokale Ausführung in sync/inventory-quantity |
| `src/lib/sync/inventory-quantity-reversal.ts` | Parser/Typen in Lifecycle; lokale Ausführung in sync/inventory-quantity |
| `src/lib/sync/inventory-move.ts` | Parser/Typen in Lifecycle; lokale Ausführung in sync/inventory-quantity |
| `src/lib/sync/inventory-open-split.ts` | Fachlich gültige Open-/Consume-Wirkungen im Lifecycle und lokalen Schreibpfad; alter split_open-Payload entfällt |
| `src/lib/sync/inventory-open-merge.ts` | Merge-Undo-Modus im Lifecycle und lokalen Schreibpfad |

Vor jeder Löschung: keine verbleibenden Imports/Registrierungen, übernommene
Verhaltensnachweise bestehen, fokussierte Tests und Typ-/Lint-Prüfung bestehen.
Kein Übergangsdecoder oder Wrapper nur für alte Imports. Bestehende Testdateien
bleiben und prüfen die neuen Owner; vertraglich ersetzte Erwartungen werden
explizit zugeordnet, nicht still entfernt. Keine pauschalen Git-Reverts.

### Integration

| Bestehende Dateien | Eng begrenzte Anpassung |
| --- | --- |
| `src/lib/db/types.ts`, `src/lib/db/outbox.ts` | Inventory-v1-Typen verwenden, Request unverändert speichern; vorhandene exklusive Transaktion weiterverwenden |
| `src/lib/sync/coalesce.ts`, `src/lib/db/outbox-retry.ts` | Keine Umschreibung stabiler Inventory-Operationen; Retry-Limit macht unknown nicht zum fachlichen Konflikt |
| `src/lib/sync/pull.ts`, `src/lib/sync/realtime.ts` | Inventory-Aktualisierung an vorhandenen Reconciliation-Owner delegieren; andere Entitäten behalten ihren Pfad |
| `src/lib/db/entities.ts` | Spaltenabbildung an Zielmodell anpassen; Inventory-Payload darf nach FK-Fehler nicht still geändert werden |

`src/features/inventory/repair-fridge-item-push.ts`: Bei Umstellung der
Registrierung den stillen
location_id=null-Reparaturpfad ausschließen. Erst wenn kein Verbraucher
verbleibt und die Location-Abhängigkeit nachgewiesen ist, kann die Datei als
toter Code entfallen; diese zusätzliche Löschung wird dann separat benannt.

### Persistenz und Mengengrenzen: eigener fachlicher Änderungsblock

Inventory-Mengen werden in Persistenz und Wire als Integer-Tausendstel
geführt. Diese Datenmodelländerung wird getrennt von reinen
Strukturänderungen umgesetzt und geprüft.

| Bestehende Dateien | Notwendiger Umfang |
| --- | --- |
| `src/lib/inventory-quantity.ts` | Integer-Arithmetik und eindeutige Konversion an Domänen-/Anzeigegrenzen; vom lokalen Schreibpfad getrennt halten |
| `src/lib/db/schemas/inventory.ts`, `src/lib/db/schemas/system.ts` | Lokale Integer-Spalten, v1-Metadaten, dauerhafte Serverbasis und Receipts |
| `supabase/schemas/08_inventory.sql`, `supabase/schemas/20_privileges.sql` | Autoritative v1-Operationen, Integer-Spalten, Receipt/Snapshot und Privilegien; andere Tabellen nicht umbauen |
| `src/features/inventory/use-inventory-items.ts` | Persistenz-/View-Grenze einmal konvertieren; vorhandene Screen-Schnittstelle möglichst erhalten |
| `src/features/meal-planner/use-shopping-needs.ts`, `src/features/recipes/data/use-recipe-shopping-needs.ts` | Direkte Inventory-Reads in bestehende Bedarfs-Mengeneinheit abbilden |
| `src/features/settings/sync-debug-screen.tsx` | Direkt gelesene Inventory-Mengen korrekt anzeigen |

Mengen im Produktkatalog, Shopping oder Nutrition werden nicht pauschal
umgestellt. Beim bereits oben genannten Einkaufsabschluss wird einmal an
der Inventory-Grenze konvertiert. Integer- und Dezimal-Schreibpfade werden
nicht gleichzeitig aktiviert. Generierte DB-Typen und Migrationen gehören
zum Abschluss dieses Blocks, nicht zu einer allgemeinen Aufräumaktion.

### Behalten ohne vorsorglichen Umbau

Screens, Sheets, Zeilen, Gruppierung, Lagerorte, Produktsuche, Haltbarkeitsdaten,
`use-inventory-conflicts.ts`, Sync-Engine und Runner bleiben grundsätzlich.
Eine UI-Datei wird erst dann Änderungsziel, wenn ein konkreter Aufruf oder
Datenwert mit dem Zielvertrag unvereinbar ist; betroffene Stelle und Grund
werden vorher im Beads-Inkrement und hier ergänzt. Ein Suchtreffer allein
ist kein Änderungsauftrag. Kein Redesign und keine vorsorgliche Umbenennung.

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
lokaler Supabase-Start. Nicht ausführbare DB-Gates bleiben offen.

## Aktive V3-Umsetzung und Aufgaben

Der aktive Ticketbaum ist ausschließlich `fam-9vt`:

| Reihenfolge | Beads | Modul-ID | Ergebnis |
| ---: | --- | --- | --- |
| 1 | `fam-9vt.5` | `rebaseline-and-activation` | Current-vs-Contract-Matrix, Aktivierungsinvarianten und offene Entscheidungen |
| 2 | `fam-9vt.1` | `canonical-contract-and-ownership` | Kanonisches Operationsmodell, Owner, Importgrenzen und Ergebnis-Matrix |
| 3 | `fam-9vt.9` | `integer-persistence-boundary` | Nachweis oder eng abgegrenzte Lücken an allen Mengen-/Persistence-Grenzen |
| 4a | `fam-9vt.2` | `quantity-operations-cutover` | Vertical-Cutover-Spec für Mengenoperationen |
| 4b | `fam-9vt.10` | `open-consume-provenance-cutover` | Vertical-Cutover-Spec für Öffnen, Consume und Provenienz |
| 5 | `fam-9vt.3` | `undo-reseal-cutover` | Vertical-Cutover-Spec für Undo und Reseal |
| 6 | `fam-9vt.11` | `reconciliation-and-activation` | Ergebnis-Matrix, Reconciliation und Aktivierungsfreigabe |
| 7 | `fam-9vt.4` | `simplification-and-ratchets` | Kleine Implementierungs-Child-Tickets und Ratchet-Nachweise |

4a und 4b sind nach den gemeinsamen Voraussetzungen parallel planbar. Code
beginnt erst, wenn die jeweils vorgelagerte Spec freigegeben ist. Ein neues
Ticket darf keine Dependency außerhalb des `fam-9vt`-Graphs erhalten.

Jedes spätere Implementierungsticket muss enthalten:

- genau eine beobachtbare Wirkung und höchstens drei Abnahmepunkte,
- exakte Owner-Dateien und höchstens vier handbearbeitete Produktionsdateien;
  Tests und Harnesses werden separat benannt,
- den KISS-/DRY-/YAGNI-Check für jeden neuen Owner, Helper, Adapter oder jede
  neue Abstraktion,
- den vollständigen Vertical-Cutover der betroffenen Operation,
- die Ergebnis-/Retry-/Unknown-Matrix für die betroffene Grenze,
- fokussierte Verify-Befehle sowie den Nachweis für Typecheck, Biome,
  Ownership, Effective LOC und Duplikate.

Keine neue v1-Payload wird aktiviert, solange ihr lokaler Commit, Serverpfad,
Receipt/Snapshot, Reconciliation und Read-Verbraucher nicht gemeinsam
nachgewiesen sind. Eine neue kanonische Entscheidung wird im selben
Inkrement mit ihrem alten Aufrufpfad entfernt; keine temporäre
Doppelentscheidung für ein LOC-Ziel.
