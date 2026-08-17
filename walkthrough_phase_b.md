# Walkthrough: Phase B NativeWind & Design Token Migration (Gemini Domains)

Alle 28 Dateien aus den beiden zugewiesenen Domänen (`shopping-list/` & `recipes/`, ~8840 Zeilen) wurden vollständig auf NativeWind v4/v5 und semantische Theme-Klassen migriert.

---

## 1. Übersicht der migrierten Dateien

### Domäne 1: `src/features/shopping-list/` (14 von 14 Dateien — 100%)
1. [`components/total-estimate-card.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/total-estimate-card.tsx)
2. [`components/edit-item-modal.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/edit-item-modal.tsx)
3. [`components/add-item-modal.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/add-item-modal.tsx)
4. [`components/edit-item-form.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/edit-item-form.tsx)
5. [`components/shopping-item-row.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/shopping-item-row.tsx)
6. [`components/store-filter-bar.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/store-filter-bar.tsx)
7. [`components/shopping-product-suggestions.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/shopping-product-suggestions.tsx)
8. [`components/store-summary-card.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/store-summary-card.tsx)
9. [`components/category-order-sheet.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/category-order-sheet.tsx)
10. [`components/store-picker-field.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/store-picker-field.tsx)
11. [`stores-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/stores-screen.tsx)
12. [`shopping-list-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/shopping-list-screen.tsx)
13. [`complete-run-sheet.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/complete-run-sheet.tsx)
14. [`components/add-item-form.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/shopping-list/components/add-item-form.tsx)

### Domäne 2: `src/features/recipes/` (14 von 14 Dateien — 100%)
1. [`components/calorie-carousel.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/components/calorie-carousel.tsx)
2. [`components/category-carousel.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/components/category-carousel.tsx)
3. [`components/recipe-rating-sheet.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/components/recipe-rating-sheet.tsx)
4. [`components/recipe-filter-modal.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/components/recipe-filter-modal.tsx)
5. [`components/recipe-shopping-sheet.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/components/recipe-shopping-sheet.tsx)
6. [`components/recipe-preview-card.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/components/recipe-preview-card.tsx)
7. [`recipe-log-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/recipe-log-screen.tsx)
8. [`wizard/recipe-wizard-step-preview.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/wizard/recipe-wizard-step-preview.tsx)
9. [`wizard/recipe-wizard-step-steps.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/wizard/recipe-wizard-step-steps.tsx)
10. [`wizard/recipe-wizard-step-basics.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/wizard/recipe-wizard-step-basics.tsx)
11. [`cooking-mode-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/cooking-mode-screen.tsx)
12. [`recipes-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/recipes-screen.tsx)
13. [`recipe-create-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/recipe-create-screen.tsx)
14. [`recipe-detail-screen.tsx`](file:///Users/marco/Github.tmp/family_app/fam/src/features/recipes/recipe-detail-screen.tsx)

---

## 2. Änderungen & Architektur-Details

1. **Semantische Komponenten-Klassen in `src/global.css`**:
   - In `@layer components` mit `@apply` definiert:
     - `.calorie-carousel-content`, `.calorie-tile`
     - `.category-carousel-content`, `.category-tile`
     - `.recipe-preview-card`, `.recipe-hero-card`, `.card-copy-bottom`, `.recipe-preview-badge`
     - `.recipe-rating-card`, `.recipe-rating-sheet`, `.recipe-score-btn`, `.recipe-rating-input`
     - `.meal-tile`, `.tag-pill`, `.recipe-modal-footer`, `.recipe-shopping-sheet`
     - `.recipe-log-sheet`, `.grams-field`
     - `.shopping-item-row`, `.store-summary-card`, `.shopping-summary-card`, `.store-filter-bar`, `.store-filter-chip`
2. **Entfernung aller `StyleSheet.create`**:
   - Sämtliche `StyleSheet.create`-Aufrufe in den 28 Dateien wurden vollständig entfernt.
3. **ThemedText & Typography-Rollen**:
   - Alle statischen `<Text>`-Elemente wurden durch `<ThemedText>` mit semantischen `type`- und `themeColor`-Attributen (`body`, `bodyBold`, `caption`, `captionCompact`, `detail`, `label`, `headingSmall`, `title`, `subtitle`) ersetzt.
4. **Dokumentierte Ausnahmen gemäß Design-System-Regeln**:
   - Third-Party-Komponenten ohne `cssInterop` (z. B. `Image` aus `expo-image` oder SVG-Vektoren) sind mit expliziten Kommentaren versehen.
   - Dynamische Hex-Farben aus der Datenbank (z. B. Store-Farben) nutzen das vorgegebene Inline-Style-Pattern.

---

## 3. Verifikation

| Check | Befehl | Ergebnis |
| :--- | :--- | :--- |
| **Biome Linter & Formatter** | `bun run check` | **0 Warnings, 0 Errors** (381 Dateien geprüft) |
| **TypeScript Typecheck** | `bun run typecheck` | **0 Errors** (`tsc --noEmit` erfolgreich) |
| **Jest Test Suite** | `bun run test` | **80 von 80 Test-Suites bestanden** (628 von 628 Tests grün) |
| **Tailwind CSS Compilation** | `npx tailwindcss -i src/global.css -o /tmp/out.css -c tailwind.config.js` | **Erfolgreich kompiliert** (602ms) |
