# Spec: Feature-Wide Code Simplification (`src/features/`)

## Surface Assumptions

> [!IMPORTANT]
> **ASSUMPTIONS & PRINCIPLES FOR THIS SPECIFICATION:**
> 1. **Zero Behavioral Impact:** Code simplification strictly preserves all functional behaviors, error handling, analytics events, and data flows. No user-facing feature behavior or API contract is altered.
> 2. **Native Platform Fallback:** React Native's Metro bundler natively resolves `foo.tsx` for Android when `foo.android.tsx` is absent. Removing 100% byte-identical `.android.*` files causes zero change in bundle output for Android.
> 3. **Strict 1:1 Byte-Identity Gate:** No `.android.*` file is removed without an automated `cmp -s` check returning exit code 0 against its base file. Files with functional or code divergence (e.g. `food-rule-selection-sheet.android.tsx`) are preserved.
> 4. **Pruning Only When Unused:** Only re-export files that have genuinely **0 callers** across the entire project (`settings/profile-hub-screen.tsx`, `inventory/api.ts`) are deleted. Files with active callers (`inventory/product-detail-modal.tsx`) remain untouched.
> 5. **No Cosmetic Churn:** Pure naming changes without code reduction (e.g. `domain-logik/` → `domain/`) are rejected to avoid unnecessary Git churn.
> 6. **No Database Schema Changes:** This initiative touches solely application client code under `src/features/`. Declarative schemas under `supabase/schemas/` remain untouched.

---

## Phase 0: Capability Map

This initiative encompasses 3 independently verifiable capability modules across `src/features/`.

```
dead-code-pruning ──→ platform-clone-elimination ──→ form-and-field-consolidation
```

| Module ID | Responsibility | Depends On | Files Touched (Est.) | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| `dead-code-pruning` | Remove 0-byte stub files, empty subdirectories (`workouts`, `low-carb`), and verified unreferenced files (`settings/profile-hub-screen.tsx`, `inventory/api.ts`). | None | 10 files (deletions) | Minimal |
| `platform-clone-elimination` | Delete 26 byte-for-byte identical `.android.*` mirror files verified via `cmp -s`; preserve diverging platform files. | None | 26 files (deletions) | Minimal |
| `form-and-field-consolidation` | Extract duplicated placement helpers and common input rows (package size, store picker, price, placement zone field) between `add-item-form.tsx` and `edit-item-form.tsx`. | `platform-clone-elimination` | 4 files | Medium |

**Execution Order:**
`dead-code-pruning` → `platform-clone-elimination` → `form-and-field-consolidation`

---

## 1. Objective

### What We Are Building / Simplifying
Over time, `src/features/` has grown to ~75,000 LOC across 598 files in 23 feature directories. Code reviews and audits revealed accumulated dead files, 26 redundant byte-identical Android clone files, and duplicated form logic in `shopping-list`.

The objective is to **systematically reduce code complexity, remove dead weight, and unify duplicated logic** while preserving **100% exact runtime behavior** on both iOS and Android.

### Who Is the User?
- **App End-Users:** Experience no functional regressions, identical UI performance, and zero disrupted flows.
- **Maintainers & Agents:** Gain a cleaner codebase with ~36 fewer duplicate/dead files, zero platform drift on identical screens, and a single source of truth for shopping item attribute fields.

### Success Definition
- All 0-byte stub files and verified unreferenced files are safely pruned.
- All 26 byte-identical `.android.*` files are eliminated after `cmp -s` verification.
- Common placement helpers and attribute fields in `shopping-list` forms are unified without breaking any existing test assertions.
- Typecheck (`bun run typecheck`), Biome linter (`bun run check`), and CSS checker (`bun run check:css`) pass cleanly.
- All existing unit tests in affected features pass with 0 modifications.

---

## 2. Tech Stack

- **Platform:** React Native 0.86, Expo SDK 57, React 19.2
- **Language / Runtime:** TypeScript 5.x, Bun runtime
- **Task Tracking:** Beads (`bd`) - Epic `fam-4ki`
- **Styling:** Design system tokens in `src/components/theme/`, semantic primitives in `src/constants/ui.tsx`
- **Linting & Formatting:** Biome (`bun run check`), Tailwind CLI CSS validation (`bun run check:css`)
- **Testing:** Jest (`bun run test --runInBand --runTestsByPath ...`), `@testing-library/react-native`

---

## 3. Commands

All commands are executed using `bun` from the project root in the active worktree:

```bash
# Typecheck
bun run typecheck

# Lint and formatting verification
bun run check

# CSS sanity check
bun run check:css

# Targeted unit tests (run ONLY affected tests per module)
bun run test --runInBand --runTestsByPath src/features/inventory/add-item-screen.test.tsx
bun run test --runInBand --runTestsByPath src/features/profile/profile-hub-screen.test.tsx
bun run test --runInBand --runTestsByPath src/features/household/members-screen.test.tsx
bun run test --runInBand --runTestsByPath src/features/shopping-list/screens/shopping-list-screen.test.tsx
bun run test --runInBand --runTestsByPath src/features/shopping-list/forms/add-item-form.test.tsx
bun run test --runInBand --runTestsByPath src/features/shopping-list/forms/edit-item-form.test.tsx

# Inspect git status and diff
git status --short
git diff --check
```

> [!CAUTION]
> NEVER run `bun test` (native engine fails) and NEVER run full unrestricted `bun run test` (too slow and resource-heavy). Always target specific test paths.

---

## 4. Project Structure

Target files and directories affected under `src/features/`:

```
src/features/
├── ads/                        → Unchanged (interstitial & banner platform files differ legitimately)
├── ai-agent-skills/            → Unchanged (standalone AI skill gateway)
├── app-shell/
│   └── app-providers.android.tsx [DELETE] (byte-identical to app-providers.tsx)
├── auth/                       → Unchanged
├── brochures/
│   ├── screens/brochures-overview-screen.android.tsx [DELETE] (byte-identical clone)
│   └── hooks/use-brochure-sync.android.ts [DELETE] (byte-identical clone)
├── calorie-tracking/
│   └── low-carb/               [DELETE] (empty folder with 0-byte types.ts)
├── dashboard/
│   ├── api.ts                  [DELETE] (0 bytes)
│   ├── types.ts                [DELETE] (0 bytes)
│   ├── dashboard-screen.android.tsx [DELETE] (byte-identical clone)
│   └── components/streak-dashboard-card.android.tsx [DELETE] (byte-identical clone)
├── experimentalscreens/        → Unchanged (lab screens)
├── household/
│   └── members-screen.android.tsx [DELETE] (byte-identical clone)
├── inventory/
│   ├── api.ts                  [DELETE] (0 callers; future public API tracked in #355)
│   ├── product-detail-modal.tsx [PRESERVE] (actively used by inventory-screen)
│   └── inventory-screen.android.tsx [PRESERVE] (differs legitimately)
├── navigation/
│   ├── api.ts                  [DELETE] (0 bytes)
│   ├── types.ts                [DELETE] (0 bytes)
│   ├── profile-sheet.android.tsx [DELETE] (byte-identical clone)
│   └── use-profile-initials.android.ts [DELETE] (byte-identical clone)
├── profile/
│   ├── sheets/
│   │   ├── biometrics-sheet.android.tsx [DELETE] (byte-identical clone)
│   │   ├── password-change-sheet.android.tsx [DELETE] (byte-identical clone)
│   │   ├── tracking-method-sheet.android.tsx [DELETE] (byte-identical clone)
│   │   └── food-rule-selection-sheet.android.tsx [PRESERVE] (differs: alert error handling)
│   ├── components/biometrics-summary.android.tsx [DELETE] (byte-identical clone)
│   ├── profile-hub-screen.android.tsx [DELETE] (byte-identical clone)
│   ├── avatar-uploader.android.ts [DELETE] (byte-identical clone)
│   ├── biometrics-api.android.ts [DELETE] (byte-identical clone)
│   ├── food-rules-api.android.ts [DELETE] (byte-identical clone)
│   └── domain/
│       ├── biometrics.android.ts [DELETE] (byte-identical clone)
│       └── food-rules.android.ts [DELETE] (byte-identical clone)
├── recipes/
│   └── screens/cooking-mode-screen.android.tsx [DELETE] (byte-identical clone)
├── settings/
│   ├── types.ts                [DELETE] (0 bytes)
│   ├── profile-hub-screen.tsx  [DELETE] (0 callers across codebase)
│   ├── settings-screen.android.tsx [DELETE] (byte-identical clone)
│   └── dev/
│       ├── drax-demo-screen.android.tsx [DELETE] (byte-identical clone)
│       └── design-system/
│           ├── design-system-screen.android.tsx [DELETE] (byte-identical clone)
│           ├── showcase-foundations.android.tsx [DELETE] (byte-identical clone)
│           ├── showcase-patterns.android.tsx [DELETE] (byte-identical clone)
│           └── showcase-shared.android.tsx [DELETE] (byte-identical clone)
├── shopping-list/
│   ├── domain-logik/           → Unchanged (no cosmetic rename)
│   ├── screens/shopping-list-screen.android.tsx [DELETE] (byte-identical clone)
│   └── forms/
│       ├── placement-form-helpers.ts [NEW] (extracted shared placement logic)
│       ├── shopping-item-attribute-fields.tsx [NEW] (extracted shared attribute fields)
│       ├── add-item-form.tsx   [MODIFY] (delegates shared attributes & placement helpers)
│       └── edit-item-form.tsx  [MODIFY] (delegates shared attributes & placement helpers)
├── tracking/                   → Unchanged
└── workouts/                   [DELETE] (empty folder with 0-byte types.ts)
```

---

## 5. Code Style & Conventions

### Pruning Rule: "Only When Unused"
```typescript
// RULE: ONLY delete re-exports or stubs that have verified ZERO callers in the project.
// If a file has active callers (e.g. product-detail-modal.tsx), do NOT delete it
// and do NOT rewrite callers just to eliminate a 4-line re-export.
```

### Platform Files (`.android.tsx` / `.ios.tsx`)
```typescript
// RULE: ONLY delete .android.* files when cmp -s proves 100% byte-identity to base file.
// If a file differs by even 1 byte (e.g. food-rule-selection-sheet.android.tsx), PRESERVE IT.
```

### Form & Field Consolidation Pattern (Phase 3)
```typescript
// Shared placement helpers:
// src/features/shopping-list/forms/placement-form-helpers.ts
export function preferenceScopeForSource(source: CategorySource | null, storeId: string | null): PreferenceScope | null;
export async function resolveAutomaticPreview(input: Parameters<typeof resolvePlacementForItem>[0], resetScope: PreferenceScope | null);

// Shared attribute fields:
// src/features/shopping-list/forms/shopping-item-attribute-fields.tsx
// Encapsulates package size + unit, price estimate, store picker, and PlacementZoneField.
// Keeps search dropdown, scanner, suggestions, and source filter exclusively in AddItemForm.
```

---

## 6. Testing Strategy

1. **Static Analysis Gates:**
   - Run `bun run typecheck` after every atomic deletion or extraction step.
   - Run `bun run check` to enforce Biome code quality and import organization.
2. **Behavioral Test Preservation:**
   - No existing test assertions may be deleted, weakened, or modified.
   - Run targeted Jest suites for each affected feature module.
3. **No Batch Unverified Commits:**
   - Each module in the Capability Map must be verified independently before proceeding to the next.

---

## 7. Boundaries

| Category | Rules |
| :--- | :--- |
| **Always** | - Run `cmp -s` before deleting any platform file.<br>- Verify with `bun run typecheck` and `bun run check` after each phase.<br>- Preserve all feature behavior, error handling, and telemetry events.<br>- Check git diff and status before and after each modification. |
| **Ask First** | - Touching any file with active callers outside the approved plan.<br>- Modifying features with unclear status (`ai-agent-skills`, `experimentalscreens`).<br>- Modifying any shared schema or database contract. |
| **Never** | - Delete a platform file that has any byte divergence from its base.<br>- Run `bun test` or full unbudgeted `bun run test`.<br>- Modify any `supabase/schemas/*.sql` or write manual migrations.<br>- Weaken or delete existing unit tests to make a refactor pass.<br>- Add new dependencies or change native build configuration. |

---

## 8. Success Criteria

- [ ] **SC-1:** All identified 0-byte files (`workouts/types.ts`, `settings/types.ts`, `calorie-tracking/low-carb/types.ts`, `navigation/types.ts`, `navigation/api.ts`, `dashboard/api.ts`, `dashboard/types.ts`, `premium/api.ts`) and unreferenced `inventory/api.ts` are deleted.
- [ ] **SC-2:** All 26 verified byte-identical `.android.*` files are deleted without causing any import or runtime failure on Android (`cmp -s` exit code 0).
- [ ] **SC-3:** `src/features/settings/profile-hub-screen.tsx` (0 callers) is pruned; `src/features/inventory/product-detail-modal.tsx` (active callers) is preserved.
- [ ] **SC-4:** Placement helpers and attribute fields in `shopping-list/forms/` are cleanly extracted and shared between `add-item-form.tsx` and `edit-item-form.tsx`.
- [ ] **SC-5:** `bun run typecheck` passes with 0 errors.
- [ ] **SC-6:** `bun run check` and `bun run check:css` pass with 0 errors.
- [ ] **SC-7:** Affected unit tests (`shopping-list-screen.test.tsx`, `profile-hub-screen.test.tsx`, `members-screen.test.tsx`, `add-item-form.test.tsx`, `edit-item-form.test.tsx`) pass with 0 modifications.

---

## 9. Decided Items & Tracking

1. **`src/features/inventory/api.ts`:** Deleted in Task 1.1 (0 callers). Long-term architecture ticket for feature public APIs tracked in [GitHub Issue #355](https://github.com/goldjunge91/fam/issues/355).
2. **`src/features/experimentalscreens/` & `src/features/ai-agent-skills/`:** Untouched in this initiative.
3. **`domain-logik/` directory rename:** Rejected as unnecessary cosmetic churn.
