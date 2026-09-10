# Inventory-Sync: Owner-Map

Diese Datei beantwortet zwei Fragen:

1. Welcher Produktions-Owner entscheidet eine fachliche Regel?
2. In welche Richtung dürfen die Abhängigkeiten zeigen?

Verhalten steht in `contract.md`, Grenzen in `CONSTRAINTS.md`, Arbeitsstand
in Beads.

## Regeln

- Eine fachliche Entscheidung besitzt genau einen Owner.
- Eine zweite Funktion, die dasselbe berechnet oder klassifiziert, ist
  verboten.
- Ein neuer Owner wird hier vor seiner Implementierung eingetragen.
- Produktionscode importiert keine Testdaten oder Fixtures.

## Phase-1-Owner

| Entscheidung | Owner | Grenze |
|---|---|---|
| Mengenarithmetik und Dezimalgrenze | `src/lib/inventory-quantity.ts` | rein; keine DB, Zeit, UI oder Sync |
| Operationstypen, Payloadvalidierung, IDs, Footprint und Lifecycle-Plan | `src/features/inventory/inventory-lifecycle.ts` | rein; keine React-, DB- oder Netzwerk-Abhängigkeit |
| Lokaler atomarer Inventory-Commit | `src/lib/sync/inventory-quantity.ts` | führt den Lifecycle-Plan mit SQLite und Outbox aus; keine zweite Fachplanung |
| React-Query-Mutationsorchestrierung | `src/features/inventory/use-inventory-mutations.ts` | reicht UI-Absicht an den lokalen Commit; keine eigene Mengen- oder Ledgerregel |
| Lokales Inventory-Schema | `src/lib/db/schemas/inventory.ts` | Tabellen und Spalten; keine Lifecycle-Entscheidung |
| Lokale Outbox- und Sync-Persistenz | `src/lib/db/schemas/system.ts` | gemeinsames SQLite-Schema; keine Inventory-Fachlogik |
| Servermodell, Locks, Idempotenz und Commit | `supabase/schemas/08_inventory.sql` | einzige deklarative Inventory-Schemaquelle |
| RPC-Ausführungsrechte | `supabase/schemas/20_privileges.sql` | Grants, keine Fachlogik |
| Transport, Backoff und Push-Abschluss | `src/lib/sync/push.ts` | transportiert, berechnet kein Inventory-Ergebnis |
| Pull und Reconciliation | `src/lib/sync/mirror-write.ts` | wendet Serverbasis an; keine zweite Planung |
| Inventory-Konfliktentscheidung | `src/lib/sync/resolve-inventory-conflict.ts` | einzige Auflösungsentscheidung |
| Inventory-Readmodell | `src/features/inventory/use-inventory-items.ts` | Lesen und View-Konversion; keine Mutation |
| Ledger-History und Anzeige | `src/features/inventory/use-inventory-transactions.ts` | keine Commit-Entscheidung |
| Shopping-zu-Inventory-Transfer | `src/features/shopping-list/hooks/use-complete-shopping-run.ts` | verwendet den lokalen Commit; kein paralleler Pfad |

## Abhängigkeitsrichtung

```text
Inventory-UI und Shopping-Abschluss
    -> Mutations- und Read-Hooks
    -> lokaler Inventory-Commit
    -> reiner Lifecycle-Plan + Mengen-Owner
    -> SQLite-Schema + generische Outbox

generische Outbox
    -> Push-Transport
    -> Server-RPCs

Pull und Realtime
    -> Reconciliation in mirror-write.ts
    -> lokale Basis und sichtbare Projektion

Konflikt-UI
    -> Konflikt-Owner
    -> Reconfirm über lokalen Commit oder Discard
```

## Testgrenze

Tests dürfen Owner und gemeinsame Fixtures importieren. Fixtures stellen
Daten bereit, entscheiden aber kein Produktionsverhalten und duplizieren
weder Payloadvalidierung noch Mengenarithmetik. Konkrete Testdateien und
Ergebnisse stehen im Beads-Ticket.
