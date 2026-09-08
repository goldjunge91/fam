# Inventory-Sync: Ausführungsplan

Status: Contract und Matrix sind vor Produktionsänderungen gemeinsam zu prüfen.

Quellen: `CONSTRAINTS.md` setzt Qualitätsgrenzen, `contract.md` Zielverhalten.
Beads verfolgt Arbeit; historische Verträge in `fam-lem.18` sind keine zweite
normative Quelle. Dieser Plan ist der einzige aktive Ausführungsplan.

## Verbindliche Dateimatrix

**Keine neuen Produktionsdateien.** Keine Datei pro Operation. Die Matrix
führt tatsächliche Kernänderungen auf; unveränderte Dateien werden nicht als
Arbeitspakete inventarisiert. Pfade gelten relativ zur Repositorywurzel.

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

## Umsetzung und Aufgaben

Aufgaben und Abnahme stehen in Beads. Dieser Abschnitt ist der geordnete
Index, keine zweite Aufgabenliste. Der Einstieg ist ausführbar zugeschnitten;
die anschließenden Sammelaufgaben werden vor Bearbeitung anhand ihres dann
aktuellen Restumfangs in ebenso kleine Inkremente geteilt. Kein Sammel-Ticket
ist ein Auftrag, alle dort genannten Dateien auf einmal umzubauen.

### Einstieg

| Reihenfolge | Beads | Ergebnis | Umfang |
| --- | --- | --- | --- |
| 1 | `fam-lem.19` | v1-Typen, strikte Payloadvalidierung und vollständiger Footprint im reinen Lifecycle; noch kein Runtime-Cutover | Lifecycle und bestehender Test, 2 Dateien |
| 2 | `fam-lem.19.1` | Ownership-Gate für reines Lifecycle-Modul und erlaubte Import-Richtung | 1 neue Testdatei, keine neue Produktionsdatei |
| 3 | `fam-lem.23` | Vorhandene Servergarantien und ausführbarer DB-Nachweis abgeglichen; fehlende Arbeit konkret abgegrenzt | Read-only, Ergebnis in Beads |

**Prüfpunkt A:** Typen/Footprint sind eindeutig, der fokussierte Gate-Test
besteht, DB-Prüfung ist durchführbar oder konkret als Blocker ausgewiesen.
Bestehende Baselinefehler einschließlich `fam-t04` bleiben sichtbar. Kein
Schema-Cutover ohne ausführbaren Nachweis. Plan-/Contractfreigabe ist vor
Produktionsänderungen erforderlich; diese Planung erteilt sie nicht selbst.

### Bestehende Arbeitsstände fortführen

| Reihenfolge | Beads | Nächstes abgegrenztes Ergebnis / Voraussetzung |
| --- | --- | --- |
| 4 | `fam-lem.26`, `fam-lem.24` | Laufenden gemeinsamen Push-Abschluss und expliziten Patch-Arbeitsstand zuerst abgleichen; nur tatsächliche Restfehler schließen |
| 5 | `fam-lem.27.1` unter `fam-lem.27` | Genau den lokalen Korrektur-Builder in den vorhandenen gemeinsamen Schreibpfad verschieben; höchstens 5 Dateien, unverändertes Verhalten |

**Prüfpunkt B:** Die Korrektur hat nur einen lokalen Builder, bisherige
Testerwartungen bestehen, keine neue Produktionsdatei und kein neuer
Transaktionsmanager. Falls der Schritt eine fachliche Änderung verlangt,
wird diese separat beschrieben; der reine Umzug wird nicht damit vermischt.

| Reihenfolge | Beads | Weiterer Restumfang, vor Ausführung in kleine Schritte teilen |
| --- | --- | --- |
| 6 | `fam-lem.27`, `fam-lem.28`, `fam-lem.29` | Weitere lokale Pfade einzeln zusammenführen; Fachpläne für Consume/Open/Undo getrennt korrigieren; Hooks und Einkaufsabschluss an denselben Owner anbinden |
| 7 | `fam-lem.22`, `fam-n46` | Nach Vorprüfung aus .23 Server-/Persistenzänderung: jeweils eine RPC oder eine Speichergrenze mit zugeordnetem Test; Integer-Umstellung und generierte Artefakte explizit mitführen |

**Prüfpunkt C:** Lokale und serverseitige Wirkung für die bearbeitete Operation
stimmt überein: Menge, IDs, Ledger, Tombstone, Preconditions und Retry.
Generierte Artefakte und Typen passen. Weitere Operationen erst nach diesem
Nachweis fortsetzen; noch keine gemeinsame v1-Aktivierung.

| Reihenfolge | Beads | Weiterer Restumfang, vor Ausführung in kleine Schritte teilen |
| --- | --- | --- |
| 8 | `fam-onu` | Dauerhafte Basis/Ack-Speicherung, Snapshot-Projektion und Pull-/Realtime-Anbindung jeweils getrennt mit Rennbedingungsnachweis |
| 9 | `fam-lem.20`, `fam-lem.25` | Vollständige Abhängigkeiten und anschließend Discard/Reconfirm; unknown niemals blind entfernen |
| 10 | `fam-lem.21` | Abschließende Nachweisprüfung und Aktivierungsfreigabe; keine neue Sammelimplementierung |

**Prüfpunkt D:** Antwortverlust, verspäteter Ack, neue lokale Mutation während
Read und Konfliktauflösung sind über den vollständigen Footprint geprüft.
Jede der fünf Modul-Löschungen hat keine verbleibenden Imports und erhaltene
Verhaltensnachweise. Integer-/Dezimal-Grenzen sind durchgehend konsistent.
Erst dann wird der gesamte v1-Schreibpfad als nutzbar freigegeben.

### Regeln für jedes weitere Inkrement

Die Implementierungsregeln I1–I6 aus `CONSTRAINTS.md` sind Bestandteil jeder
Abnahme, einschließlich der Einstiegstickets. Das Ticket nennt vor dem Edit
den relevanten Contract-Abschnitt und danach die tatsächlichen Test-/Review-
Nachweise. Fehlende Toolabdeckung bleibt explizit offen.

- Genau ein beobachtbares Ergebnis und höchstens drei Abnahmepunkte.
- Höchstens fünf handbearbeitete Quell-/Testdateien. Bei größerem Umfang
  vor Code in weitere Schritte teilen. Generierte Migrationen/Typen werden
  zusätzlich vollständig genannt; sie sind kein versteckter Zusatzumfang.
- Exakte Dateipfade, direkte Verbraucher, Blocker und vollständigen
  fokussierten Testbefehl im bestehenden Ticket oder einer Kindaufgabe
  festhalten. Keine neue Produktionsdatei durch die Aufgabenzerlegung.
- Test: `bun run test <datei> --runInBand --watchman=false`, jeden fokussierten
  Lauf innerhalb des Limits aus CONSTRAINTS. Bei TS-Änderungen zusätzlich
  `bun run typecheck` und fokussiertes Biome, danach `git diff --check`.
- Schemaänderungen ausschließlich deklarativ; generierte Artefakte,
  `bun run db:types` und gezielte DB-Nachweise gehören zum selben Abnahmestand.
  Keine lokale Supabase-Instanz starten. Fehlende DB-Ausführung bleibt Blocker.
- Gemeinsame Dateien werden nacheinander bearbeitet. Laufende In-progress-
  Tickets zuerst lesen, nicht überschreiben oder für einen neuen Plan schließen.

### Risiken und Umgang

| Risiko | Umgang |
| --- | --- |
| Mehrere laufende Arbeiten in denselben Owner-Dateien | Bestehenden Arbeitsstand vor jedem Inkrement prüfen; sequentiell bearbeiten |
| Bekannte Mutationstest-/Harness-Baseline | Betroffene Reproduktion prüfen und Blocker in `fam-t04` bzw. zugehörigem Ticket führen; keine Testabschwächung |
| Integer-Umstellung überschreitet lokalen Refactor | Eigener Speicher-/Adapterblock; keine gemischte Aktivierung und keine unverifizierte Migration |
| Kleine Umzüge ergeben noch kein funktionsfähiges v1 | Zwischenstände nicht aktivieren oder als Featureabschluss ausgeben; Prüfpunkt C/D verlangt Parität |
| Neue unklare fachliche Voraussetzung | Contract vor Umsetzung präzisieren; keine zweite lokale Ersatzregel erfinden |

Die Detailplanung der späteren Sammelaufgaben erfolgt an den Prüfpunkten,
weil mehrere davon bereits in Arbeit sind. Ihre hier genannten Ergebnisse
sind verbindlich; eine noch nicht zerlegte Sammelaufgabe darf nicht direkt
als großer Implementierungsauftrag gestartet werden.
