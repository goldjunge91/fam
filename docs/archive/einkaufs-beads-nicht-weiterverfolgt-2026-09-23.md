# Einkaufs-Beads auf Nutzerwunsch nicht weiterverfolgt

**Stand:** 2026-09-23  
**Status:** Historischer Nachweis  
**Quelle:** Beads-Inhalte der sechs geschlossenen Einkaufsaufgaben

Die sechs offenen Einkaufs-Beads sind auf ausdrücklichen Wunsch von Marco als
**„auf Nutzerwunsch nicht weiterverfolgt“** geschlossen worden:

- `.18` = `fam-ymz7.18`
- `.20` = `fam-ymz7.20`
- `.21` = `fam-ymz7.21`
- `fam-ie54`
- `fam-gng6`
- `fam-jlkw`

Die Schließung bedeutet ausdrücklich **verworfen**, nicht implementiert und
nicht technisch behoben. Die vorhandenen Befunde bleiben historische Hinweise.
Es wurden dafür keine Produktions-, Schema- oder Teständerungen vorgenommen.
Die jeweils aufgeführten Beschreibungen, Designs und Abnahmekriterien sind der
vollständige historische Bead-Inhalt; sie sind keine nachträglich erfüllten
Abnahmen. Für den aktuellen Stand sind `Status: CLOSED` und der gemeinsame
Schließungsgrund maßgeblich. In den Beads genannte Zielpfade können deshalb
absichtlich nicht vorhanden sein.

## Gemeinsamer Schließungsgrund

> Auf ausdrücklichen Wunsch von Marco nicht weiterverfolgt: Im Einkauf sind
> keine Änderungen gewünscht. Geschlossen als verworfen, nicht als
> implementiert oder technisch behoben. Vorhandene Befunde bleiben historische
> Hinweise; keine Produktions-, Schema- oder Teständerung.

## `fam-ymz7.18` (`.18`)

**Titel:** Stage 5: checkedItems/transfers-Bijektionsguard implementieren  
**Typ:** Task  
**Priorität:** P1  
**Status:** CLOSED  
**Erstellt von:** Goldjunge91  
**Erstellt:** 2026-09-23  
**Aktualisiert:** 2026-09-23

### Close reason

Auf ausdrücklichen Wunsch von Marco nicht weiterverfolgt: Im Einkauf sind keine
Änderungen gewünscht. Geschlossen als verworfen, nicht als implementiert oder
technisch behoben. Vorhandene Befunde bleiben historische Hinweise; keine
Produktions-, Schema- oder Teständerung.

### Description

Warum: `checkedItems` ohne zugehörigen Transfer werden aktuell historisiert und
gelöscht, ohne Bestand anzulegen. Scope: reiner Validator in
`src/features/shopping-list/domain/shopping-run-contract.ts`, Aufruf am
Eingang von `use-complete-shopping-run.ts` und deren Tests. Nicht-Scope:
Transaktionsumbau, Restore/Undo, Receipts, CAS, RLS oder Sync.

### Design

Owner: `src/features/shopping-list/domain/shopping-run-contract.ts` plus der
bestehende `use-complete-shopping-run`-Hook. Fehler:
`ShoppingRunContractError` mit Code `SHOPPING_RUN_NOT_BIJECTIVE` und exakt
sortierten Details `checkedCount`, `transferCount`, `duplicateCheckedIds`,
`duplicateTransferIds`, `missingTransferIds`, `additionalTransferIds`. Keine
Restore-, Reverse-, Receipt-, Pull-, Realtime-, Outbox-Retention-, CAS-, RLS-
oder Forward-Atomaritätsänderung.

### Notes

Freigegebene Planung: `fam-ymz7.10`. Erst nach Implementierung und
unabhängiger Review darf diese Aufgabe geschlossen werden.

Standprüfung 2026-09-23: aktueller Code/CLI bestätigt den Ausgangsbefund. Scope
und Abschluss hier auf Marcos Auftrag präzisiert; historische Notes sind keine
aktuelle Implementierungsabnahme.

Der in den historischen Notes enthaltene Satz „`fam-ie54` bleibt offen“ wurde
durch die spätere Nutzerentscheidung und den dokumentierten Schließungsgrund
überholt; der aktuelle Bead-Status ist CLOSED.

### Acceptance criteria

Bijektion gilt genau für gleiche ID-Mengen ohne Duplikate und mit gleichen
Eingabelängen. Ungültige Eingaben liefern `ShoppingRunContractError` /
`SHOPPING_RUN_NOT_BIJECTIVE` mit den in `fam-ymz7.10` definierten exakt
sortierten Details; kein History-, Mirror- oder Outbox-Write erfolgt.
Unit-Tests prüfen gültige Eingaben, Längenabweichung, beide Duplikatarten,
fehlende und zusätzliche Transfers; Hook-Test belegt den Abbruch vor Writes.
Gültiger Abschluss bleibt möglich.

Abnahme für TS/TSX: gezielte Verhaltenstests über
`bun run test -- <betroffene Testpfade>`, `bun run check` und
`bun run typecheck`; erforderliche Reviewbefunde behoben. `CONSTRAINTS.md`
einschließlich Scope-/Duplikationsgrenzen bleibt verbindlich. Fehlende
Nachweise oder Umgebungen sind offen/blockiert, niemals grün. Kein erneutes
Gesamtaudit und keine zusätzlichen Statusdokumente.

### Relations

- Parent: `fam-ymz7` – Bun-Toolchain abschließen und allgemeine Sync-Folgearbeiten abgrenzen (P1)
- Depends on: `fam-ymz7.10` – Shopping-Run-Bijektion planen (Umsetzung: `fam-ymz7.18`) (P1)
- Blocks: `fam-ie54` – Einkaufsabschluss atomar über Vorrat, Historie und Listen-Tombstones ausführen (P1)

## `fam-ymz7.20` (`.20`)

**Titel:** Markt-Einkaufsliste auf FlashList umstellen  
**Typ:** Task  
**Priorität:** P2  
**Status:** CLOSED  
**Erstellt von:** Goldjunge91  
**Erstellt:** 2026-09-23  
**Aktualisiert:** 2026-09-23

### Close reason

Auf ausdrücklichen Wunsch von Marco nicht weiterverfolgt: Im Einkauf sind keine
Änderungen gewünscht. Geschlossen als verworfen, nicht als implementiert oder
technisch behoben. Vorhandene Befunde bleiben historische Hinweise; keine
Produktions-, Schema- oder Teständerung.

### Description

Warum: Der produktive Marktfilter verwendet weiterhin `SectionList` und verletzt
die vereinbarte FlashList-Konvention. `fam-ymz7.11` hat nur die Planung
abgeschlossen. Scope: Marktfilter-Zweig in `shopping-list-screen.tsx`, reine
Row-Projektion unter `domain/shopping-list-rows.ts` und fokussierte
Screen-/Projektions-/Konventionstests. Bestehende Darstellung, Aktionen und
Scroll-to-top erhalten. Nicht-Scope: Gesamtansicht, `ReorderableList`, neue
Gestaltung, Sync oder Datenmodell.

### Design

Umsetzungsvertrag und bestehende Performance-Grenzen aus `fam-ymz7.11`
übernehmen. Kein weiterer allgemeiner Planungsdurchlauf. Gemeinsamer Screen
mit `fam-gng6`: sequenziell bearbeiten.

### Acceptance criteria

Die Marktansicht verwendet FlashList v2 mit stabilen Header-/Item-Keys und
korrektem Recycling; Kategorieordnung, Auswahl/Abwahl, Bearbeiten, Preise,
Filterwechsel und Leerzustand bleiben korrekt. Projektions-, Screen- und
Konventionstests sowie Biome/TypeScript bestehen. Die in `fam-ymz7.11`
festgelegte iOS-/Android-Abnahme und Performance-Nachweise liegen vor; fehlende
Geräte werden als Blocker ausgewiesen, nicht als bestanden. Unabhängige
Implementierungsreview ohne erforderliche offene Befunde.

### Relations

- Parent: `fam-ymz7` – Bun-Toolchain abschließen und allgemeine Sync-Folgearbeiten abgrenzen (P1)
- Depends on: `fam-ymz7.11` – Shopping-List-SectionList gegen FlashList-Vertrag prüfen (P2)
- Depends on: `fam-gng6` – Shopping-Listen-Lesefehler im Screen sichtbar behandeln (P2)

## `fam-ymz7.21` (`.21`)

**Titel:** Reverse-Lücke verbindlich abgrenzen und zur Entscheidung vorlegen  
**Typ:** Decision  
**Priorität:** P2  
**Status:** CLOSED  
**Erstellt von:** Goldjunge91  
**Erstellt:** 2026-09-23  
**Aktualisiert:** 2026-09-23

### Close reason

Auf ausdrücklichen Wunsch von Marco nicht weiterverfolgt: Im Einkauf sind keine
Änderungen gewünscht. Geschlossen als verworfen, nicht als implementiert oder
technisch behoben. Vorhandene Befunde bleiben historische Hinweise; keine
Produktions-, Schema- oder Teständerung.

### Description

Warum: Stage 3 nennt fehlendes Restore gelöschter Shopping-Items und fehlendes
Undo eines Shopping Runs. Die frühere Sammelaufgabe `fam-ymz7.10` wurde auf
Bijektion reduziert; der Reverse-Befund hat dadurch keinen aktiven Owner mehr.
Scope: genau diese zwei Aktionen gegen `AGENTS.md` Reverse States und
`CONSTRAINTS.md` I4 abgrenzen. Vorhandene Check/Uncheck-Parität bleibt
unverändert. Keine Umsetzung in dieser Entscheidungsaufgabe.

### Design

Maximal eine kompakte Entscheidungsvorlage im Bead. Bestehende Owner:
`use-shopping-list-mutations.ts`/`.android.ts`,
`use-complete-shopping-run.ts`, lokale Outbox-/Mirror-Owner. Kein erneutes
Gesamtaudit, keine erfundenen künftigen Testpfade als grüne Gates.

### Acceptance criteria

Für Item-Restore und Run-Undo steht jeweils konkret fest: auslösende
Nutzeraktion, betroffene Daten, Verhalten nach erfolgreichem Push und bei
zwischenzeitlich verändertem/verbrauchtem Zielbestand, erlaubte
Fehler-/Konfliktreaktion und Offline-Verhalten. Genau eine empfohlene minimale
Variante je Aktion wird Marco zur fachlichen Entscheidung vorgelegt. Abschluss
erst nach dokumentierter Entscheidung; erforderliche Umsetzung erhält Beads mit
Zustands- und Fehlerabnahmen und wird vor Stage-5-Abschluss verknüpft. Eine
Ausnahme vom Reverse-Vertrag darf nur Marco freigeben. Keine
Receipt-/CAS-/Serverarchitektur allein aus der Planung ableiten.

### Relations

- Parent: `fam-ymz7` – Bun-Toolchain abschließen und allgemeine Sync-Folgearbeiten abgrenzen (P1)

## `fam-ie54`

**Titel:** Einkaufsabschluss atomar über Vorrat, Historie und Listen-Tombstones ausführen  
**Typ:** Bug  
**Priorität:** P1  
**Status:** CLOSED  
**Erstellt von:** Goldjunge91  
**Erstellt:** 2026-09-23  
**Aktualisiert:** 2026-09-23

### Close reason

Auf ausdrücklichen Wunsch von Marco nicht weiterverfolgt: Im Einkauf sind keine
Änderungen gewünscht. Geschlossen als verworfen, nicht als implementiert oder
technisch behoben. Vorhandene Befunde bleiben historische Hinweise; keine
Produktions-, Schema- oder Teständerung.

### Description

Warum: Ein Fehler nach einem bereits committed Transfer hinterlässt aktuell
Teilzustände. Scope: `use-complete-shopping-run.ts` und der kleinste nötige
transaktionsfähige Pfad in `src/lib/db/outbox.ts`; vorhandene Mirror-Owner
weiterverwenden. Alle Inventory-/Ledger-Zeilen, lokale History,
Quell-Tombstones und zugehörige Outbox-Einträge eines Abschlusses gehören in
eine exklusive SQLite-Transaktion. Eingangsvalidierung aus `fam-ymz7.18`
verwenden. Nicht-Scope: Server-Transaktion, neue Sync-Engine,
History-Synchronisierung, neues Undo-/Receipt-/CAS-System.

### Design

Bestehende Outbox-Enqueue-Owner und Mirror-Write-Funktionen wiederverwenden.
Eine kohärente exklusive SQLite-Transaktion als Owner des Abschlusses; keine
neue allgemeine Sync-Abstraktion. Vorab alle fachlichen Eingaben validieren,
dann abhängige Mutationen im Transaktionshandle ausführen.

### Notes

Evidenz: `use-complete-shopping-run.ts`, ca. Zeilen 77–208; `CONTEXT.md`
Shopping History ist aktuell lokal ohne Outbox; bestehender Hook-Test mockt
`enqueueMutations` und `db.runAsync` getrennt und belegt keinen Rollback.

#### Cross-bead contract handoff: `fam-ymz7.10` / `fam-ymz7.18`

`fam-ymz7.10` ist der freigegebene Plan und `fam-ymz7.18` der
Implementierungsowner der reinen Bijektionsprüfung. `fam-ie54` konsumiert
diesen Validator vor seiner lokalen Forward-Transaktion und bleibt Owner von
Forward-Atomarität, Writes, Run-Envelope und der späteren Übergabe. Dieser
Abschnitt definiert nur die Übergabegrenze und dupliziert nicht den
Forward-Atomicity-Scope. `fam-ymz7.10` konsumiert den daraus entstehenden
Vertrag für den späteren Reverse-Pfad.

#### Ownership und kanonischer Vertrag

- `fam-ie54` erzeugt pro Forward-Intent eine stabile `run_id` und pro 1:1-Paar aus abgehaktem Artikel und Transfer eine stabile `run_item_id`. Retries desselben Intents verwenden dieselben IDs.
- Vor dem ersten Write konsumiert `fam-ie54` den reinen Bijektionsvalidator aus `fam-ymz7.18` für `checkedItems` ↔ `transfers`: genau ein Transfer pro checked item, jeder Transfer gehört genau zu einem checked item, keine fehlenden, zusätzlichen oder doppelten IDs. Eine Verletzung bricht vor jedem Write ab.
- Die IDs werden nach erfolgreichem Preflight in den lokalen Abschluss übernommen. Für jedes Run-Item speichert `fam-ie54` source, target und provenance zusammen mit dem normalisierten Transfer. Das Ergebnis ist das kanonische Envelope für `reverse_shopping_run`; `.10` darf keine parallele Forward-Repräsentation erfinden.
- Die Vertragsform ist:

  ```text
  {
    run_id,
    run_state,
    fingerprint,
    items: [{
      run_item_id,
      item_state,
      transfer,      // normalisierte Transferdaten
      source: { kind, id, forward_effect },
      target: { kind, id, forward_effect },
      provenance: { checked_item_id, transfer_id, ... },
      idempotency: { key, fingerprint },
      precondition: {
        source: { exists, expected_revision, expected_state },
        target: { exists, expected_revision, expected_state }
      }
    }]
  }
  ```

  `source` und `target` sind stabile fachliche Referenzen. `precondition`
  enthält die beim Forward festgehaltenen CAS-Erwartungen einschließlich
  Existenz, Revision/Version und Zustand, sodass der Reverse gegen den
  erwarteten Post-Forward-Zustand prüfen kann. Der Reverse darf bei einer
  Abweichung nicht stillschweigend überschreiben.

#### Zustände, Idempotency und CAS

- Kanonische Run-Zustände: `committed → reversing → reversed`; terminale Fehlerzustände sind `reverse_conflict` (CAS-Abweichung) und `reverse_failed` (retrybarer technischer Fehler). `validated` ist nur der transiente Preflight-Zustand vor dem ersten Write; ein partieller Forward-Zustand `failed` wird nicht persistiert.
- Kanonische Run-Item-Zustände: `committed → reversing → reversed`, mit denselben terminalen Zuständen `reverse_conflict` und `reverse_failed`.
- `fingerprint` ist deterministisch über das normalisierte, vollständig sortierte Envelope ohne volatile Zeitstempel. Derselbe `run_id`/`run_item_id` mit demselben Fingerprint ist idempotent wiederholbar; ein anderer Fingerprint ist ein `idempotency_conflict` und darf keine Mutation auslösen.
- Die Reverse-Seite prüft die gespeicherten CAS-Preconditions gegen den aktuellen Source-/Target-Zustand. Konflikte werden explizit gemeldet und nicht als erfolgreiches Restore gezählt.

#### Tests und Abnahmereihenfolge

1. `fam-ymz7.18`: fokussierte Tests für die reine Bijektionsprüfung vor dem ersten Write; `fam-ie54`: fokussierte Tests für die Validator-Konsumierung, stabile IDs und deterministischen Fingerprint, Envelope mit Source/Target/Provenance/CAS sowie den bestehenden lokalen Commit-/Rollback-Pfad.
2. `fam-ymz7.10`: serverseitige Tests für `reverse_shopping_run`, Restore-/Reverse-RPC, Idempotency inklusive Fingerprint-Konflikt, Zustandsübergänge, CAS-Konflikte und RLS/Authz.
3. Cross-bead: Forward-Commit → Reverse, idempotentes Wiederholen, mutierter Source/Target als CAS-Konflikt und Haushalts-/Privatdaten-Isolation müssen gegen exakt dieses Envelope grün sein.
4. Erst danach erfolgt die Abnahme des Reverse-Pfads in `fam-ymz7.10`. Serverseitige Restore-/Reverse-RPC-/RLS-Arbeiten sind ausschließlich `.10` zugeordnet und in `fam-ie54` weder erledigt noch abzunehmen. `fam-ie54` bleibt offen; dieser Handoff ändert keinen Status.

Standprüfung 2026-09-23: aktueller Code/CLI bestätigt den Ausgangsbefund. Scope
und Abschluss hier auf Marcos Auftrag präzisiert; historische Notes sind keine
aktuelle Implementierungsabnahme.

### Acceptance criteria

Der Erfolgsfall mit mindestens zwei Transfers schreibt genau die erwarteten
Zeilen in allen betroffenen Tabellen. Ein Fehler nach dem ersten Transfer,
während der History und beim späteren Tombstone hinterlässt in echtem SQLite
den vollständigen Ausgangszustand einschließlich Outbox; Mock-Aufrufzählungen
reichen nicht. Ein erneuter Versuch nach Rollback erzeugt genau einen
erfolgreichen Abschluss. Erfolgsmeldung, Aktivität und Cache-Invalidierung
erfolgen erst nach Commit; History bleibt lokal/outboxfrei. Echte SQLite-
Abnahme im passenden vorhandenen Test-Harness; wenn Supabase-Integration
verwendet wird, zuerst lokal/fail-closed prüfen. Run-Undo wird separat in
`fam-ymz7.21` entschieden.

Abnahme für TS/TSX: gezielte Verhaltenstests über
`bun run test -- <betroffene Testpfade>`, `bun run check` und
`bun run typecheck`; erforderliche Reviewbefunde behoben. `CONSTRAINTS.md`
einschließlich Scope-/Duplikationsgrenzen bleibt verbindlich. Fehlende
Nachweise oder Umgebungen sind offen/blockiert, niemals grün. Kein erneutes
Gesamtaudit und keine zusätzlichen Statusdokumente.

### Relations

- Depends on: `fam-ymz7.18` – Stage 5: checkedItems/transfers-Bijektionsguard implementieren (P1)

## `fam-gng6`

**Titel:** Shopping-Listen-Lesefehler im Screen sichtbar behandeln  
**Typ:** Bug  
**Priorität:** P2  
**Status:** CLOSED  
**Erstellt von:** Goldjunge91  
**Erstellt:** 2026-09-23  
**Aktualisiert:** 2026-09-23

### Close reason

Auf ausdrücklichen Wunsch von Marco nicht weiterverfolgt: Im Einkauf sind keine
Änderungen gewünscht. Geschlossen als verworfen, nicht als implementiert oder
technisch behoben. Vorhandene Befunde bleiben historische Hinweise; keine
Produktions-, Schema- oder Teständerung.

### Description

Warum: `useShoppingList`-Fehler werden durch `data=[]` und alleinige
`isLoading`-Auswertung als leere Liste dargestellt. Scope:
`shopping-list-screen.tsx`, vorhandener React-Query-Fehler-/Refetch-Zustand und
fokussierter Screen-Test; Hook nur falls notwendig. Vorhandene semantische
Fehler-/Retry-Primitiven nutzen. Nicht-Scope: neue globale Fehlerverwaltung,
Listenmigration oder Redesign. Falls neue nichttriviale UI-/Copy erforderlich
ist, gilt Marcos Mock-Auswahlregel vor Umsetzung.

### Design

Fehlerzustand bleibt beim React-Query-Owner und wird im Screen komponiert; keine
globale Fehlerabstraktion. Bestehende lokale UI-Primitiven und Query-Key-
Konventionen verwenden.

### Notes

Evidenz: `shopping-list-screen.tsx:168-171` und `459-465` verwendet nur
`data`/`isLoading`; `use-shopping-list.ts`-`queryFn` kann
`getDatabase`/`getAllAsync` werfen; Screen-Test-Fixture deckt nur
`data`/`isLoading` ab.

Standprüfung 2026-09-23: aktueller Code/CLI bestätigt den Ausgangsbefund. Scope
und Abschluss hier auf Marcos Auftrag präzisiert; historische Notes sind keine
aktuelle Implementierungsabnahme.

### Acceptance criteria

Initialer SQLite-Lesefehler zeigt einen verständlichen Fehler mit Retry und
keinen erfolgreichen Leerzustand. Retry ruft die Query erneut auf und zeigt
anschließend Daten oder den echten Leerzustand. Ein Hintergrund-Refetch-Fehler
entfernt vorhandene Daten nicht kommentarlos. Screen-Tests decken initialen
Fehler, erfolgreichen Retry und erneuten Fehler ab; normaler Leerzustand bleibt
korrekt.

Abnahme für TS/TSX: gezielte Verhaltenstests über
`bun run test -- <betroffene Testpfade>`, `bun run check` und
`bun run typecheck`; erforderliche Reviewbefunde behoben. `CONSTRAINTS.md`
einschließlich Scope-/Duplikationsgrenzen bleibt verbindlich. Fehlende
Nachweise oder Umgebungen sind offen/blockiert, niemals grün. Kein erneutes
Gesamtaudit und keine zusätzlichen Statusdokumente.

### Relations

- Blocks: `fam-ymz7.20` – Markt-Einkaufsliste auf FlashList umstellen (P2)

## `fam-jlkw`

**Titel:** Shopping-History serverseitig append-only per RLS erzwingen  
**Typ:** Bug  
**Priorität:** P2  
**Status:** CLOSED  
**Erstellt von:** Goldjunge91  
**Erstellt:** 2026-09-23  
**Aktualisiert:** 2026-09-23

### Close reason

Auf ausdrücklichen Wunsch von Marco nicht weiterverfolgt: Im Einkauf sind keine
Änderungen gewünscht. Geschlossen als verworfen, nicht als implementiert oder
technisch behoben. Vorhandene Befunde bleiben historische Hinweise; keine
Produktions-, Schema- oder Teständerung.

### Description

Warum: `shopping_history_all_member` erlaubt im deklarativen Schema weiterhin
`FOR ALL` trotz Append-only-Vertrag. Scope: `supabase/schemas/08_inventory.sql`,
betroffene Privilegien nur falls nötig, fokussierte History-pgTAP-Fälle in
`supabase/tests/07_inventory.test.sql`, generierte Migration und Typen.
Nicht-Scope: History synchronisieren, neue Tabellen oder Änderung von
Inventory-/Shopping-Fachregeln.

### Design

Nur `supabase/schemas/08_inventory.sql` als Quelle ändern; Migration
ausschließlich via `bun run db:diff` erzeugen. Keine lokale Outbox-/Sync-
Anbindung hinzufügen, solange `CONTEXT.md` die Historie als nicht
synchronisiert definiert.

### Notes

Evidenz: `CONTEXT.md` Abschnitt Shopping History;
`supabase/schemas/08_inventory.sql` Policy `shopping_history_all_member`
`FOR ALL` und Kommentar „Append-only“;
`supabase/tests/07_inventory.test.sql` prüft bisher nur Insert/Select.

Standprüfung 2026-09-23: Policy besteht weiterhin. Scope/Abnahme präzisiert;
keine Datenbankänderung in dieser Neuplanung.

### Acceptance criteria

Mitglied darf vorgesehene History-Zeilen anlegen/lesen; Fremdhaushalt und
anonyme Rolle dürfen nicht unberechtigt zugreifen. UPDATE und DELETE durch
normale Mitglieder lassen die persistierte Zeile nachweisbar unverändert (auch
RLS-Nulltreffer statt SQL-Fehler korrekt prüfen). Migration nur mit
`bun run db:diff` generieren; nach lokalem Anwenden fokussierte pgTAP-Abnahme,
Advisors, `bun run db:types` und leerer `db:diff` belegen. Vor DB-Befehlen das
lokale Ziel und dessen Freigabe prüfen; kein Remote-/linked-Fallback. Fehlende
lokale Umgebung verhindert Abschluss. Keine manuelle Migration.

### Relations

Keine weiteren Beziehungen im Bead verzeichnet.

## Abschlussstatus

Alle sechs genannten Beads bleiben geschlossen und sind als verworfen zu
behandeln. Aus diesem Dokument folgt keine Implementierungs-, Schema-, Test-,
Review- oder Folgeaufgabe für den Einkaufsbereich. Die übrigen, nicht zum
Einkaufsbereich gehörenden Arbeiten bleiben davon unberührt.
