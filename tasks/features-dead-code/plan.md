# Plan: Feature Dead Code Pruning (`src/features/`)

## 1. Overview & Objective

Systematic, zero-regression elimination of verified dead code, orphaned test suites, and unused exported symbols across `src/features/`.
All work is tracked in Beads Epic **`fam-b4p`**.

Specification: [SPEC.md](file:///Users/marco/.gemini/antigravity/worktrees/fam/check_current_project_state/docs/specs/features-dead-code/SPEC.md)

---

## 2. Dependency Graph & Task Breakdown

```
fam-b4p.1 (Profile/Premium Sheets) ──→ fam-b4p.2 (Shopping Form Components)
                                               │
                                               ▼
fam-b4p.4 (Active Feature Exports) ◀── fam-b4p.3 (Shopping Preferences Hooks)
```

### Task 1: `fam-b4p.1` · Profile & Premium: verwaiste Sheets löschen
- **Description:** Delete orphaned sheet components that were superseded by dedicated full screens.
- **Files touched (3 files):**
  - `[DELETE]` `src/features/profile/sheets/tracking-method-sheet.tsx`
  - `[DELETE]` `src/features/premium/paywall-sheet.tsx`
  - `[DELETE]` `src/features/premium/paywall-sheet.test.tsx`
- **Acceptance criteria:**
  - `tracking-method-sheet.tsx` is deleted (0 references across project).
  - `paywall-sheet.tsx` and its test are deleted (replaced by `PlusAndAiScreen`).
  - `bun run typecheck` passes with 0 errors.
- **Verification:**
  ```bash
  bun run typecheck
  ```
- **Scope:** Small (3 files)

---

### Task 2: `fam-b4p.2` · Shopping-List: verwaiste Formular-Komponenten und Tests bereinigen
- **Description:** Remove deprecated category wrapper and unused store picker field; prune isolated test block.
- **Files touched (4 files):**
  - `[DELETE]` `src/features/shopping-list/forms/category-field.tsx`
  - `[DELETE]` `src/features/shopping-list/forms/category-field.test.tsx`
  - `[DELETE]` `src/features/shopping-list/forms/store-picker-field.tsx`
  - `[MODIFY]` `src/features/shopping-list/components/ui/store-picker.test.tsx`
- **Acceptance criteria:**
  - `category-field.tsx` and `category-field.test.tsx` are deleted.
  - `store-picker-field.tsx` is deleted.
  - `store-picker.test.tsx` only tests `StorePickerMenu`; its `StorePickerField` describe block is cleanly removed.
- **Verification:**
  ```bash
  bun run test src/features/shopping-list/components/ui/store-picker.test.tsx
  bun run typecheck
  ```
- **Scope:** Medium (4 files)

---

### Checkpoint 1 (Nach Tasks 1–2):
- `bun run typecheck` ist fehlerfrei.
- Alle Shopping-List UI-Tests laufen sauber durch.

---

### Task 3: `fam-b4p.3` · Shopping-List: verwaiste Preferences-Hooks und Test-Mocks bereinigen
- **Description:** Remove unused mutation hooks in preferences and clean up unused mocks in form tests.
- **Files touched (4 files):**
  - `[DELETE]` `src/features/shopping-list/preferences/hooks.ts`
  - `[DELETE]` `src/features/shopping-list/preferences/hooks.test.tsx`
  - `[MODIFY]` `src/features/shopping-list/forms/add-item-form.test.tsx`
  - `[MODIFY]` `src/features/shopping-list/forms/edit-item-form.test.tsx`
- **Acceptance criteria:**
  - `hooks.ts` and `hooks.test.tsx` are deleted.
  - Obsolete `jest.mock('../preferences/hooks', ...)` calls in `add-item-form.test.tsx` and `edit-item-form.test.tsx` are removed.
  - Both form unit tests pass without errors.
- **Verification:**
  ```bash
  bun run test src/features/shopping-list/forms/add-item-form.test.tsx
  bun run test src/features/shopping-list/forms/edit-item-form.test.tsx
  bun run typecheck
  ```
- **Scope:** Medium (4 files)

---

### Task 4: `fam-b4p.4` · Aktive Features: ungenutzte Exporte entfernen
- **Description:** Eliminate dead exported components, de-export internal helpers, and prune unused query hooks.
- **Files touched (4 files):**
  - `[MODIFY]` `src/features/recipes/components/recipe-preview-card.tsx` (remove `RecipeHeroCard`)
  - `[MODIFY]` `src/features/recipes/domain/ingredient-mentions.ts` (remove `export` from `findMentionableIngredient`)
  - `[MODIFY]` `src/features/shopping-list/hooks/use-shopping-list.ts` (remove `useCheckedShoppingItems`)
  - `[MODIFY]` `src/features/shopping-list/forms/category-form-state.ts` (remove `isManualCategory`)
- **Acceptance criteria:**
  - `RecipeHeroCard` is removed with no impact on `RecipePreviewCard`.
  - `findMentionableIngredient` is scoped internally to `ingredient-mentions.ts`.
  - `useCheckedShoppingItems` and `isManualCategory` are safely pruned.
  - All recipe and shopping-list tests pass cleanly.
- **Verification:**
  ```bash
  bun run test src/features/recipes/components/recipe-preview-card.test.ts
  bun run test src/features/recipes/domain/ingredient-mentions.test.ts
  bun run test src/features/shopping-list/hooks/use-shopping-list.test.ts
  bun run typecheck
  bun run check
  bun run check:css
  ```
- **Scope:** Medium (4 files)

---

### Checkpoint 2 (Abschluss):
- Alle 4 Beads-Tasks (`fam-b4p.1` bis `fam-b4p.4`) sind abgeschlossen.
- `bun run typecheck` liefert 0 Fehler.
- `bun run check` und `bun run check:css` liefern 0 Fehler.
- Git-Status ist sauber, keine verwaisten Artefakte.
