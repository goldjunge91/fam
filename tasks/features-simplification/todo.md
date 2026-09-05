# Task List: Feature-Wide Code Simplification

Reference: [`tasks/features-simplification/plan.md`](file:///Users/marco/Github.tmp/family_app/fam/tasks/features-simplification/plan.md)  
Spec: [`docs/specs/features-simplification/SPEC.md`](file:///Users/marco/Github.tmp/family_app/fam/docs/specs/features-simplification/SPEC.md)

---

## Phase 1: Dead Code Pruning

### Task 1.1: Prune 0-byte Stub Files & Empty Subdirectories
**Description:** Remove all verified 0-byte placeholder files and empty feature folders that accumulate clutter and false signals in searches.

**Acceptance criteria:**
- [ ] Deleted `src/features/workouts/types.ts` and pruned `src/features/workouts/` directory
- [ ] Deleted `src/features/calorie-tracking/low-carb/types.ts` and pruned `src/features/calorie-tracking/low-carb/` directory
- [ ] Deleted 0-byte stub files:
  - `src/features/settings/types.ts`
  - `src/features/navigation/types.ts`
  - `src/features/navigation/api.ts`
  - `src/features/dashboard/api.ts`
  - `src/features/dashboard/types.ts`
  - `src/features/premium/api.ts`

**Verification:**
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Git status verifies only clean deletions: `git status --short`

**Dependencies:** None  
**Files likely touched:** 8 files (deletions)  
**Estimated scope:** Small

---

### Task 1.2: Prune Dead Passthrough Re-exports & Inline Call Sites
**Description:** Remove unnecessary 1-line re-export wrappers that add indirection without adding behavior or isolation.

**Acceptance criteria:**
- [ ] Confirmed zero callers of `src/features/settings/profile-hub-screen.tsx`, deleted file
- [ ] Inlined `ProductDetailModal` in `src/features/inventory/inventory-screen.tsx` and `inventory-screen.android.tsx` to use `@/components/ui/product-information` directly
- [ ] Deleted `src/features/inventory/product-detail-modal.tsx`

**Verification:**
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Biome check passes: `bun run check`
- [ ] Inventory screen tests pass: `bun run test --runInBand --runTestsByPath src/features/inventory/add-item-screen.test.tsx`

**Dependencies:** Task 1.1  
**Files likely touched:** 3 files (`inventory-screen.tsx`, `inventory-screen.android.tsx`, `product-detail-modal.tsx`, `profile-hub-screen.tsx`)  
**Estimated scope:** Small

---

## Checkpoint 1: Dead Code Clean
- [ ] All 0-byte stubs and unreferenced re-exports removed
- [ ] `bun run typecheck` clean
- [ ] `bun run check` clean

---

## Phase 2: Platform Clone Elimination (27 Byte-Identical Files)

### Task 2.1: Prune Profile Platform Duplicates (Sheets & Summary Components)
**Description:** Delete byte-identical `.android.*` files in `src/features/profile/sheets/` and `src/features/profile/components/`.

**Acceptance criteria:**
- [ ] Deleted `src/features/profile/sheets/tracking-method-sheet.android.tsx`
- [ ] Deleted `src/features/profile/sheets/biometrics-sheet.android.tsx`
- [ ] Deleted `src/features/profile/sheets/food-rule-selection-sheet.android.tsx`
- [ ] Deleted `src/features/profile/sheets/password-change-sheet.android.tsx`
- [ ] Deleted `src/features/profile/components/biometrics-summary.android.tsx`

**Verification:**
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Biome check passes: `bun run check`

**Dependencies:** Checkpoint 1  
**Files likely touched:** 5 files (deletions)  
**Estimated scope:** Medium

---

### Task 2.2: Prune Profile Platform Duplicates (APIs, Domain & Screens)
**Description:** Delete byte-identical `.android.*` files in `src/features/profile/` root, `domain/`, and API modules.

**Acceptance criteria:**
- [ ] Deleted `src/features/profile/avatar-uploader.android.ts`
- [ ] Deleted `src/features/profile/biometrics-api.android.ts`
- [ ] Deleted `src/features/profile/food-rules-api.android.ts`
- [ ] Deleted `src/features/profile/domain/biometrics.android.ts`
- [ ] Deleted `src/features/profile/domain/food-rules.android.ts`
- [ ] Deleted `src/features/profile/profile-hub-screen.android.tsx`

**Verification:**
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Profile tests pass: `bun run test --runInBand --runTestsByPath src/features/profile/profile-hub-screen.test.tsx src/features/profile/food-rules-api.test.ts src/features/profile/biometrics-api.test.ts`

**Dependencies:** Task 2.1  
**Files likely touched:** 6 files (deletions)  
**Estimated scope:** Medium

---

### Task 2.3: Prune Settings, Dashboard & Household Platform Duplicates
**Description:** Delete byte-identical `.android.*` files across `settings`, `household`, `dashboard`, `recipes`, and `app-shell`.

**Acceptance criteria:**
- [ ] Deleted `src/features/settings/settings-screen.android.tsx`
- [ ] Deleted `src/features/household/members-screen.android.tsx`
- [ ] Deleted `src/features/dashboard/components/streak-dashboard-card.android.tsx`
- [ ] Deleted `src/features/recipes/screens/cooking-mode-screen.android.tsx`
- [ ] Deleted `src/features/app-shell/app-providers.android.tsx`

**Verification:**
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Affected tests pass: `bun run test --runInBand --runTestsByPath src/features/household/members-screen.test.tsx src/features/settings/settings-screen.test.tsx`

**Dependencies:** Task 2.2  
**Files likely touched:** 5 files (deletions)  
**Estimated scope:** Medium

---

### Task 2.4: Prune Navigation, Brochures, Shopping & Showcase Platform Duplicates
**Description:** Delete the remaining byte-identical `.android.*` files in navigation, brochures, shopping-list screen, and settings dev showcase.

**Acceptance criteria:**
- [ ] Deleted `src/features/navigation/profile-sheet.android.tsx`
- [ ] Deleted `src/features/navigation/use-profile-initials.android.ts`
- [ ] Deleted `src/features/brochures/screens/brochures-overview-screen.android.tsx`
- [ ] Deleted `src/features/brochures/hooks/use-brochure-sync.android.ts`
- [ ] Deleted `src/features/shopping-list/screens/shopping-list-screen.android.tsx`
- [ ] Deleted showcase duplicates:
  - `src/features/settings/dev/drax-demo-screen.android.tsx`
  - `src/features/settings/dev/design-system/showcase-patterns.android.tsx`
  - `src/features/settings/dev/design-system/design-system-screen.android.tsx`
  - `src/features/settings/dev/design-system/showcase-foundations.android.tsx`
  - `src/features/settings/dev/design-system/showcase-shared.android.tsx`

**Verification:**
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Biome check passes: `bun run check`
- [ ] Shopping list tests pass: `bun run test --runInBand --runTestsByPath src/features/shopping-list/screens/shopping-list-screen.test.tsx`

**Dependencies:** Task 2.3  
**Files likely touched:** 10 files (deletions)  
**Estimated scope:** Medium

---

## Checkpoint 2: Platform Mirroring Cleaned
- [ ] All 27 verified byte-identical `.android.*` files deleted
- [ ] `bun run typecheck` and `bun run check` clean
- [ ] Metro resolver falls back cleanly to `.tsx` for Android

---

## Phase 3: Structural Normalization

### Task 3.1: Rename `shopping-list/domain-logik/` to `domain/`
**Description:** Align naming in `src/features/shopping-list/` to follow the standardized `domain/` directory convention used by other modules (`recipes/domain`, `profile/domain`, `glp1/domain`, `auth/domain`).

**Acceptance criteria:**
- [ ] Directory moved from `src/features/shopping-list/domain-logik/` to `src/features/shopping-list/domain/`
- [ ] All imports pointing to `domain-logik` updated to `domain`
- [ ] Zero lingering references to `domain-logik` in the codebase

**Verification:**
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Biome check passes: `bun run check`
- [ ] Category tests pass: `bun run test --runInBand --runTestsByPath src/features/shopping-list/domain/shopping-categories.test.ts src/features/shopping-list/domain/product-store-preference.test.ts`

**Dependencies:** Checkpoint 2  
**Files likely touched:** ~8 files (moved files + import call sites)  
**Estimated scope:** Medium

---

### Task 3.2: Reconcile Tracking Boundary
**Description:** Review `src/features/tracking/domain/day-boundary.ts` (38 LOC) and ensure consumers (`calorie-tracking`, `glp1`) have unambiguous import contracts.

**Acceptance criteria:**
- [ ] Documented tracking feature scope and confirmed day-boundary exports are clean
- [ ] Verified no circular dependencies or broken contracts

**Verification:**
- [ ] Typecheck passes: `bun run typecheck`

**Dependencies:** Task 3.1  
**Files likely touched:** 1-2 files  
**Estimated scope:** XS

---

## Checkpoint 3: Structural Consistency
- [ ] All feature domain directories named consistently (`domain/`)
- [ ] Zero broken imports
- [ ] `bun run typecheck` and `bun run check` clean

---

## Phase 4: Form & Search Consolidation

### Task 4.1: Consolidate `shopping-list` Item Form Fields
**Description:** Unify duplicated field rendering and form state between `src/features/shopping-list/forms/add-item-form.tsx` (773 LOC) and `src/features/shopping-list/forms/edit-item-form.tsx` (520 LOC).

**Acceptance criteria:**
- [ ] Common form fields (store picker, category, quantity, unit, notes) extracted into composable form component
- [ ] Exact validation, accessibility labels, and analytics events preserved
- [ ] `add-item-form.tsx` and `edit-item-form.tsx` delegate to the shared core

**Verification:**
- [ ] Targeted form tests pass: `bun run test --runInBand --runTestsByPath src/features/shopping-list/forms/add-item-form.test.tsx src/features/shopping-list/forms/edit-item-form.test.tsx`
- [ ] Typecheck passes: `bun run typecheck`
- [ ] Biome check passes: `bun run check`

**Dependencies:** Checkpoint 3  
**Files likely touched:** 3 files  
**Estimated scope:** Medium

---

## Checkpoint 4: Full Initiative Completion
- [ ] All phases (1-4) completed and verified
- [ ] `bun run typecheck` clean
- [ ] `bun run check` clean
- [ ] `bun run check:css` clean
- [ ] Git diff review confirms net reduction of ~4,800 lines of dead/duplicated code
