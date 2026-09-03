# Spec: `inventory-lifecycle`

Status: Phase 2 (Plan) — Datenmodell nach Doubt-Review korrigiert, Tasks in bd (`fam-lem`)
Modul-Id: `inventory-lifecycle` (siehe `CAPABILITY_MAP.md`, Pakete 1–3)
Referenzen: `CAPABILITY_MAP.md`, `opened-expiry-rules.md`

## Objective

Fam protokolliert Bestandsänderungen heute nur als rohes Mengen-Delta ohne
Historie, Grund oder Zustand (`useUpdateInventoryItemQuantityMutation`
addiert/subtrahiert `quantity` und löscht die Zeile bei 0 — siehe
`src/features/inventory/use-inventory-mutations.ts:84`). Es gibt kein
Protokoll, warum etwas den Bestand verlassen hat, keinen "geöffnet"-Zustand
und keine automatisch berechnete Haltbarkeit nach dem Öffnen.

`inventory-lifecycle` schließt diese Lücke mit zwei Bausteinen:

1. Eine `transactions`-Ledger-Tabelle, die jede Bestandsbewegung
   (Zugang/Verbrauch/Verschwendung) zusätzlich zur `fridge_items`-Zeile
   protokolliert, mit 24h-Undo.
2. Ein Öffnen/Versiegelt/Vakuum-Zustand pro `fridge_items`-Zeile mit
   automatisch berechneter Haltbarkeit nach dem Öffnen.

**User:** Haushaltsmitglieder, die Bestand verbrauchen, wegwerfen oder öffnen.
**Warum jetzt:** Grundlage für spätere Verschwendungsstatistik
(`household-insights`, siehe Capability Map Punkt 13) und für belastbare
Ablaufdaten nach dem Öffnen einer Packung.

**Erfolg sieht so aus:** Jede Mengenänderung an `fridge_items` erzeugt eine
nachvollziehbare `transactions`-Zeile; Öffnen einer Packung berechnet ein
realistisches Ablaufdatum statt eines pauschalen, oft zu optimistischen
Datums; beides läuft offline (Outbox) und ist per RLS auf den eigenen
Haushalt beschränkt.

## Tech Stack

Unverändert zum bestehenden Stack: Supabase/Postgres (deklaratives Schema,
RLS), `expo-sqlite` + Drizzle für den lokalen Mirror, React Query für
Mutations, Zod für Validierung wo neue Formulare entstehen.

## Datenmodell

### Neue Tabelle `transactions`

```sql
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,

  -- Bezug auf die betroffene Bestandszeile. Nullable: die Zeile kann
  -- inzwischen geloescht/gemerged sein: die Buchung bleibt trotzdem gueltige
  -- Historie (analog zu fridge_items.product_id, das ebenfalls "on delete
  -- set null" ist).
  fridge_item_id uuid references public.fridge_items (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,

  -- Wer die Aktion ausgeloest hat. Analog zu fridge_items.added_by.
  actor uuid references public.profiles (id) on delete set null,

  -- 'open' aendert die Gesamtmenge im Haushalt nicht (reine
  -- Zustandsaenderung an fridge_items), wird aber trotzdem geloggt: ohne
  -- diese Zeile gibt es fuer den quantity=1-Inplace-Fall (siehe unten)
  -- keinen gespeicherten Vorzustand, aus dem ein Undo/"Wieder versiegeln"
  -- das alte expiry_date wiederherstellen koennte (Doubt-Review #2).
  type text not null check (type in ('in', 'out', 'waste', 'open')),
  quantity numeric(10, 3) not null check (quantity > 0),
  location_id uuid references public.storage_locations (id) on delete set null,

  -- Reason ist genau dann gesetzt, wenn type = 'waste' — nicht nur "erlaubt
  -- bei waste" (Doubt-Review #6: eine 'waste'-Zeile ohne Grund war mit der
  -- alten Fassung des Constraints zulaessig).
  reason text check (reason in ('expired', 'spoiled', 'other')),
  constraint transactions_reason_matches_waste
    check ((type = 'waste') = (reason is not null)),

  -- Nur bei type = 'open' gesetzt: das expiry_date, das die betroffene
  -- fridge_items-Zeile unmittelbar vor dem Oeffnen hatte. Einzige Quelle,
  -- aus der "Oeffnen rueckgaengig machen" das Datum wiederherstellen kann.
  previous_expiry_date date,
  constraint transactions_previous_expiry_only_for_open
    check (previous_expiry_date is null or type = 'open'),

  notes text check (notes is null or length(notes) <= 500),
  undone boolean not null default false,

  created_at timestamptz not null default now()
);

comment on table public.transactions is
  'Ledger jeder Bestandsbewegung (in/out/waste). Ergaenzt fridge_items,
   ersetzt dessen Mengen-Delta-Verhalten nicht.';

create index if not exists transactions_household_id_idx
  on public.transactions (household_id);
create index if not exists transactions_fridge_item_id_idx
  on public.transactions (fridge_item_id);
create index if not exists transactions_household_created_idx
  on public.transactions (household_id, created_at);
```

Kein `updated_at` — Transaktionen werden angehängt, nie editiert (Undo
erzeugt eine neue Zeile, siehe unten). Kein `deleted_at` — Historie wird nicht
gelöscht.

### Erweiterung `fridge_items`

```sql
alter table public.fridge_items
  add column if not exists opened_at timestamptz,
  add column if not exists vacuum_sealed boolean not null default false,
  add column if not exists expiry_user_set boolean not null default false;

-- Backfill (Doubt-Review #1): expiry_date ist heute bereits ein
-- Nutzereingabefeld (add-item-screen.tsx, edit-inventory-item-sheet.tsx) —
-- es gibt noch keine automatische Berechnung, jedes vorhandene expiry_date
-- wurde also manuell gesetzt. Ohne dieses Backfill wuerde expiry_user_set
-- fuer alle Bestandszeilen vor dieser Migration auf false stehen und die
-- erste Oeffnen-Aktion wuerde ein manuell gesetztes Datum stillschweigend
-- ueberschreiben.
update public.fridge_items
  set expiry_user_set = true
  where expiry_date is not null;
```

- „versiegelt“ = `opened_at is null`
- „geöffnet“ = `opened_at is not null`
- `expiry_user_set = true`: Nutzer hat `expiry_date` manuell gesetzt; die
  automatische Neuberechnung beim Öffnen überschreibt dieses Datum nicht.

### RLS

`transactions` ist geteilte Haushaltsdatentabelle, aber **nicht** mit der
`fridge_items_all_member`-`for all`-Policy 1:1 übernommen (Doubt-Review #3):
`for all` würde UPDATE/DELETE für jedes Haushaltsmitglied erlauben, obwohl
die Tabelle laut Boundaries append-only sein soll. Die Immutability wird
daher direkt in RLS erzwungen, nicht nur durch Client-Disziplin
(`applyLocalMirrorWrite` kennt ohnehin nur `insert`):

```sql
alter table public.transactions enable row level security;

create policy transactions_select_member on public.transactions
  for select to authenticated
  using ((select private.is_household_member(household_id)));

create policy transactions_insert_member on public.transactions
  for insert to authenticated
  with check ((select private.is_household_member(household_id)));

-- Bewusst keine UPDATE/DELETE-Policy: RLS verweigert diese Operationen
-- damit per Default fuer alle authenticated-Nutzer, unabhaengig davon, ob
-- Client-Code sich daran haelt.
```

`shopping_history` nutzt aktuell dieselbe `for all`-Policy wie `fridge_items`
obwohl auch dort nur angehängt wird — das ist ein vorbestehendes,
akzeptiertes Muster in diesem Projekt und wird hier bewusst **nicht**
übernommen, aber auch nicht rückwirkend für `shopping_history` korrigiert
(außerhalb dieses Spec-Scopes).

pgTAP-Tests unter `supabase/tests/` (neue Datei `24_inventory_lifecycle.test.sql`
— `23_avatar_storage.test.sql` ist aktuell die letzte, siehe
`ls supabase/tests/`): Mitglied kann lesen/inserten, Nicht-Mitglied nicht,
UPDATE/DELETE wird für alle authenticated-Nutzer verweigert, `reason` ist
gesetzt genau dann wenn `type = 'waste'`, `quantity > 0` greift.

## Verhalten

### Buchungen (`transactions`)

Jede Mutation, die `fridge_items.quantity` ändert, schreibt zusätzlich eine
`transactions`-Zeile:

| Aktion | `type` | `notes` |
| --- | --- | --- |
| Verbrauch (Menge reduzieren) | `out` | — |
| Wegwerfen | `waste` | `reason` gesetzt |
| Zugang (neuer Eintrag, Menge erhöhen) | `in` | — |
| Manuelle Mengenkorrektur | `in`/`out` je nach Vorzeichen | `[Manual correction]` |
| Verschieben (Lagerort ändern) | `out` am alten `location_id` **und** `in` am neuen `location_id` (zwei Zeilen, eine Outbox-Mutation, siehe unten) | — |
| Öffnen (siehe Öffnen-Abschnitt) | `open`, `quantity` = geöffnete Menge, `previous_expiry_date` = altes Datum | — |
| Undo (innerhalb 24h) | Gegenbuchung mit invertiertem `type` (`open` wird durch erneutes `open` mit vertauschtem Vorzustand "rückgängig gemacht", siehe Öffnen-Abschnitt) | `[Undone]` |

**Verschieben-Atomizität (Doubt-Review #7):** beide Zeilen (`out` altes Los,
`in` neues Los) werden in **einer** Outbox-Mutation geschrieben, nicht als
zwei unabhängige Requests — schlägt der zweite Insert fehl, wird die gesamte
Mutation zurückgerollt, es gibt keinen Zustand mit nur einer der beiden
Zeilen. Undo eines Verschiebens macht **beide** Zeilen gemeinsam rückgängig
(eine Undo-Aktion, nicht zwei einzelne).

`useUpdateInventoryItemQuantityMutation` bleibt die Quelle der Wahrheit für
`fridge_items.quantity` (inkl. Soft-Delete bei 0) und wird um das
Transaction-Logging erweitert — kein Ersatzpfad.

### Undo

- Nur innerhalb von 24 Stunden ab `created_at` möglich.
- Erzeugt eine Gegenbuchung (`type` invertiert, `notes = '[Undone]'`) und
  macht die `fridge_items.quantity`-Änderung rückgängig.
- Die ursprüngliche Zeile bleibt erhalten, `undone` wird auf `true` gesetzt.
- Nach 24h: keine Undo-Option mehr in der UI; Korrektur läuft über eine neue
  Buchung mit `[Manual correction]`.

### Waste-Gründe

Kurze Liste, kein 1:1 der 8 EverShelf-Kategorien:

```text
expired | spoiled | other
```

Eigenes typisiertes `reason`-Feld, nicht in `notes` codiert.

### Öffnen-Zustand und Split

Öffnen einer `fridge_items`-Zeile mit `quantity = N` schreibt **immer** eine
`transactions`-Zeile mit `type = 'open'`, `previous_expiry_date` = das
`expiry_date` der betroffenen Zeile unmittelbar vor dem Öffnen (auch bei
`N = 1` — korrigiert gegenüber einer früheren Fassung dieser Spec, die den
Split als reine Strukturänderung ohne Buchung behandelte und damit keinen
Weg hatte, das alte Datum je wiederherzustellen):

- **`N = 1`:** Zeile wird in-place aktualisiert (`opened_at = now()`,
  `expiry_date` neu berechnet). `transactions.fridge_item_id` zeigt auf
  dieselbe (jetzt geöffnete) Zeile.
- **`N > 1`, Teilmenge `k` wird geöffnet:** die Original-Zeile bleibt
  versiegelt mit `quantity = N - k`; eine neue Zeile wird angelegt mit
  `quantity = k`, `opened_at = now()`, neu berechnetem `expiry_date`, sonst
  identischen Feldern (`product_id`, `location_id`, `vacuum_sealed`,
  `household_id`). Beide Zeilen sind danach unabhängig voneinander (kein
  gemeinsamer Fremdschlüssel). `transactions.fridge_item_id` zeigt auf die
  neue geöffnete Zeile.
- Die Gesamtmenge im Haushalt ändert sich durch das Öffnen nicht — die
  `open`-Buchung dient der Nachvollziehbarkeit und dem Undo, nicht der
  Mengenbilanz.

**Öffnen rückgängig machen, innerhalb 24h (Reverse-States-Regel):** Undo der
`open`-Buchung setzt `expiry_date` aus `previous_expiry_date` zurück und
`opened_at = null`. Im `N > 1`-Fall wird zusätzlich die geöffnete Zeile
wieder in die ursprüngliche Zeile zurückgemerged (`quantity` addiert,
geöffnete Zeile gelöscht) — nur möglich, solange die versiegelte
Ursprungszeile noch existiert und nicht zwischenzeitlich anderweitig
verändert wurde; sonst bleibt die geöffnete Zeile als eigenständiger Eintrag
bestehen und der `opened_at`-Wert wird nicht zurückgesetzt (gleiche
Fallback-Regel wie beim generischen Undo nach 24h, siehe unten).

**Manuelles "Wieder versiegeln" nach Ablauf der 24h (Doubt-Review #8):** Ohne
diesen Pfad hätte "geöffnet" nach 24h kein Gegenstück mehr und würde die
Reverse-States-Regel aus `AGENTS.md` verletzen. Nach Ablauf des
Undo-Fensters kann eine geöffnete Zeile weiterhin manuell auf versiegelt
zurückgesetzt werden — wie eine normale Bearbeitung (`opened_at = null`,
`expiry_date` manuell durch den Nutzer gesetzt, `expiry_user_set = true`),
protokolliert als `open`-Buchung mit `[Manual correction]` in `notes`
und `quantity = 0` **oder** — konsistenter mit dem `quantity > 0`-Constraint
— ohne eigene Buchung, wenn keine Mengenänderung stattfindet, nur eine
`fridge_items`-Aktualisierung. Diese Wahl trifft `fam-lem.3`/`fam-lem.7` bei
der Implementierung; UI-mäßig ist es derselbe "Weitere Angaben"-Bereich wie
heute schon für `opened_at`/`expiry_date` in `EditInventoryItemSheet`.

### Berechnete Haltbarkeit

Beim Öffnen wird `expiry_date` nach den Regeln aus `opened-expiry-rules.md`
berechnet (Produktgruppe + Lagerort, erster Treffer gewinnt, Fallback pro
Lagerort). Ausnahmen:

- Ist `expiry_user_set = true` **und** das vorhandene `expiry_date` liegt
  vor dem berechneten Datum, bleibt das vorhandene Datum erhalten.
- `vacuum_sealed = true` verlängert den Regelwert zusätzlich. Die konkreten
  Verlängerungswerte sind in dieser Spec **nicht** final — sie werden vor
  Implementierung fachlich gegen aktuelle Lebensmittelsicherheits-Empfehlungen
  geprüft (siehe `opened-expiry-rules.md`, Abschnitt "Festgelegte
  Entscheidungen für Fam").
- Die berechnete Haltbarkeit wird nur als `expiry_date` angezeigt/gespeichert,
  es gibt kein separates `estimated`-Feld (siehe Referenz-Doc).

### Verlauf-Ansichten

Der Transaktionsverlauf wird an zwei Stellen angezeigt, nicht nur als ein
Gesamt-Screen:

- **Gesamt-Verlauf** (`transactions` gefiltert nach `household_id`): alle
  Bewegungen im Haushalt, gruppiert nach Tag.
- **Produkt-Verlauf** (`transactions` zusätzlich gefiltert nach `product_id`
  bzw. `fridge_item_id`): auf der Produktdetailseite, zeigt nur die
  Bewegungen dieses Produkts (Öffnen, Verbrauch, Waste, Korrekturen über alle
  Lose hinweg). Wichtig bei mehreren gleichzeitigen Losen desselben Produkts
  (z. B. ein versiegeltes und ein geöffnetes Glas Senf) — dort muss erkennbar
  sein, welcher Eintrag zu welchem Los gehört.

Beide Ansichten nutzen dieselbe zugrunde liegende Query, nur mit
unterschiedlichem Filter — keine zweite Tabelle oder Materialisierung nötig.

### Sync/Offline

- `transactions` ist eine neue Sync-Entität: lokales SQLite-Mirror-Schema
  (Drizzle, `src/lib/db/schemas/`), Outbox-Eintrag beim Schreiben, Pull über
  `household_id, created_at` (analog zum `updated_at`-Index bei
  `fridge_items`).
- Die neuen `fridge_items`-Spalten (`opened_at`, `vacuum_sealed`,
  `expiry_user_set`) müssen im lokalen Mirror-Schema und im
  `applyLocalMirrorWrite`-Sync-Handler ergänzt werden.
- Transaktionen werden nie editiert oder hart gelöscht — der Outbox-Handler
  kennt für `transactions` nur `insert`, keinen `update`/`delete`-Pfad
  (Undo/Korrektur sind neue `insert`s).

## Code Style

Bestehende Konventionen fortführen, kein neues Muster:

```ts
// src/features/inventory/use-inventory-mutations.ts – Vorbild fuer neue
// Transaction-Mutations: enqueueMutation + applyLocalMirrorWrite,
// React-Query-Invalidation im onSuccess.
export function useConsumeFridgeItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConsumeInput) => {
      /* fridge_items.quantity aktualisieren + transactions-Zeile schreiben */
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fridge_items', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.household_id] });
    },
  });
}
```

Typen für `transactions` werden aus `database.types.ts` inferiert (nach
`bun run db:types`), kein manuelles Duplikat wie das bestehende
`FridgeItem`-Type-Literal — dort wo neu geschrieben wird, `Database['public']['Tables']['transactions']['Row']` nutzen statt erneut von Hand zu tippen.

## Testing Strategy

- **pgTAP** (`supabase/tests/24_inventory_lifecycle.test.sql`): RLS
  Select/Insert für Mitglied, verweigert für Nicht-Mitglied; UPDATE/DELETE
  wird für **jeden** authenticated-Nutzer verweigert (Immutability, nicht
  nur Nicht-Mitglied); `reason` gesetzt genau dann wenn `type = 'waste'`;
  `previous_expiry_date` gesetzt genau dann wenn `type = 'open'`;
  `quantity > 0` greift.
- **Jest Unit** (`src/features/inventory/`): reine Funktionen für
  Haltbarkeitsberechnung (`opened-expiry-rules_v1/_v2.md`-Tabelle → eine
  Testzeile pro Produktgruppe/Lagerort + Fallback + Vakuum-Verlängerung +
  `expiry_user_set`-Schutz), Split-/Merge-Logik beim Öffnen/Rückgängigmachen
  inkl. Merge-Fallback-Fall, 24h-Undo-Fenster-Grenzfall, Backfill-Migration
  (bestehende Zeile mit `expiry_date` → `expiry_user_set = true` danach).
- **Keine E2E-Erweiterung** in dieser Runde — die Maestro-Flows unter
  `e2e/` decken Haushalt-Erstellung/Beitritt ab, nicht Inventar-Details.

## Boundaries

- **Always:** Jede `fridge_items`-Mengenänderung erzeugt eine
  `transactions`-Zeile; `reason` nur bei `type = 'waste'`; Undo nur innerhalb
  24h; RLS + pgTAP-Test für jede neue Tabelle/Spalte (siehe `AGENTS.md`
  Feature-Completeness-Checklist).
- **Ask first:** Neue Produktgruppen/Lagerort-Regeln in der
  Haltbarkeitsberechnung, Vakuum-Verlängerungswerte, jede Änderung an den
  bestehenden `fridge_items`-Feldern (`quantity`, `location_id`), Erweiterung
  der Waste-Liste über die 3 Kategorien hinaus.
- **Never:** Migrationsdateien von Hand schreiben (nur `bun run db:diff`
  gegen `supabase/schemas/`), `transactions`-Zeilen editieren oder hart
  löschen (durchgesetzt per RLS — keine UPDATE/DELETE-Policy, nicht nur per
  Konvention), `estimated`/`best_before`/`use_by` als eigene Felder einführen
  (siehe Referenz-Doc-Boundary), Actor auf `child_profiles` ausweiten, die
  Haltbarkeitsberechnung mit Platzhalterwerten releasen ohne `fam-lem.9`
  abzuschließen.

## Success Criteria

- `bun run db:diff -- -f inventory-lifecycle` erzeugt eine Migration für
  `transactions` + die drei neuen `fridge_items`-Spalten; `bun run db:diff`
  ist danach leer.
- `bun run test:db` grün für die neue pgTAP-Datei.
- `bun run test` grün für die neuen Unit-Tests (Haltbarkeitsberechnung,
  Split/Merge, Undo-Fenster).
- `bun run db:advisors` zeigt keine neuen Security-Findings zu `transactions`.
- `transactions` verweigert UPDATE/DELETE per RLS für jeden authenticated-Nutzer
  (verifiziert via pgTAP, nicht nur behauptet).
- `bun run db:types` aktualisiert `src/lib/database.types.ts` ohne manuelle
  Nacharbeit.
- Verbrauchen/Wegwerfen/Verschieben/Öffnen erzeugen im lokalen SQLite-Mirror
  dieselbe Historie wie serverseitig (Sync-Parität, manuell im Dev-Client
  gegen ausgeschaltetes Netz geprüft).

## Entschiedene Punkte (vormals Open Questions)

1. **Regel-Prüfung:** Claude recherchiert die konkreten Tage-Werte je
   Produktgruppe/Lagerort und die Vakuum-Verlängerung gegen anerkannte
   Lebensmittelsicherheits-Richtlinien (z. B. FDA FoodKeeper, BfR, USDA) und
   schlägt angepasste Werte vor; Marco gibt am Ende frei. Nachverfolgt als
   eigenes Ticket (siehe unten), nicht Teil dieser Spec-Datei.
2. **Produktgruppen-Zuordnung:** Grundlage ist die in
   `opened-expiry-rules_v2.md` dokumentierte Namensmuster-Erkennung
   (`estimateOpenedExpiryDaysPHP()` samt Kategorie-Normalisierung) — direktes
   Matching auf Produktname/-kategorie, nicht die vorhandene
   Shopping-List-Kategorie und nicht `off_category_tags`. Die italienischen
   Namensmuster werden für Fam auf deutsche/englische Begriffe übersetzt und
   um Lücken ergänzt, wo die Recherche aus Punkt 1 neue Erkenntnisse liefert.
   `opened-expiry-rules_v1.md` und `_v2.md` ersetzen das ursprüngliche
   `opened-expiry-rules.md` als Referenz für die Implementierung.
3. **UI: freigegeben.** Mockups für Öffnen-Aktion, Waste-Grund-Auswahl und
   Transaktionshistorie/Undo liefen parallel zur Plan-Phase. Drei Optionen
   wurden gebaut (A: Bottom-Sheets + Zustandschips, B: Inline-Accordion +
   Timeline, C: durchgehende Kantenfarbe + Vorher/Nachher-Vergleich).
   **Marcos Wahl: Option C**, freigegeben inkl. Ergänzungen (Produkt-Verlauf,
   bestehende Ring-Karten `InventorySummaryCard` bleiben unverändert über der
   Liste). Referenz für die Implementierung:
   `mockups/inventory-lifecycle/mockup-option-c-full-flow.html` (alle
   Ansichten in einer Datei) + `README.md` im selben Ordner für die
   Einzeldateien.

## Doubt-Review (Phase 2)

Ein adversarialer Fresh-Context-Review gegen diese Spec + den Plan
(`tasks/inventory-lifecycle-plan.md`) fand 8 Befunde, alle eingearbeitet:

1. **Backfill-Lücke bei `expiry_user_set`** — vorhandene, manuell gesetzte
   `expiry_date`-Werte hätten die erste Öffnen-Aktion stillschweigend
   überschrieben. Fix: `update ... set expiry_user_set = true where
   expiry_date is not null` im Migrations-SQL.
2. **Kein gespeicherter Vorzustand für Öffnen-Undo** — der `N=1`-Inplace-Fall
   hatte kein Feld, aus dem ein Undo das alte `expiry_date` wiederherstellen
   konnte. Fix: `type = 'open'` als vierter Transaktionstyp,
   `previous_expiry_date`-Spalte.
3. **RLS `for all` erzwingt keine Immutability** — jedes Haushaltsmitglied
   hätte Zeilen editieren/löschen können, obwohl die Tabelle append-only
   sein soll. Fix: nur SELECT/INSERT-Policies, keine UPDATE/DELETE-Policy.
4. **Falsche Dateinummer-Referenz** — `20_ai_fair_use.test.sql` war nicht
   mehr die letzte Datei (`23_avatar_storage.test.sql` ist aktuell). Fix:
   `24_inventory_lifecycle.test.sql`.
5. **Platzhalterwerte ohne Release-Gate** — `fam-lem.2` durfte mit
   ungeprüften Werten geschlossen werden, ohne dass etwas den späteren Swap
   erzwingt. Fix: neue Task `fam-lem.9`, abhängig von `fam-lem.2` und
   `fam-lem.8`.
6. **`reason` bei `waste` nicht erzwungen** — Constraint erlaubte
   `type = 'waste'` mit `reason = null`. Fix:
   `check ((type = 'waste') = (reason is not null))`.
7. **Verschieben-Atomizität ungeklärt** — zwei Ledger-Inserts ohne Aussage zu
   Teilausfall/Undo-Paarung. Fix: eine Outbox-Mutation für beide Zeilen,
   Undo macht beide gemeinsam rückgängig.
8. **Reverse-States-Lücke nach 24h** — "geöffnet" hatte nach Ablauf des
   Undo-Fensters keinen Weg zurück zu "versiegelt". Fix: manuelles
   "Wieder versiegeln" als reguläre Bearbeitung, analog zur bestehenden
   `EditInventoryItemSheet`.

Ein zweiter Doubt-Zyklus wurde nicht für nötig befunden — die Befunde waren
konkret und wurden direkt am Datenmodell behoben, keine offenen
Interpretationsfragen mehr. Cross-Model-Review wurde nicht angeboten (nicht
interaktiv abgefragt in diesem Zyklus) — auf Wunsch nachholbar.

## Nächste Schritte

- Implementierung nach Abhängigkeitsgraph in `tasks/inventory-lifecycle-plan.md`,
  beginnend mit `fam-lem.1`.
- `fam-lem.8` (Recherche Tageswerte) läuft parallel, `fam-lem.9` erzwingt den
  späteren Swap.
