# Refactoring-Plan: History + Feature-Slicing + File-Splitting

> Stand: 2026-08-06

## Was geändert wird

### 1 — `shopping_history` Tabelle (DB-Schema)

Neue Tabelle `supabase/schemas/08_inventory.sql`:

```sql
create table if not exists public.shopping_history (
  id          uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  completed_by uuid references public.profiles(id) on delete set null, 
  completed_at timestamptz not null,

  -- Was wurde gekauft
  item_name    text not null,
  quantity     numeric(10,3) not null,
  unit         text not null,
  category     text,
  product_id   uuid references public.products(id) on delete set null,

  -- Wohin eingelagert
  location_kind text check (location_kind in ('fridge','freezer','pantry')),
  expiry_date   date,

  created_at timestamptz not null default now()
);
-- RLS: gleiche Logik wie shopping_list_items (Haushaltsmitglieder)
-- Kein Sync-Flag: History ist append-only, kein Offline-Konflikt möglich
```

Migration via `bun run db:diff -- -f add_shopping_history`.

---

### 2 — Feature-Slicing: Mutations aus `inventory/api.ts` auslagern

**Betrifft:** `useAddFridgeItemMutation`, `useUpdateFridgeItemQuantityMutation`,
`useStorageLocations`, `useDeleteStorageLocationMutation`, `normalizeUnit`, Typen.

> [!IMPORTANT]
> Kein Re-Export — alle Import-Stellen werden direkt umgeschrieben.

| Was                                                                 | Wohin                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| `useAddFridgeItemMutation`<br>`useUpdateFridgeItemQuantityMutation` | [NEW] `src/features/fridge/use-fridge-mutations.ts`     |
| `useStorageLocations`<br>`useDeleteStorageLocationMutation`         | [NEW] `src/features/inventory/use-storage-locations.ts` |
| `normalizeUnit`                                                     | [NEW] `src/lib/units.ts` (reines Utility, kein Feature) |
| Typ `FridgeItem`, `StorageLocation`                                 | direkt in die jeweiligen Feature-Dateien                |

**Import-Stellen die angepasst werden:**

| Datei                                          | Neue Import-Quelle                                                |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `fridge/fridge-screen.tsx`                     | `fridge/use-fridge-mutations`                                     |
| `fridge/use-fridge-items.ts`                   | `inventory/use-storage-locations`                                 |
| `inventory/add-item-screen.tsx`                | `fridge/use-fridge-mutations` + `inventory/use-storage-locations` |
| `inventory/fridge-screen.tsx`                  | `fridge/use-fridge-mutations` + `inventory/use-storage-locations` |
| `inventory/storage-locations-screen.tsx`       | `inventory/use-storage-locations`                                 |
| `shopping-list/use-complete-shopping-run.ts`   | `lib/units` + `inventory/use-storage-locations`                   |
| `shopping-list/use-shopping-list-mutations.ts` | `lib/units`                                                       |

`inventory/api.ts` bleibt als Datei, enthält danach nur noch was ausschliesslich dem `inventory`-Feature gehört (z.B. Produkt-Katalog-Queries).

---

### 3 — File-Splitting: UI von Logik trennen

**Regel:** Kein Screen-File über ~150 Zeilen. Formulare und Zeilen-Komponenten in eigene Dateien.

#### `src/features/shopping-list/`

```
shopping-list-screen.tsx          ← nur Composition (~80 Z.)
components/
  add-item-form.tsx               ← Formular-Logik + UI
  shopping-item-row.tsx           ← einzelne Zeile
```

#### `src/features/fridge/`

```
fridge-screen.tsx                 ← nur Composition (~80 Z.)
components/
  fridge-tab-bar.tsx              ← Tab-Filter Kühl/Froster/Kammer
  fridge-item-row.tsx             ← Zeile mit Stepper + Ampel
```

---

### 4 — `useCompleteShoppingRun` anpassen

Schritt 2 schreibt **vor** dem Soft-Delete in `shopping_history`:

```ts
// Schritt 2a: History-Eintrag anlegen
insert into shopping_history (household_id, completed_by, completed_at,
  item_name, quantity, unit, category, product_id,
  location_kind, expiry_date)
values (...)

// Schritt 2b: Shopping-Item soft-deleten
update shopping_list_items set deleted_at = ..., checked_at = ... where id = ...
```

Da `shopping_history` keine Offline-Konflikte hat (append-only), wird der
Insert **direkt** via `db.runAsync` gemacht — kein `enqueueMutation`.
Das vereinfacht die Logik erheblich.

---

## Dateien im Überblick

#### [NEW] `src/features/fridge/use-fridge-mutations.ts`
#### [NEW] `src/features/inventory/use-storage-locations.ts`
#### [NEW] `src/lib/units.ts`
#### [NEW] `src/features/shopping-list/components/add-item-form.tsx`
#### [NEW] `src/features/shopping-list/components/shopping-item-row.tsx`
#### [NEW] `src/features/fridge/components/fridge-tab-bar.tsx`
#### [NEW] `src/features/fridge/components/fridge-item-row.tsx`
#### [MODIFY] `supabase/schemas/08_inventory.sql` — `shopping_history` hinzufügen
#### [MODIFY] `src/features/shopping-list/shopping-list-screen.tsx` — auf Components umstellen
#### [MODIFY] `src/features/fridge/fridge-screen.tsx` — auf Components umstellen
#### [MODIFY] `src/features/shopping-list/use-complete-shopping-run.ts` — History-Insert
#### [MODIFY] `src/features/shopping-list/use-shopping-list-mutations.ts` — `normalizeUnit` Quelle
#### [MODIFY] `src/features/fridge/use-fridge-items.ts` — Mutations-Re-Export entfernen
#### [MODIFY] `src/features/inventory/add-item-screen.tsx` — Imports umschreiben
#### [MODIFY] `src/features/inventory/fridge-screen.tsx` — Imports umschreiben
#### [MODIFY] `src/features/inventory/storage-locations-screen.tsx` — Imports umschreiben

---

## Reihenfolge

1. `lib/units.ts` — Basis, kein Dep
2. `fridge/use-fridge-mutations.ts` — braucht `lib/units`
3. `inventory/use-storage-locations.ts` — braucht `inventory/api` (vorübergehend)
4. DB-Schema + Migration
5. `use-complete-shopping-run.ts` — braucht History-Tabelle
6. Components auslagern
7. Screens auf Components umstellen
8. Import-Stellen bereinigen
9. `inventory/api.ts` aufräumen
10. Biome + Tests

## Offene Frage

> [!IMPORTANT]
> `shopping_history` hat **kein `_dirty`-Flag** und läuft nicht durch die Outbox —
> History-Einträge werden direkt geschrieben (kein Offline-Conflict möglich, da append-only).
> **Konsequenz:** Wenn ein Nutzer offline einkauft und abschliesst, landet die History
> erst nach dem nächsten Online-Sync in Supabase. Die lokale SQLite-Kopie hat sie sofort.
> Das ist akzeptabel, aber explizit kommuniziert.
