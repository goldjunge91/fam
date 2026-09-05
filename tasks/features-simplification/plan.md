# Implementation Plan: Feature-Wide Code Simplification (`src/features/`)

## Overview

Systematic, zero-behavioral-impact simplification across all 23 feature modules in `src/features/`.
This initiative prunes dead 0-byte files, eliminates 27 byte-identical Android clone files, normalizes directory nomenclature (`domain-logik` → `domain`), and consolidates duplicated form logic in `shopping-list`.

Reference: [`docs/specs/features-simplification/SPEC.md`](file:///Users/marco/Github.tmp/family_app/fam/docs/specs/features-simplification/SPEC.md)

## Architecture Decisions

1. **Native Platform Fallback over Duplication:**
   React Native's Metro bundler natively resolves `foo.tsx` for Android if `foo.android.tsx` is absent. Deleting 27 files that are 100% byte-for-byte identical to their base files removes ~4,500 lines of duplicated code without altering runtime execution.
2. **Strict Chesterton's Fence:**
   The 15 `.android.*` files that legitimately differ (e.g. ad banners, back handlers) are preserved.
3. **Canonical Import Paths over Unused Wrappers:**
   Unused re-export layers (`settings/profile-hub-screen.tsx`, `inventory/product-detail-modal.tsx`) are removed, and callers import the canonical design system component directly.
4. **Normalized Domain Naming:**
   German/English directory mix (`domain-logik`) is aligned to `domain` across all feature modules.

---

## Dependency Graph & Implementation Order

```
[Module 1: Dead Code Pruning]
       │
       ▼
[Module 2: Platform Clone Elimination]
       │
       ▼
[Module 3: Structural Normalization]
       │
       ▼
[Module 4: Form Consolidation]
```

---

## Task List & Checkpoints

Detailed task tracking and acceptance criteria are maintained in:
👉 [`tasks/features-simplification/todo.md`](file:///Users/marco/Github.tmp/family_app/fam/tasks/features-simplification/todo.md)

### Phase 1: Dead Code Pruning
- [ ] Task 1.1: Prune 0-byte Stub Files & Empty Subdirectories
- [ ] Task 1.2: Prune Dead Passthrough Re-exports & Inline Call Sites
- **Checkpoint 1: Dead Code Clean**

### Phase 2: Platform Clone Elimination
- [ ] Task 2.1: Prune Profile Platform Duplicates (Sheets & Summary Components)
- [ ] Task 2.2: Prune Profile Platform Duplicates (APIs, Domain & Screens)
- [ ] Task 2.3: Prune Settings, Dashboard & Household Platform Duplicates
- [ ] Task 2.4: Prune Navigation, Brochures, Shopping & Showcase Platform Duplicates
- **Checkpoint 2: Platform Mirroring Cleaned**

### Phase 3: Structural Normalization
- [ ] Task 3.1: Rename `shopping-list/domain-logik/` to `domain/` and Update Imports
- [ ] Task 3.2: Reconcile Tracking Boundary Documentation
- **Checkpoint 3: Structural Consistency**

### Phase 4: Form & Search Consolidation
- [ ] Task 4.1: Consolidate `shopping-list` Item Form Fields (`add-item-form` & `edit-item-form`)
- **Checkpoint 4: Full Initiative Completion**

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Metro bundler missing a platform file | High | Tested: React Native automatically falls back to `.tsx`/`.ts` when `.android.*` is missing. Confirmed byte-identity via `diff -q`. |
| Broken import after directory rename | High | TypeScript typecheck (`bun run typecheck`) and Biome (`bun run check`) run immediately after renaming. |
| Form regression in shopping-list | High | Existing test suite (`add-item-form.test.tsx` and `edit-item-form.test.tsx`) covers validation and submission; must pass with 0 modifications. |
