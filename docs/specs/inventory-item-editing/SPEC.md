# Spec: Inventarartikel bearbeiten

**Status:** Review erforderlich, keine Implementierung freigegeben  
**Version:** 0.2  
**Stand:** 2026-09-10  
**Bezug:** Beads `fam-7i6`

## Scope-Gate

Diese Initiative beschreibt eine einzelne Capability: Ein Haushaltsmitglied
kann einen bestehenden aktiven Inventar-Lot bearbeiten. Lifecycle, lokale
Outbox, Server-RPC und UI sind dafür technische Schichten derselben Capability
und werden nicht als separate Features spezifiziert.

Kein Capability-Map-Dokument ist nötig. Die Abhängigkeit bleibt linear:

```text
Inventory-Contract
    -> Lifecycle-Operation
    -> lokaler Commit und Outbox
    -> Server-RPC und RLS
    -> Bearbeitungs-UI
```

## Annahmen zur Review

1. **Editiert wird ein einzelnes MHD-Los**, nicht die aggregierte Produktgruppe.
2. **Im ersten Schnitt sind Name, MHD, Menge und Mengenart editierbar.** Die
   Mengenart ist das bestehende `unit`-Feld und wird aus den vorhandenen
   `UNIT_OPTIONS` gewählt.
3. **Die Mengenänderung bleibt fachlich beim bestehenden
   `correct_quantity`-Flow.** Der neue Editor darf sie nicht mit einer zweiten
   Mengenregel oder eigener Mengenarithmetik duplizieren.
4. **Der Lagerort bleibt beim bestehenden `move_inventory`-Flow.**
5. **Packungsgröße und Produktzuordnung bleiben zunächst außerhalb des
   Scopes.** Eine Änderung der Mengenart wird zunächst nur für Lots ohne
   `package_size` erlaubt; eine automatische Umrechnung zwischen Einheiten
   findet nicht statt.
6. Die Funktion bleibt local-first: Speichern schreibt zuerst atomar in die
   lokale SQLite-Spiegelung und Outbox; Netzwerk ist nicht Voraussetzung für
   die sichtbare lokale Änderung.

Wenn eine dieser Annahmen nicht stimmt, wird die Spec vor der Planung
aktualisiert.

## 1. Objective

### Was wird gebaut?

Ein klar auffindbarer Bearbeitungsfluss für einen bestehenden Inventar-Lot.
Der Nutzer öffnet die Lot-Aktionen, wählt „Bearbeiten“, ändert Name, MHD,
Menge und/oder Mengenart und speichert. Die Änderung wird optimistisch lokal
angezeigt,
später über denselben autoritativen Inventory-Sync-Weg an Supabase übertragen
und bei einer veralteten Basis als fachlicher Konflikt behandelt.

### Warum?

Der aktuelle Screen bietet keinen Bearbeiten-Button. Die UI kann die Menge
korrigieren, verbrauchen, wegwerfen oder löschen, aber Name und MHD eines
vorhandenen Artikels sind nicht editierbar. Direkte Tabellenupdates wären mit
RLS, Offline-Sync, Append-only-Ledger und dem Inventory-Contract nicht
vereinbar.

### Nutzerergebnis

- „Bearbeiten“ ist aus den Lot-Aktionen auf iOS und Android erreichbar.
- Name, MHD, Menge und Mengenart werden validiert und lokal sofort sichtbar
  geändert.
- Offline-Speichern bleibt möglich; die Outbox synchronisiert später.
- Ein stale Lot wird nicht als erfolgreich gespeichert dargestellt.
- Eine Metadatenänderung erzeugt keine künstliche Ledgerzeile.

## 2. Tech Stack

- Expo SDK 57, React Native 0.86, React 19.2
- TypeScript, Bun, React Query, Zustand nur für UI-Zustand
- Supabase Postgres, RLS und deklaratives Schema unter `supabase/schemas/`
- Lokales SQLite mit Drizzle-Schema und Outbox-Sync
- Jest und React Native Testing Library
- Biome und TypeScript als statische Gates

Es werden keine neuen Abhängigkeiten und keine neuen Native-Module benötigt.

## 3. Commands

Alle Befehle laufen aus dem Repository-Root. Die lokale Supabase-Instanz darf
verwendet werden; ein `supabase start` und Remote-Projekte bleiben verboten.

```bash
# Lifecycle- und Commit-Tests
bun run test src/features/inventory/inventory-lifecycle.phase1.test.ts --runInBand --watchman=false
bun run test src/features/inventory/use-inventory-mutations.test.tsx --runInBand --watchman=false
bun run test src/lib/sync/inventory-quantity.integration.test.ts --runInBand --watchman=false

# Neue fokussierte UI-/Feature-Tests nach der Implementierung
bun run test src/features/inventory/inventory-item-edit-sheet.test.tsx --runInBand --watchman=false
bun run test src/features/inventory/inventory-screen.test.tsx --runInBand --watchman=false

# Lokaler Datenbanknachweis für die neue Operation
bash scripts/check-clean-db.sh && supabase test db --local supabase/tests/33_inventory_metadata_patch.test.sql

# Deklarativer Datenbank-Workflow, falls das Servermodell geändert wird
bun run db:diff -- -f inventory-item-editing
bun run db:types

# Qualitätsgates
bun run typecheck
bun run check
```

`bun test` und eine unbeschränkte vollständige Jest-Suite werden nicht
verwendet.

## 4. Project Structure

Die fachliche Wahrheit bleibt in den bestehenden Ownern. Neue Dateien sind
nur für die UI gerechtfertigt, falls ein lokales Sheet nicht lesbar in den
bestehenden Screen passt.

```text
docs/specs/inventory-item-editing/SPEC.md
    -> diese Review-Spezifikation

tasks/inventory-sync/contract.md
    -> fachliche Operation und Invarianten
tasks/inventory-sync/CONSTRAINTS.md
    -> unveränderte Arbeits- und Qualitätsgrenzen
tasks/inventory-sync/owner-file-map.md
    -> bestehende Owner und Abhängigkeitsrichtung

src/features/inventory/inventory-lifecycle.ts
    -> patch_inventory_metadata, Validierung, Footprint und reine Planung
src/features/inventory/use-inventory-mutations.ts
    -> React-Query-Mutation, Actor und Query-Invalidierung
src/lib/sync/inventory-quantity.ts
    -> lokaler atomarer Lot-Patch und Outbox-Envelope
src/lib/sync/mirror-write.ts
    -> Reconciliation der Metadatenänderung
src/lib/sync/push.ts
    -> Transport des bestehenden Inventory-RPC, ohne zweiten Schreibpfad
src/features/inventory/inventory-screen.tsx
src/features/inventory/inventory-screen.android.tsx
    -> Bearbeiten-Aktion und Sheet-Komposition
src/features/inventory/components/inventory-item-actions-sheet.tsx
    -> Einstieg in den Bearbeitungsfluss
src/features/inventory/components/inventory-item-edit-sheet.tsx
    -> nur falls der Editor nicht sinnvoll inline bleiben kann

supabase/schemas/08_inventory.sql
    -> autoritative Servervalidierung, CAS, Commit und Idempotenz
supabase/schemas/20_privileges.sql
    -> nur falls sich der bestehende RPC-Grant ändert
supabase/tests/33_inventory_metadata_patch.test.sql
    -> RPC-, CAS-, RLS- und Idempotenznachweis
```

Das lokale SQLite-Schema enthält bereits Name, MHD, Menge und die nötigen
technischen Sync-Spalten. Eine lokale Schemaänderung ist daher nicht geplant;
das wird vor der Implementierung geprüft und nicht vorausgesetzt.

## 5. Fachlicher Vertrag

### Neue Operation: `patch_inventory_metadata`

Die Operation ist eine diskriminierte Contract-Union und kein freies
Patch-Objekt im Transport. Sie enthält:

- `contract_version`, `operation_id`, `household_id`, `created_at`
- `item_id`
- `expected_updated_at` als CAS-Anker
- mindestens eines der Patchfelder:
  - `name: string` mit 1 bis 200 nicht-leeren Zeichen
  - `expiry_date: YYYY-MM-DD | null`
  - `expiry_user_set: boolean`
  - `unit: string` aus den bestehenden `UNIT_OPTIONS`

`expiry_user_set` wird beim Setzen eines MHD auf `true` gesetzt und beim
Löschen des MHD auf `false`. Die UI sendet für das MHD immer beide Werte, damit
kein alter Schutzstatus zurückbleibt.

`quantity` bleibt bewusst außerhalb dieses Metadaten-Patches. Eine
Mengenänderung wird als bestehende `correct_quantity`-Operation modelliert.
Wenn der Nutzer Menge und Mengenart gemeinsam ändert, wird zuerst die
Mengenart als Metadatenänderung und danach die Mengenänderung über den
kanonischen Mengen-Owner eingeordnet. Die lokale Outbox erhält diese Reihenfolge;
ein teilweise fehlgeschlagener Ablauf darf nicht als vollständig erfolgreich
angezeigt werden.

Die Operation darf nicht enthalten:

- `quantity`, `package_size` oder `package_size_unit`
- `location_id`
- freie zusätzliche Felder

Diese Felder haben eigene bestehende oder noch nicht freigegebene fachliche
Flows. Der Metadaten-Patch für `unit` schreibt keine Ledgerzeile; nur die
separate Mengen-Korrektur folgt ihrem bestehenden Ledgervertrag.

### Lokaler Commit

Der Commit liest den Lot innerhalb derselben exklusiven SQLite-Transaktion
frisch, prüft Haushalt, aktiven Zustand und `expected_updated_at`, wendet den
Patch auf dieselbe Lot-ID an und schreibt genau die passende Outbox-Nutzlast.
Netzwerkzugriffe finden nicht innerhalb der Transaktion statt.

### Server-Commit

- Authentifizierung und Haushaltsmitgliedschaft werden serverseitig geprüft.
- Der CAS-Anker `expected_updated_at` muss zum aktiven Lot passen.
- Der Server aktualisiert nur die erlaubten Metadatenfelder.
- Erfolg gibt den aktualisierten Lot zurück.
- `STALE_BASE` bleibt ein fachlicher Konflikt.
- Gleiche `operation_id` und identische Nutzlast werden ohne zweite Wirkung
  wiedergegeben.
- Gleiche `operation_id` mit anderer Nutzlast ergibt `ID_PAYLOAD_MISMATCH`.
- Der Idempotenznachweis darf keine Ledgerzeile vortäuschen. Falls der
  bestehende Phase-1-RPC diese Receipt-Fähigkeit nicht besitzt, wird eine
  kleine deklarative Receipt-Struktur für genau diesen Zweck ergänzt. Keine
  zweite Sync- oder Executor-Schicht.

### Fehlerverhalten

- Ungültiger Name oder ungültiges Datum: Validierungsfehler vor dem Commit.
- Veralteter Lot: `STALE_BASE`, lokale Änderung bleibt nicht als Erfolg
  markiert.
- Timeout oder Antwortverlust: `unknown`; dieselbe Outbox-Operation bleibt
  mit denselben IDs retrybar.
- Technischer Fehler: wird als technischer Fehler weitergegeben und nicht in
  einen Erfolg umgewandelt.

## 6. Code Style

Die fachliche Entscheidung liegt im Lifecycle-Owner. Mutation und UI
transportieren nur die bereits validierte Absicht:

```ts
const operation = createPatchInventoryMetadataOperation({
  operation_id: operationId(),
  created_at: operationTime(),
  household_id: item.household_id,
  item_id: item.id,
  expected_updated_at: current.updated_at,
  name: values.name.trim(),
  expiry_date: values.expiryDate,
  expiry_user_set: values.expiryDate !== null,
  unit: values.unit,
});

return commitValidatedOperation(db, operation, authenticatedActorId);
```

Dabei gelten zusätzlich:

- keine `any`-Typen, unsicheren Casts oder Non-null-Assertions
- keine Mengenberechnung im Screen oder im Server-RPC außerhalb seines
  bestehenden Owners; die Mengenänderung nutzt `correct_quantity`
- keine implizite Umrechnung bei einer Mengenartänderung
- keine Hexfarben, Typografierollen oder semantischen Zustände im Feature
- UI verwendet Theme-Tokens und `src/constants/ui.tsx`
- keine neue generische Patch-Abstraktion nur für diesen Fall

## 7. Testing Strategy

### Reine Lifecycle-Tests

Prüfen Operationstyp, Pflichtfelder, null-vs-fehlend, erlaubte Patchfelder,
Namengrenzen, MHD-Format, gültige Mengenart, Footprint, CAS-Konflikt und dass
`quantity` weiterhin beim `correct_quantity`-Owner bleibt.

### Lokale Commit-Tests

Prüfen atomaren lokalen Patch, eine Outbox-Operation, gleiche Lot-ID,
Rollback bei Fehler und Re-Play-Verhalten. Der Lifecycle-Owner wird nicht
gemockt.

### RPC-/pgTAP-Tests

Prüfen erfolgreiche Umbenennung, MHD setzen/löschen, Mengenartänderung ohne
implizite Umrechnung, RLS-Isolation, `STALE_BASE`, Idempotenz,
Payload-Mismatch und dass der Metadaten-Patch keine Ledgerzeile erzeugt.

### UI-Tests

Prüfen Bearbeiten-Einstieg auf iOS/Android-Komposition, vorbefüllte Werte für
Name, MHD, Menge und Mengenart, Validierung, Save mit nur geänderten Feldern,
Loading-Zustand und sichtbare Fehlermeldung ohne falschen Erfolg.

### Gates

Die neuen und direkt betroffenen Tests müssen fokussiert grün sein. Danach
müssen `bun run typecheck` und `bun run check` grün sein. Bestehende,
unabhängige Baseline-Fehler werden separat dokumentiert und nicht still
verändert.

## 8. Boundaries

### Always

- Vor Codeänderungen `tasks/inventory-sync/CONSTRAINTS.md`, den relevanten
  Contract-Abschnitt, `fam-7i6`, Owner-Map und betroffene Tests lesen.
- Contract zuerst aktualisieren, falls `patch_inventory_metadata` fachlich
  freigegeben wird.
- Local-first, RLS, CAS, idempotente Operationen und append-only Ledger
  erhalten.
- Erfolgs-, Konflikt-, Timeout- und Rollbackfälle testen.
- Beads mit Nachweisen aktualisieren.

### Ask first

- Scope auf Packungsgröße, Produktzuordnung oder Lagerort erweitern.
- Den bestehenden Mengen-, Move- oder Ledgervertrag ändern.
- Neue Abhängigkeiten oder Native-Module hinzufügen.
- Eine weitere Receipt-, Queue- oder Sync-Abstraktion einführen.
- Schemaänderungen außerhalb des deklarativen `supabase/schemas/`-Workflows.

### Never

- Keine direkten `fridge_items`-Updates aus der UI oder Mutation.
- Keine manuell geschriebenen oder editierten Migrationen.
- Keine Remote-Supabase-Schreibvorgänge.
- Keine Testassertions löschen, abschwächen oder überspringen.
- Keine Secrets loggen.
- Kein `bun test`, kein `supabase start`, keine Git-Kommandos.

## 9. Success Criteria

- [ ] `Bearbeiten` ist auf iOS und Android aus einem konkreten Lot erreichbar.
- [ ] Name kann validiert, lokal gespeichert und synchronisiert werden.
- [ ] MHD kann gesetzt, geändert und gelöscht werden; der Schutzstatus bleibt
      korrekt.
- [ ] Menge kann im Bearbeitungsfluss geändert werden und verwendet weiterhin
      `correct_quantity`, ohne eine zweite Mengenregel.
- [ ] Mengenart kann aus `UNIT_OPTIONS` geändert werden; es gibt keine
      implizite Umrechnung.
- [ ] Mengenartänderungen bei bestehender `package_size` werden gemäß der
      bestätigten Review-Regel blockiert.
- [ ] Der Patch ist offline-fähig und schreibt lokal atomar genau eine
      Outbox-Operation.
- [ ] Der Server schützt Haushalt und CAS-Anker über RLS/RPC.
- [ ] Retry mit gleicher Operation-ID ist idempotent; Payload-Mismatch wird
      abgewiesen.
- [ ] Kein Metadaten-Patch erzeugt eine Ledgerzeile.
- [ ] Konflikte, technische Fehler und unbekannte Antwortzustände bleiben
      unterscheidbar.
- [ ] Fokussierte Jest-/pgTAP-Tests, Typecheck und Biome-Check sind grün.
- [ ] Keine neue Dependency, keine neue Native-Abhängigkeit und kein
      manueller Migrationseingriff.

## 10. Open Questions for Human Review

1. Ist die Regel korrekt, dass eine Mengenartänderung bei bestehender
   `package_size` zunächst blockiert wird?
2. Ist bestätigt, dass es keine automatische Umrechnung gibt, z. B. dass eine
   Eingabe von `2 l` nach der Auswahl von `kg` als `2 kg` verstanden wird?
3. Ist eine kleine deklarative Receipt-Struktur für die Idempotenz dieses
   ledgerlosen Patches akzeptabel, falls der aktuelle RPC keinen passenden
   Nachweis besitzt?

## Review-Gate

Diese Datei ist ein Review-Entwurf. Es werden keine Implementierung, kein
Plan und keine Task-Unterteilung gestartet, bevor die offenen Fragen und die
Success Criteria bestätigt sind.
