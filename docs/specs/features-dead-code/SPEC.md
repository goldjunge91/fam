# Spec: Feature Dead Code Pruning (`src/features/`)

## Surface Assumptions

> [!IMPORTANT]
> **ASSUMPTIONS & PRINCIPLES FOR THIS SPECIFICATION:**
> 1. **Strict 0-Caller Pruning:** Files and symbols slated for deletion or de-exporting have verified 0 active consumers in the production application bundle.
> 2. **Orphaned Test Deletion:** Unit tests that test only an orphaned component/hook slated for deletion (`paywall-sheet.test.tsx`, `category-field.test.tsx`, `hooks.test.tsx`) are deleted together with their target file.
> 3. **Preserve Architectural Intent (Chesterton's Fence):**
>    - `src/features/ai-agent-skills/`: Decoupled AI skill domain gateway — kept untouched.
>    - `src/features/inventory/use-inventory-mutations.ts` (`useRestoreFridgeItemMutation`): Required by the non-negotiable `AGENTS.md` *Reverse States Rule* — kept untouched.
>    - 15 `.android.*` files: Verified to contain real platform-specific divergence (Drax drag-and-drop, gesture timing, ad units) — kept untouched.
>    - Test fixtures/vectors (`placement-classifier-fixtures.ts`, `preference-identity-test-vectors.ts`): Actively used by domain tests — kept untouched.
> 4. **Zero Regressions:** Every change must preserve green status on `bun run typecheck`, `bun run check`, `bun run check:css`, and all targeted unit tests.

---

## Phase 0: Capability Map

This initiative encompasses 2 focused, sequential modules:

```
dead-files-pruning ──→ dead-exports-cleanup
```

| Module ID | Responsibility | Depends On | Files Touched | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| `dead-files-pruning` | Safely remove 5 orphaned file groups (source + orphaned tests) and clean up dead mocks/blocks in affected tests. | None | 11 files (8 deleted, 3 modified) | Minimal |
| `dead-exports-cleanup` | Remove 4 unused exports/functions in active feature files (`RecipeHeroCard`, `useCheckedShoppingItems`, `isManualCategory`, and make `findMentionableIngredient` private). | `dead-files-pruning` | 4 files (modified) | Minimal |

**Execution Order:**
1. `dead-files-pruning`
2. `dead-exports-cleanup`

---

## 1. Objective

### What We Are Building / Pruning
Following the feature consolidation in Epic `fam-4ki`, a comprehensive audit across all 23 feature folders in `src/features/` identified accumulated dead code:
1. Obsolete UI sheets and components replaced by dedicated screens (`tracking-method-sheet.tsx`, `paywall-sheet.tsx`).
2. Deprecated wrappers and form components bypassed in current flows (`category-field.tsx`, `store-picker-field.tsx`).
3. Dead mutation hooks bypassed by consolidated mutation handlers (`shopping-list/preferences/hooks.ts`).
4. Abandoned components and unused helpers inside active files (`RecipeHeroCard`, `useCheckedShoppingItems`, `isManualCategory`).

The objective is to **eliminate all verified dead code and unused exports** in `src/features/` to improve readability, maintainability, build times, and reduce confusion for maintainers and future agents.

### Who Is the User?
- **App End-Users:** Zero behavioral changes; identical performance and user experience.
- **Maintainers & Agents:** Cleaner directory structures, no zombie components or misleading test mocks, smaller mental surface area.

### Success Definition
- 8 dead source/test files are completely removed from git.
- 3 test files are cleaned of dead mocks/orphaned test suites.
- 4 dead exports in active files are safely removed or internalized.
- `bun run typecheck` passes with 0 errors.
- `bun run check` and `bun run check:css` pass with 0 errors.
- All targeted unit tests pass without regression.

---

## 2. Tech Stack

- **Platform:** React Native 0.86, Expo SDK 57, React 19.2
- **Language / Runtime:** TypeScript 5.x, Bun runtime
- **Task Tracking:** Beads (`bd`)
- **Linting & Formatting:** Biome (`bun run check`), Tailwind CLI (`bun run check:css`)
- **Testing:** Jest (`bun run test ...`), `@testing-library/react-native`

---

## 3. Commands

All commands are run from the repository root within the worktree:

```bash
# Typecheck
bun run typecheck

# Lint & Format
bun run check

# CSS Check
bun run check:css

# Targeted Unit Tests
bun run test src/features/shopping-list/components/ui/store-picker.test.tsx
bun run test src/features/shopping-list/forms/add-item-form.test.tsx
bun run test src/features/shopping-list/forms/edit-item-form.test.tsx
bun run test src/features/recipes/components/recipe-preview-card.test.ts
bun run test src/features/recipes/domain/ingredient-mentions.test.ts
bun run test src/features/shopping-list/hooks/use-shopping-list.test.ts

# Git Status Inspection
git status --short
```

> [!CAUTION]
> NEVER run `bun test` or full unrestricted `bun run test`. Only run targeted tests.

---

## 4. Project Structure & Affected Files

```
src/features/
├── profile/
│   └── sheets/
│       └── [DELETE] tracking-method-sheet.tsx
├── premium/
│   ├── [DELETE] paywall-sheet.tsx
│   └── [DELETE] paywall-sheet.test.tsx
├── shopping-list/
│   ├── forms/
│   │   ├── [DELETE] category-field.tsx
│   │   ├── [DELETE] category-field.test.tsx
│   │   ├── [DELETE] store-picker-field.tsx
│   │   ├── [MODIFY] category-form-state.ts     (remove isManualCategory)
│   │   ├── [MODIFY] add-item-form.test.tsx     (remove dead jest.mock('../preferences/hooks'))
│   │   └── [MODIFY] edit-item-form.test.tsx    (remove dead jest.mock('../preferences/hooks'))
│   ├── preferences/
│   │   ├── [DELETE] hooks.ts
│   │   └── [DELETE] hooks.test.tsx
│   ├── hooks/
│   │   └── [MODIFY] use-shopping-list.ts       (remove useCheckedShoppingItems)
│   └── components/ui/
│       └── [MODIFY] store-picker.test.tsx      (remove StorePickerField test block)
└── recipes/
    ├── components/
    │   └── [MODIFY] recipe-preview-card.tsx    (remove RecipeHeroCard)
    └── domain/
        └── [MODIFY] ingredient-mentions.ts     (remove export from findMentionableIngredient)
```

---

## 5. Code Style & Conventions

- Strictly follow existing project conventions: Biome formatting (2 spaces, single quotes, trailing commas where configured).
- No dead variables, unused imports, or leftover comments.
- Example of making an internal helper private:
  ```typescript
  // Before
  export function findMentionableIngredient(...) { ... }

  // After
  function findMentionableIngredient(...) { ... }
  ```

---

## 6. Testing Strategy

1. **Pre-modification validation:** Verify all affected tests pass before modifying files.
2. **Atomic removal:** Remove dead files and verify compiler diagnostics.
3. **Dead mock cleanup:** Clean up obsolete mocks (`jest.mock('../preferences/hooks')`) in `add-item-form.test.tsx` and `edit-item-form.test.tsx`.
4. **Post-modification test execution:** Run all 6 targeted test files to ensure 100% green status.
5. **Full project validation:** Run `bun run typecheck` and `bun run check`.

---

## 7. Boundaries

- **Always do:**
  - Verify 0 callers before deleting any file or export.
  - Run targeted unit tests and `bun run typecheck`.
  - Use Beads (`bd`) for all task tracking.
- **Ask first:**
  - Deleting any file that has external consumers.
  - Modifying files in `src/features/ai-agent-skills/`.
  - Modifying database schemas or migrations.
- **Never do:**
  - Touch `/Users/marco/Github.tmp/family_app/fam`.
  - Create markdown `todo.md` files.
  - Delete `useRestoreFridgeItemMutation` (violates Reverse States Rule).
  - Run `bun test` or full test suite.

---

## 8. Success Criteria

- [ ] All 8 orphaned files (`tracking-method-sheet.tsx`, `paywall-sheet.tsx`, `paywall-sheet.test.tsx`, `category-field.tsx`, `category-field.test.tsx`, `store-picker-field.tsx`, `hooks.ts`, `hooks.test.tsx`) are deleted.
- [ ] `store-picker.test.tsx` passes cleanly with `StorePickerField` block removed.
- [ ] `add-item-form.test.tsx` and `edit-item-form.test.tsx` pass without obsolete `hooks` mocks.
- [ ] `RecipeHeroCard` is removed from `recipe-preview-card.tsx` with no compiler errors.
- [ ] `findMentionableIngredient` in `ingredient-mentions.ts` is private and its callers within the file continue working.
- [ ] `useCheckedShoppingItems` and `isManualCategory` are safely removed.
- [ ] `bun run typecheck` reports 0 errors.
- [ ] `bun run check` reports 0 errors.
- [ ] All targeted unit tests pass.

---

## 9. Open Questions

None. All audit findings have been verified against the codebase and callers confirmed to be 0.
