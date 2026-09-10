# Capability Map: Haushalts-Inventar (Bestand & Vorrat)

**Status:** Aktiv / Freigegeben  
**Version:** 1.0  
**Stand:** 2026-09-10  
**Bezug:** Ticket `fam-0dr`, `CONSTRAINTS.md` (Repository-Root), `contract.md`

---

## 1. Kontext & Zielsetzung

Das Haushalts-Inventar (`src/features/inventory/`) bildet das geteilte Lebensmittel- und Vorratsmanagement für Familien und Haushalte ab. Es kombiniert:
1. **Physischen Bestand:** Artikel mit Mengen, Einheiten, Lagerorten und Haltbarkeitsdaten.
2. **Kataloganreicherung:** Optionale Verknüpfung mit globalen Produkten (`products`, Open Food Facts) für Nährwerte, Kategorien und Barcodes.
3. **Auditierbarkeit & Provenienz:** Append-only Transaktions-Ledger (`transactions`) für Zugänge, Abgänge, Verderb und Teilverbräuche.
4. **Local-First & Offline-Belastbarkeit:** Vollständige Lese- und Schreibfähigkeit auf lokaler SQLite-Datenbank mit synchronisierter Outbox-Queue zu Supabase Postgres.

---

## 2. Modul-Übersicht & Verantwortlichkeiten

| Modul-ID | Primärer Owner | Verantwortung & Grenzen |
|---|---|---|
| `inventory-lifecycle` | `src/features/inventory/inventory-lifecycle.ts` | **Reine Fachplanung:** Validierung kanonischer Operationen (`in`, `out`, `waste`, `correct`, `move`, `split_open`, `open_inventory`), Mengenberechnung, Footprint-Bestimmung. Keine DB-, React- oder Sync-Imports. |
| `inventory-persistence` | `src/lib/sync/inventory-quantity.ts`, `src/lib/inventory-quantity.ts` | **Lokale Persistenz:** Atomare Ausführung in SQLite via `enqueueMutationsInExclusiveTransaction`. Harte Durchsetzung von **Integer-Tausendsteln** an der DB- und Wire-Grenze. |
| `inventory-storage-locations` | `src/features/inventory/use-storage-locations.ts` | Verwaltung physischer Lagerorte (`storage_locations`: Kühlschrank, Vorratsschrank, Tiefkühler). Isolation pro Haushalt via RLS. |
| `inventory-expiry` | `src/features/inventory/expiry.ts`, `opened-expiry.ts` | Berechnung von Verbrauchsfenstern (`expired`, `critical`, `soon`, `ok`, `none`), Kalendertag-Arithmetik und einheitliche Formatierung (`formatExpiryDate`, `formatExpiryStatus`). |
| `inventory-history` | `src/features/inventory/use-inventory-transactions.ts` | Lese-Projektion des append-only Ledgers. Gruppierung nach Tagen, Lokalisierung von Buchungstexten. |
| `inventory-sync-push` | `src/lib/sync/push.ts`, `inventory-push.ts` | Transport lokaler Mutationen zu Supabase RPCs, Idempotenz-Prüfung (23505-Handling), Fehlerklassifikation und Rebase. |

---

## 3. Architektur- & Datenregeln (Non-Negotiables)

1. **Integer-Tausendstel Persistenz (`contract.md` Abschnitt 3):**
   - In SQLite (`fridge_items.quantity`, `package_size`), Supabase Postgres und Outbox-Wire-Payloads werden alle Mengen als Integer-Tausendstel gespeichert (z. B. `1,5 kg` $\rightarrow$ `1500`).
   - Konvertierung erfolgt exakt einmal an der Schnittstelle via `toInventoryQuantityUnits` / `fromInventoryQuantityUnits`.
2. **Kanonische Ledger-Buchungen (`CONSTRAINTS.md`):**
   - Transaktionstypen im Ledger sind strikt beschränkt auf `'in' | 'out' | 'waste'`.
   - Reines Öffnen ohne Mengenverbrauch (`open_inventory`) erzeugt **keine** Ledgerzeile.
   - Undo erfolgt append-only über Gegenbuchungen (`reversal_of`).
3. **Keine stillen Reparaturen:**
   - Scheitert ein Foreign Key (z. B. gelöschter Lagerort), darf der Payload nicht still zu `location_id = null` mutiert werden. Fehler bleiben unterscheidbar.
4. **Strikte Datentrennung & RLS:**
   - Inventardaten sind haushaltsgebunden (`household_id`). Private Tracking-Daten (Kalorien, Gewicht) berühren das Inventar niemals direkt.

---

## 4. Aktueller Reifezustand (Post V3-Refactor)

- **Dateianzahl:** Reduziert von 44 auf 38 Produktionsdateien.
- **Effective LOC:** Reduziert von 9.382 auf 7.929 LOC (-1.453 Zeilen).
- **Duplikate:** 0 exakte Duplikatgruppen im Analyzer.
- **Test-Gates:**
  - `test/conventions/inventory-operation-ownership.test.ts` (15/15 Tests grün).
  - `use-inventory-mutations.integration.test.tsx` (25/25 Tests grün).
  - `use-inventory-mutations.test.tsx` (19/19 Tests grün).

---

## 5. Offene Lücken & Roadmap

| Priorität | Ticket | Thema | Fokus |
|---|---|---|---|
| **P1** | `fam-6zf.9` | **Inventory-Datenzustände** | Saubere Trennung von *Loading*, *Empty*, *No Results*, *Error* und *Refresh* im konsolidierten `inventory-screen.tsx`, damit Offline-Zustand mit lokalen SQLite-Daten nie als leerer Vorrat erscheint. |
| **P2** | `fam-6zf.11` | **Bereinigung verwaister Tokens** | Entfernung historischer Hilfsklassen und Altbestände im UI-Layer. |
| **P2** | – | **Barcode Multi-Format Lookup** | Ausbau alternativer Barcode-Typen gemäß `docs/specs/barcode-capture/`. |
