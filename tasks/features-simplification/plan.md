# Implementation Plan: Feature-Wide Code Simplification (`src/features/`)

## 1. Overview

Systematische, verhaltensneutrale Code-Vereinfachung über alle 23 Feature-Module in `src/features/`.
Diese Initiative fokussiert sich ausschließlich auf echte Einsparungen:
- Beseitigung toter 0-Byte-Stubs und nachweislich ungenutzter Dateien (0 Aufrufer im gesamten Projekt).
- Löschen von 26 verifizierten, zu 100% byte-identischen Android-Klonen (`.android.*`).
- Konsolidierung von ~250–300 Zeilen redundanter Platzierungs-, Hilfs- und Formularlogik zwischen `add-item-form.tsx` und `edit-item-form.tsx` in `shopping-list`.

Referenz-Spezifikation: [`docs/specs/features-simplification/SPEC.md`](file:///Users/marco/Github.tmp/family_app/fam/docs/specs/features-simplification/SPEC.md)

---

## 2. Architecture Decisions & Leitplanken

1. **Nativer Plattform-Fallback & Strikte 1:1 Byte-Identität:**
   React Natives Metro-Bundler fällt automatisch auf `.tsx`/`.ts` zurück, wenn `.android.*` nicht existiert.
   *Jede* einzelne `.android.*`-Datei wird unmittelbar vor dem Löschen mit `cmp -s <file.android.ext> <file.ext>` geprüft. Nur wenn Exit-Code 0 ist (100% identischer Byte-Inhalt), wird gelöscht.
2. **Chesterton's Fence Prinzip:**
   Plattformdateien mit funktionalen Abweichungen (z. B. `food-rule-selection-sheet.android.tsx`, `ad-banner.android.tsx`, `navigation-drawer.android.tsx`, `inventory-screen.android.tsx`) bleiben unangetastet.
3. **Pruning STRENG nur wenn unbenutzt:**
   Es werden ausschließlich Dateien gelöscht, die nachweislich **0 Aufrufer** im gesamten Projekt haben (`settings/profile-hub-screen.tsx`, `inventory/api.ts`). Dateien mit aktiven Aufrufern (wie `inventory/product-detail-modal.tsx`) werden **nicht** angerührt, um unnötige Änderungen an Aufrufern zu vermeiden.
4. **Keine kosmetischen Umbenennungen:**
   Verzeichnisstrukturen wie `domain-logik/` bleiben unverändert, da ein Rename keinen Code vereinfacht, sondern nur Git-Churn erzeugt.

---

## 3. Dependency Graph & Phasen

```
[Phase 0: Environment Setup (node_modules im Worktree)]
       │
       ▼
[Phase 1: Dead Code Pruning (0-Byte Stubs & unbenutzte Dateien)]
       │
       ▼
[Phase 2: Platform Clone Elimination (Streng nur 1:1 identisch via cmp -s)]
       │
       ▼
[Phase 3: Form & Field Consolidation (add-item-form & edit-item-form)]
```

---

## 4. Detaillierter Task-Plan

Durable Task Tracking erfolgt in **Beads** (`fam-4ki`).

### Phase 0: Environment Setup
* **Task 0.1: Worktree node_modules bereitstellen & Baseline verifizieren**
  * Verlinkung von `node_modules` im Worktree.
  * Baseline-Prüfung via `bun run typecheck` und `bun run check`.

---

### Phase 1: Dead Code Pruning (Nur 0-Byte & unbenutzte Dateien)

* **Task 1.1: 0-Byte-Dateileichen entfernen (9 Dateien)**
  * Löschen von verifizierten 0-Byte-Stubs:
    - `src/features/workouts/types.ts` (und leerer Ordner `src/features/workouts/`)
    - `src/features/calorie-tracking/low-carb/types.ts` (und leerer Ordner `src/features/calorie-tracking/low-carb/`)
    - `src/features/settings/types.ts`
    - `src/features/navigation/types.ts`
    - `src/features/navigation/api.ts`
    - `src/features/dashboard/api.ts`
    - `src/features/dashboard/types.ts`
    - `src/features/premium/api.ts`
    - `src/features/inventory/api.ts` (0 Aufrufer, künftige Public APIs in Issue #355)
  * *Verifikation:* `bun run typecheck` sauber.

* **Task 1.2: Ungenutzte Passthrough-Datei entfernen (1 Datei)**
  * Löschen von `src/features/settings/profile-hub-screen.tsx` (0 Aufrufer im Projekt).
  * *Hinweis:* `inventory/product-detail-modal.tsx` bleibt erhalten, da es aktiv in `inventory-screen` genutzt wird ("nur wenn unbenutzt").
  * *Verifikation:* `bun run typecheck` & `bun run check` sauber.

**Checkpoint 1: Dead Code Clean**

---

### Phase 2: Platform Clone Elimination (26 verifizierte 1:1 Klone)

> [!IMPORTANT]
> Jede Datei wird vor dem Löschen mit `cmp -s <android-file> <base-file>` geprüft. Nur bei 100% Identität wird `git rm` ausgeführt.

* **Task 2.1: Profile Sheets & Summary Klone entfernen (4 Dateien)**
  * `src/features/profile/sheets/tracking-method-sheet.android.tsx`
  * `src/features/profile/sheets/biometrics-sheet.android.tsx`
  * `src/features/profile/sheets/password-change-sheet.android.tsx`
  * `src/features/profile/components/biometrics-summary.android.tsx`
  * *(Hinweis: `food-rule-selection-sheet.android.tsx` unterscheidet sich und bleibt erhalten!)*

* **Task 2.2: Profile APIs, Domain & Screens Klone entfernen (6 Dateien)**
  * `src/features/profile/avatar-uploader.android.ts`
  * `src/features/profile/food-rules-api.android.ts`
  * `src/features/profile/biometrics-api.android.ts`
  * `src/features/profile/domain/food-rules.android.ts`
  * `src/features/profile/domain/biometrics.android.ts`
  * `src/features/profile/profile-hub-screen.android.tsx`

* **Task 2.3: Settings, Dashboard, Household, Recipes & App-Shell Klone entfernen (6 Dateien)**
  * `src/features/settings/settings-screen.android.tsx`
  * `src/features/household/members-screen.android.tsx`
  * `src/features/dashboard/components/streak-dashboard-card.android.tsx`
  * `src/features/dashboard/dashboard-screen.android.tsx`
  * `src/features/recipes/screens/cooking-mode-screen.android.tsx`
  * `src/features/app-shell/app-providers.android.tsx`

* **Task 2.4: Navigation, Brochures, Shopping & Dev-Showcase Klone entfernen (10 Dateien)**
  * `src/features/navigation/profile-sheet.android.tsx`
  * `src/features/navigation/use-profile-initials.android.ts`
  * `src/features/brochures/screens/brochures-overview-screen.android.tsx`
  * `src/features/brochures/hooks/use-brochure-sync.android.ts`
  * `src/features/shopping-list/screens/shopping-list-screen.android.tsx`
  * `src/features/settings/dev/drax-demo-screen.android.tsx`
  * `src/features/settings/dev/design-system/showcase-patterns.android.tsx`
  * `src/features/settings/dev/design-system/design-system-screen.android.tsx`
  * `src/features/settings/dev/design-system/showcase-foundations.android.tsx`
  * `src/features/settings/dev/design-system/showcase-shared.android.tsx`

**Checkpoint 2: Platform Mirroring Cleaned**
* `bun run typecheck` & `bun run check`
* Fokussierte Tests: `members-screen.test.tsx`, `shopping-list-screen.test.tsx`, `profile-hub-screen.test.tsx`.

---

### Phase 3: Form & Field Consolidation (`add-item-form` & `edit-item-form`)

* **Task 3.1: Gemeinsame Platzierungs- & Attribut-Felder extrahieren**
  
  **Was ist das Problem?**
  `add-item-form.tsx` (776 Zeilen) und `edit-item-form.tsx` (521 Zeilen) duplizieren aktuell ~250–300 Zeilen nahezu identische Hilfsfunktionen, Zustandslogik und UI-Felder:
  1. *Platzierungs- & Präferenz-Helfer:*
     - `preferenceScopeForSource()`
     - `resolveAutomaticPreview()`
     - Alpha-Trace-Logging (`logCategoryFeedbackAlphaTrace()`)
  2. *Gemeinsame Formularfelder (UI & State-Handler):*
     - **Packungsgröße:** Eingabefeld `packageSizeInput` + Einheiten-Auswahl (`g`, `ml`, `Stk`) mit `formatPackageHint()` und `formatAmount()`.
     - **Geschäft / Store-Picker:** Auswahl des Ladens (`storeId`) inkl. Rücksetzen/Aktualisieren der store-spezifischen Kategoriepräferenz.
     - **Preisschätzung:** Optionales Textfeld für geschätzten Preis.
     - **Kategorie-Zone:** Einbindung von `PlacementZoneField` (`placementSelection`, `pendingPreferenceResetScope`, automatischer vs. manueller Modus).

  **Was genau macht der Task?**
  1. Extraktion der reinen Logik-Helfer (`preferenceScopeForSource`, `resolveAutomaticPreview`) in ein schlankes Modul `src/features/shopping-list/forms/placement-form-helpers.ts`.
  2. Extraktion der zusammenhängenden Attribut-Felder (Packungsgröße, Preis, Laden, Kategorie) in eine gemeinsame Teilkomponente `src/features/shopping-list/forms/shopping-item-attribute-fields.tsx`.
  3. **Was bleibt eigenständig im jeweiligen Formular?**
     - In `add-item-form.tsx`: Die Produktsuche (`ProductSearchDropdown`), der Barcode-Scanner (`BarcodeScannerModal`), die Schnellvorschläge (`ShoppingProductSuggestions`) und der Quellfilter (`ItemSourceFilterRow`).
     - In `edit-item-form.tsx`: Das Laden und Vorbelegen der bestehenden Artikelwerte (`LocalShoppingItem`) sowie die Update-Mutation.
  
  **Verifikation:**
  - Die bestehenden Formular-Tests laufen ohne Änderungen durch:
    - `bun run test --runInBand --runTestsByPath src/features/shopping-list/forms/add-item-form.test.tsx`
    - `bun run test --runInBand --runTestsByPath src/features/shopping-list/forms/edit-item-form.test.tsx`
  - `bun run typecheck` & `bun run check`.

**Checkpoint 3: Abschluss der Vereinfachung**
* `bun run typecheck` & `bun run check` & `bun run check:css` komplett grün.
* Git-Diff Prüfung auf saubere Reduktion redundanter Zeilen.

---

## 5. Risiken & Absicherung

| Risiko | Auswirkung | Gegenmaßnahme |
| :--- | :--- | :--- |
| Android-Plattformunterschied geht verloren | Hoch | Strikter `cmp -s` Check vor jedem Löschen; bei auch nur 1 Byte Unterschied bleibt die Datei erhalten. |
| Ungewollter Refactoring-Bruch in Formularen | Hoch | Bestehende Unit-Tests für `add-item-form` und `edit-item-form` decken Validierung, State und Submits ab und dürfen nicht modifiziert werden. |
