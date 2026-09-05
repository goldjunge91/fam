# Spec: Feature-Wide Code Simplification (`src/features/`)

## Surface Assumptions

> [!IMPORTANT]
> **ASSUMPTIONS MADE FOR THIS SPECIFICATION:**
> 1. **Zero Behavioral Impact:** Code simplification strictly preserves all functional behaviors, error handling, analytics events, and data flows. No user-facing feature behavior or API contract is broken or altered.
> 2. **Native Platform Fallback:** React Native's Metro bundler natively resolves `foo.tsx` for Android when `foo.android.tsx` is absent. Removing 100% byte-identical `.android.*` files causes zero change in bundle output for Android.
> 3. **Design System Authority:** The design system contracts (`src/constants/ui.tsx`, `src/components/theme/`) remain the single source of truth for all UI components. Simplification does not introduce new UI tokens, styling bridges, or parallel styling mechanisms.
> 4. **No Database Schema Changes:** This initiative touches solely application client code under `src/features/`. No changes to declarative schemas under `supabase/schemas/` are required.
> 5. **Sub-module Independence:** Simplification work can and should be executed in isolated, verifiable modules (Capability Map) rather than one monolithic refactor.
> → *Correct any assumption if needed.*

---

## Phase 0: Capability Map

This initiative encompasses multiple independently verifiable capabilities across `src/features/`.

```
dead-code-pruning ──→ platform-clone-elimination ──→ structural-normalization ──→ form-and-search-consolidation
```

| Module ID | Responsibility | Depends On | Files Touched (Est.) | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| `dead-code-pruning` | Remove 0-byte files, empty subdirectories (`workouts`, `low-carb`), and unreferenced passthrough re-exports (`settings/profile-hub-screen.tsx`, `inventory/product-detail-modal.tsx`). | None | ~10 files | Minimal |
| `platform-clone-elimination` | Delete 27 byte-for-byte identical `.android.*` mirror files; preserve and document the 15 genuinely diverging platform files. | None | 27 files (deletions) | Minimal |
| `structural-normalization` | Standardize inconsistent directory naming (e.g. `src/features/shopping-list/domain-logik/` → `domain/`) and evaluate single-file feature `src/features/tracking/`. | `dead-code-pruning` | ~8 files | Low |
| `form-and-search-consolidation` | Unify heavy duplicated forms (`add-item-form.tsx` 773 LOC & `edit-item-form.tsx` 520 LOC in `shopping-list`) and consolidate search dropdown logic where patterns duplicate. | `structural-normalization` | ~6 files | Medium |

**Execution Order:**
`dead-code-pruning` → `platform-clone-elimination` → `structural-normalization` → `form-and-search-consolidation`

---

## 1. Objective

### What We Are Building / Simplifying
Over time, `src/features/` has grown to ~75,000 LOC across 598 files in 23 feature directories. Code reviews and audits revealed accumulated dead files, 27 redundant byte-identical Android clone files, naming anomalies (`domain-logik`), and duplicated forms with high maintenance drag.

The objective is to **systematically reduce code complexity, remove dead weight, and unify duplicated logic** while preserving **100% exact runtime behavior** on both iOS and Android.

### Who Is the User?
- **App End-Users:** Experience no functional regressions, identical UI performance, and zero disrupted flows.
- **Maintainers & Agents:** Gain a cleaner codebase with ~35 fewer duplicate/dead files, zero platform drift on identical screens, and clearer component contracts.

### Success Definition
- All 0-byte files and verified dead re-exports are safely pruned.
- All 27 byte-identical `.android.*` files are eliminated without any build, test, or runtime regressions.
- Directory nomenclature is unified across features (`domain` instead of `domain-logik`).
- Typecheck (`bun run typecheck`), Biome linter (`bun run check`), and CSS checker (`bun run check:css`) are completely green.
- All existing tests in affected features pass without modifications.

---

## 2. Tech Stack

- **Platform:** React Native 0.86, Expo SDK 57, React 19.2
- **Language / Runtime:** TypeScript 5.x, Bun runtime
- **Styling:** Design system tokens in `src/components/theme/`, semantic primitives in `src/constants/ui.tsx`
- **Linting & Formatting:** Biome (`bun run check`), Tailwind CLI CSS validation (`bun run check:css`)
- **Testing:** Jest (`bun run test --runInBand --runTestsByPath ...`), `@testing-library/react-native`

---

## 3. Commands

All commands are executed using `bun` from the project root:

```bash
# Typecheck
bun run typecheck

# Lint and formatting verification
bun run check

# CSS sanity check
bun run check:css

# Targeted unit tests (run ONLY affected tests per module)
bun run test --runInBand --runTestsByPath src/features/inventory/add-item-screen.test.tsx
bun run test --runInBand --runTestsByPath src/features/shopping-list/forms/add-item-form.test.tsx
bun run test --runInBand --runTestsByPath src/features/shopping-list/screens/shopping-list-screen.test.tsx
bun run test --runInBand --runTestsByPath src/features/profile/profile-hub-screen.test.tsx

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
├── ai-agent-skills/            → Retained as-is (standalone AI skill gateway)
├── app-shell/
│   └── app-providers.android.tsx [DELETE] (identical to app-providers.tsx)
├── auth/                       → Unchanged
├── brochures/
│   ├── screens/brochures-overview-screen.android.tsx [DELETE] (identical clone)
│   └── hooks/use-brochure-sync.android.ts [DELETE] (identical clone)
├── calorie-tracking/
│   └── low-carb/               [DELETE] (empty folder with 0-byte types.ts)
├── dashboard/
│   ├── api.ts                  [DELETE] (0 bytes)
│   ├── types.ts                [DELETE] (0 bytes)
│   └── components/streak-dashboard-card.android.tsx [DELETE] (identical clone)
├── household/
│   └── members-screen.android.tsx [DELETE] (identical clone)
├── inventory/
│   ├── api.ts                  [DELETE or PRESERVE depending on public API contract]
│   ├── product-detail-modal.tsx [DELETE] (inlined to direct import)
│   └── inventory-screen.tsx    [MODIFY] (use ProductInformation from ui directly)
├── navigation/
│   ├── api.ts                  [DELETE] (0 bytes)
│   ├── types.ts                [DELETE] (0 bytes)
│   ├── profile-sheet.android.tsx [DELETE] (identical clone)
│   └── use-profile-initials.android.ts [DELETE] (identical clone)
├── profile/
│   ├── sheets/*.android.tsx    [DELETE] (4 sheets identical to .tsx)
│   ├── domain/*.android.ts     [DELETE] (2 files identical to .ts)
│   ├── components/biometrics-summary.android.tsx [DELETE] (identical clone)
│   ├── profile-hub-screen.android.tsx [DELETE] (identical clone)
│   ├── avatar-uploader.android.ts [DELETE] (identical clone)
│   ├── biometrics-api.android.ts [DELETE] (identical clone)
│   └── food-rules-api.android.ts [DELETE] (identical clone)
├── recipes/
│   └── screens/cooking-mode-screen.android.tsx [DELETE] (identical clone)
├── settings/
│   ├── types.ts                [DELETE] (0 bytes)
│   ├── profile-hub-screen.tsx  [DELETE] (unreferenced re-export)
│   ├── settings-screen.android.tsx [DELETE] (identical clone)
│   └── dev/design-system/*.android.tsx [DELETE] (4 identical showcase clones)
├── shopping-list/
│   ├── domain-logik/           [RENAME] → domain/
│   ├── screens/shopping-list-screen.android.tsx [DELETE] (identical clone)
│   └── forms/                  [CONSOLIDATE in Phase 4]
├── tracking/                   → Evaluate folding into core domain utilities
└── workouts/                   [DELETE] (empty folder with 0-byte types.ts)
```

---

## 5. Code Style & Conventions

### Import Directness vs. Pointless Re-exports
```typescript
// BAD: Indirection through redundant 1-line wrapper files
import { ProductDetailModal } from '@/features/inventory/product-detail-modal';

// GOOD: Direct import from canonical design system component
import { ProductInformation as ProductDetailModal } from '@/components/ui/product-information';
```

### Platform Files (`.android.tsx` / `.ios.tsx`)
```typescript
// RULE: ONLY maintain a .android.tsx file if it contains legitimate platform-specific code
// (e.g. Android BackHandler, native TurboModule boundaries, platform elevation hacks).
// If the code is identical to .tsx, delete .android.tsx. Metro bundler resolves .tsx automatically.
```

### Form Composition Pattern (Phase 4)
```typescript
// GOOD: Unified form core with variant props
interface ShoppingItemFormProps {
  mode: 'add' | 'edit';
  initialValues?: Partial<ShoppingItemInput>;
  onSubmit: (values: ShoppingItemInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ShoppingItemForm({ mode, initialValues, onSubmit, onCancel, isSubmitting }: ShoppingItemFormProps) {
  // Shared state, validation schema, and UI layout
}
```

---

## 6. Testing Strategy

1. **Static Analysis Gates:**
   - Run `bun run typecheck` after every atomic deletion or renaming step to prove no missing export or broken path.
   - Run `bun run check` to enforce Biome code quality and import organization.
2. **Behavioral Test Preservation:**
   - No existing test assertions may be deleted or weakened.
   - Run targeted Jest suites for each affected feature module.
3. **No Batch Unverified Commits:**
   - Each module in the Capability Map must be verified independently before proceeding to the next.

---

## 7. Boundaries

| Category | Rules |
| :--- | :--- |
| **Always** | - Surface any assumptions or surprises immediately.<br>- Verify with `bun run typecheck` and `bun run check` after every change.<br>- Preserve all feature behavior, error handling, and telemetry events.<br>- Check git diff and status before and after each modification. |
| **Ask First** | - Inlining or consolidating components that touch more than 5 files.<br>- Pruning features with unclear status (`ai-agent-skills`, `experimentalscreens`).<br>- Modifying any shared schema or database contract. |
| **Never** | - Run `bun test` or full unbudgeted `bun run test`.<br>- Modify any `supabase/schemas/*.sql` or write manual migrations.<br>- Weaken or delete existing unit tests to make a refactor pass.<br>- Add new dependencies or change native build configuration. |

---

## 8. Success Criteria

- [ ] **SC-1:** All identified 0-byte files (`workouts/types.ts`, `settings/types.ts`, `calorie-tracking/low-carb/types.ts`, `navigation/types.ts`, `navigation/api.ts`, `dashboard/api.ts`, `dashboard/types.ts`, `premium/api.ts`) are deleted.
- [ ] **SC-2:** All 27 verified byte-identical `.android.*` files are deleted without causing any import or runtime failure on Android.
- [ ] **SC-3:** `src/features/inventory/product-detail-modal.tsx` and `src/features/settings/profile-hub-screen.tsx` are pruned and call sites use canonical imports.
- [ ] **SC-4:** `src/features/shopping-list/domain-logik/` is cleanly renamed to `domain/` and all imports across the app are updated.
- [ ] **SC-5:** `bun run typecheck` passes with 0 errors.
- [ ] **SC-6:** `bun run check` and `bun run check:css` pass with 0 errors.
- [ ] **SC-7:** Affected unit tests (`inventory-screen.test.tsx`, `shopping-list-screen.test.tsx`, `profile-hub-screen.test.tsx`) pass.

---

## 9. Open Questions for Human Review

1. **`src/features/inventory/api.ts`:**
   Contains `export { useInventoryItems } from '@/features/inventory/use-inventory-items';`. Do we keep this as the designated public API barrel for inventory, or should consumers import `use-inventory-items` directly?
2. **`src/features/experimentalscreens/`:**
   Contains camera lab screens behind `VISION_CAMERA_LAB_ENABLED = false`. Should this remain untouched in this initiative?
3. **`src/features/ai-agent-skills/`:**
   Confirmed that this module has 0 app-level runtime callers. Should it remain untouched as a standalone backend/skill integration, or be earmarked for future consolidation?
