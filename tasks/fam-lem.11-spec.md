# Spec: `fam-lem.11` – Vollständige Bestandsbuchungen

## Objective

Alle produktiven Schreibpfade für `fridge_items` müssen ihre fachliche
Mengenbewegung genau einmal im append-only-Ledger `transactions` abbilden.
Die Bestandszeile und die zugehörige Ledger-Zeile bzw. Ledger-Gruppe werden
offline in einer lokalen SQLite-/Outbox-Transaktion geschrieben. Der bereits
behobene Einkaufslisten-Abschluss bleibt dabei abgedeckt.

Der Scope ist ein Audit mit gezielten Korrekturen und Regressionstests. Kein
neuer Ledger-Typ, keine Änderung an RLS oder am Datenbankschema.

## Assumptions

1. `tasks/inventory-lifecycle-plan.md` und
   `docs/specs/household-capabilities/inventory-lifecycle.md` sind die
   fachliche Quelle; der Bead `fam-lem.11` ist der aktuelle Arbeitsauftrag.
2. `restore` und reine Änderungen an Name, Einheit, MHD oder Lifecycle-
   Metadaten ändern keine Bestandsmenge und erzeugen deshalb keine künstliche
   Mengenbuchung.
3. Ein Verbrauch bis auf null ist ein `out` mit der tatsächlich entfernten
   Menge. Die Bestandszeile wird dabei als lokaler Soft-Delete markiert. Bei
   einer gleichzeitigen Lagerortänderung bleibt die Buchung am bisherigen
   Lagerort; ein Move findet nicht mehr statt.
4. Ein Einkaufslisten-Transfer mit einer nicht positiven Menge ist kein
   gültiger Bestandszugang und darf weder eine Nullbuchung noch einen
   Nullmengen-Bestand erzeugen. Alle Transfers werden vor dem ersten
   Schreibvorgang gemeinsam validiert.

## Ledger Contract

| Schreibpfad | Bestandsänderung | Erwartete Buchung | Atomarität |
| --- | --- | --- | --- |
| `useAddFridgeItemMutation` | neuer Bestand | genau ein `in` | eine `enqueueMutations`-Gruppe |
| `useUpdateInventoryItemQuantityMutation` | Delta oder Soft-Delete bei null | genau ein `in` oder `out` mit effektivem Delta; kein Eintrag bei Delta null | eine Gruppe |
| `useUpdateFridgeItemMutation` | manuelle Menge/Lagerortkorrektur | `in`/`out` mit `[Manual correction]`; bei Lagerortwechsel `out` + `in`; bei Entnahme auf null nur `out` am alten Ort | eine Gruppe |
| `useOpenInventoryItemMutation` | In-place-Update oder Split | genau ein `open` mit geöffneter Menge und Vorzustandsdatum | eine Gruppe |
| `useWasteInventoryItemMutation` | Soft-Delete | genau ein `waste` mit Grund und voller Menge | eine Gruppe |
| `useMoveInventoryItemMutation` | Lagerortwechsel | genau ein atomarer Move mit `out` + `in` | eine Move-Outbox-Gruppe |
| `useCompleteShoppingRun` | neuer Bestand je Transfer | genau ein `in` je gültigem Transfer | je Transfer eine Gruppe |
| Restore/Metadaten | keine Mengenänderung | keine Buchung | bestehender Pfad |

## Tech Stack and Commands

- Expo `~57.0.19`, React Native `0.86.3`, React `19.2.3`
- TanStack Query `^5.102.3`
- `expo-sqlite` `~57.0.2`, Drizzle `^1.0.0-rc.4`
- TypeScript, Jest, React Native Testing Library, Biome

Focused tests:

```bash
bun run test src/features/inventory/use-inventory-mutations.test.tsx
bun run test src/features/shopping-list/hooks/use-complete-shopping-run.test.tsx
```

Final checks for this slice:

```bash
bun run typecheck
bun run check
```

No database reset or local Supabase start is part of this task.

## Project Structure

- `src/features/inventory/use-inventory-mutations.ts` – Inventory mutation
  hooks and local ledger payloads.
- `src/features/inventory/use-inventory-mutations.test.tsx` – focused hook
  coverage for every inventory mutation path.
- `src/features/shopping-list/hooks/use-complete-shopping-run.ts` – shopping
  completion transfer into inventory.
- `src/features/shopping-list/hooks/use-complete-shopping-run.test.tsx` –
  transfer/ledger regression tests.
- `src/lib/db/outbox.ts` – local atomic mirror/outbox primitive.
- `src/lib/sync/inventory-move.ts` – grouped move contract.

## Code Style

Use the existing typed transaction draft and `enqueueMutations` pattern. Keep
the domain mapping explicit at each hook boundary; do not introduce a generic
event bus or a second persistence path.

```ts
await enqueueMutations(db, [
  fridgeItemMutation,
  transactionMutation(
    {
      id: transactionId,
      household_id,
      fridge_item_id: itemId,
      type: 'out',
      quantity: effectiveDelta,
      reason: null,
      notes: null,
      undone: false,
      created_at: now,
    },
    nowMs,
  ),
]);
```

## Testing Strategy

- Hook tests assert state-level outcomes: number of outbox entries, ledger
  type, quantity, reason/notes, and that fridge/mirror and ledger mutations
  share one `enqueueMutations` call.
- Boundary tests cover no-op quantity changes, consumption clamped to zero,
  waste reasons, manual correction, split/open, move, zero plus location
  change, and mixed shopping transfers with early validation.
- A static source inventory is recorded in this spec. Test fixtures that
  write `fridge_items` directly are setup code, not productive write paths.
- No new end-to-end or database test is needed because this task changes no
  schema/RLS and the local transaction primitive is already covered by its
  integration suite.

## Boundaries

- Always: preserve unrelated working-tree changes; use `bun run test` rather
  than `bun test`; keep ledger writes in the same local atomic mutation; run
  focused tests after each implementation slice.
- Ask first: schema/migration changes, new dependencies, changes to the
  server-side move RPC, or changes outside the audited inventory/shopping
  paths.
- Never: hand-write migrations, start/stop local Supabase, reset the shared
  worktree, weaken constraints, or add a transaction with `quantity <= 0`.

## Implementation Slices

1. Add failing regression coverage for the full audit matrix, especially
   effective quantity at zero, no-op behavior, and one ledger entry per
   shopping transfer.
2. Make the smallest code correction required by the failing tests. Keep
   valid transfer quantities and existing atomic outbox contracts intact.
3. Run focused tests, typecheck, and Biome. Record any pre-existing failures
   separately from this slice.

## Success Criteria

- Every productive quantity-changing or inventory-creating path in the audit
  matrix has exactly the expected ledger entry/group.
- Shopping completion creates one `type = 'in'` row per valid transfer in the
  same local atomic group as its `fridge_items` insert, and validates every
  transfer before the first write.
- Consumption clamped to zero produces one positive `out` entry for the
  effective delta at the previous location and a soft-deleted local item,
  never a zero transaction or a move leg.
- No-op quantity changes and metadata-only restores do not create ledger rows.
- Focused tests, `bun run typecheck`, and `bun run check` pass, except for
  failures demonstrably caused by unrelated pre-existing workspace changes.

## Official Sources Consulted

- Expo SQLite 57 transactions:
  https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- TanStack Query v5 `useMutation`:
  https://tanstack.com/query/v5/docs/framework/react/reference/useMutation
- Supabase JavaScript `insert`:
  https://supabase.com/docs/reference/javascript/insert
- Supabase JavaScript `rpc`:
  https://supabase.com/docs/reference/javascript/rpc
