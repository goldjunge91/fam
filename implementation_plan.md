# Implementierungsplan: Umbenennung & logische Neusortierung aller Feature-Dateien

Dieser Plan strukturiert alle Dateien in `src/features/` nach einheitlichen, sprechenden und intuitiven Konventionen (Feature-First Architektur).

---

## 🎯 Ziele der Umstrukturierung

1. **Einheitliche Komponenten-Organisation (`components/`)**: Alle UI-Komponenten, Modals, Sheets und Cards wandern in den jeweiligen `components/`-Unterordner des Features (keine lose gemischten UI-Komponenten auf Feature-Wurzelebene).
2. **Konsistente Screen-Nomenklatur (`*-screen.tsx`)**: Jeder gerenderte Screen endet auf `-screen.tsx` (z. B. `onboarding-flow.tsx` → `onboarding-screen.tsx`).
3. **Einheitliche Hook-Nomenklatur (`use-*.ts`)**: Dateien, die primär React-Hooks exportieren, folgen dem Präfix `use-*.ts` (z. B. `recipe-favorites.ts` → `use-recipe-favorites.ts`, `module-preferences.ts` → `use-module-preferences.ts`).
4. **Beseitigung redundanter Re-Exports**: Löschen von Schein-Screens (z. B. `src/features/settings/edit-profile-screen.tsx`, die nur `profile/` re-exportieren) und direkte Verknüpfung der App-Routen in `src/app/`.
5. **Reduzierung von Redundanz in Subdirectories**: In Unterordnern wie `wizard/` oder `dev/` werden doppelte Präfixe entfernt (z. B. `wizard/recipe-wizard-step-basics.tsx` → `wizard/step-basics.tsx`).
6. **100 % Typ- und Test-Stabilität**: Nach allen Verschiebungen und Umbenennungen laufen `bun run check`, `bun run typecheck` und alle 87 Test-Suiten fehlerfrei durch.

---

## 📋 Vorgeschlagene Änderungen nach Feature-Bereich

---

### 1. Auth (`src/features/auth/`)
| Aktueller Pfad | Neuer Pfad | Grund |
|---|---|---|
| `oauth-buttons.tsx` | `components/oauth-buttons.tsx` | UI-Komponente gehört in `components/` |
| `oauth-buttons.test.tsx` | `components/oauth-buttons.test.tsx` | Co-Location des Tests |

---

### 2. Kalorien-Tracking & Dashboard (`src/features/calorie-tracking/`, `src/features/dashboard/`)
| Aktueller Pfad | Neuer Pfad | Grund |
|---|---|---|
| `dashboard/dashboard-cards-sheet.tsx` | `dashboard/components/dashboard-cards-sheet.tsx` | Bottom-Sheet gehört in `components/` |
| `calorie-tracking/active-profile-store.ts` | `calorie-tracking/use-active-profile.ts` | Sprechender Hook/Store-Name |
| `calorie-tracking/food-history.ts` | `calorie-tracking/use-food-history.ts` | Exportiert primär Custom Hooks (`useRecentFoods`, etc.) |

---

### 3. Vorrat & Lagerorte (`src/features/inventory/`)
| Aktueller Pfad | Neuer Pfad | Grund |
|---|---|---|
| `product-detail-modal.tsx` | `components/product-detail-modal.tsx` | Modal-Komponente gehört in `components/` |
| `product-search-dropdown.tsx` | `components/product-search-dropdown.tsx` | UI-Komponente gehört in `components/` |
| `product-search-dropdown.test.tsx` | `components/product-search-dropdown.test.tsx` | Co-Location des Tests |
| `frequent-products-quick-select.tsx` | `components/frequent-products-quick-select.tsx` | UI-Komponente gehört in `components/` |
| `frequent-products-quick-select.test.tsx` | `components/frequent-products-quick-select.test.tsx` | Co-Location des Tests |
| `barcode-scanner-modal.tsx` | `components/barcode-scanner-modal.tsx` | Modal-Komponente gehört in `components/` |

---

### 4. Einkaufsliste (`src/features/shopping-list/`)
| Aktueller Pfad | Neuer Pfad | Grund |
|---|---|---|
| `complete-run-sheet.tsx` | `components/complete-run-sheet.tsx` | Sheet-Komponente gehört in `components/` |

---

### 5. Rezepte (`src/features/recipes/`)
| Aktueller Pfad | Neuer Pfad | Grund |
|---|---|---|
| `recipe-favorites.ts` | `use-recipe-favorites.ts` | Enthält `useRecipeFavorites`-Hook |
| `recipe-ratings.ts` | `use-recipe-ratings.ts` | Enthält `useRecipeRating`-Hook |
| `recipe-image-uploader.ts` | `use-recipe-images.ts` | Bild-Upload & URL-Hooks (`useRecipeCoverUrl`, etc.) |
| `wizard/recipe-wizard-step-basics.tsx` | `wizard/step-basics.tsx` | Redundanten Ordnerpräfix entfernen |
| `wizard/recipe-wizard-step-steps.tsx` | `wizard/step-steps.tsx` | Redundanten Ordnerpräfix entfernen |
| `wizard/recipe-wizard-step-preview.tsx` | `wizard/step-preview.tsx` | Redundanten Ordnerpräfix entfernen |
| `wizard/recipe-metadata-options.ts` | `wizard/metadata-options.ts` | Sprechender Name im `wizard/`-Kontext |

---

### 6. Onboarding (`src/features/onboarding/`)
| Aktueller Pfad | Neuer Pfad | Grund |
|---|---|---|
| `onboarding-flow.tsx` | `onboarding-screen.tsx` | Konsistente `*-screen.tsx`-Konvention |
| `onboarding-flow.test.tsx` | `onboarding-screen.test.tsx` | Co-Location des Tests |

---

### 7. Einstellungen (`src/features/settings/`)
| Aktueller Pfad | Neuer Pfad | Grund |
|---|---|---|
| `edit-profile-screen.tsx` | *(LÖSCHEN)* | Redundanter Re-Export (Routen importieren direkt aus `@/features/profile/edit-profile-screen`) |
| `profile-hub-screen.tsx` | *(LÖSCHEN)* | Redundanter Re-Export (Routen importieren direkt aus `@/features/profile/profile-hub-screen`) |
| `notification-settings-card.tsx` | `components/notification-settings-card.tsx` | Card-Komponente gehört in `components/` |
| `notification-settings-card.test.tsx` | `components/notification-settings-card.test.tsx` | Co-Location des Tests |
| `premium-promo-card.tsx` | `components/premium-promo-card.tsx` | Card-Komponente gehört in `components/` |
| `settings-menu.tsx` | `components/settings-menu.tsx` | Menügruppen/Zeilen-Komponenten |
| `module-preferences.ts` | `use-module-preferences.ts` | Enthält `useModulePreferences`-Hook & Mutation |

---

## 🔄 Nachgelagerte Anpassungen

1. **Import-Pfade in `src/app/`**:
   - `src/app/onboarding.tsx` → `import { OnboardingScreen } from '@/features/onboarding/onboarding-screen'`
   - `src/app/settings/edit-profile.tsx` → `import { EditProfileScreen } from '@/features/profile/edit-profile-screen'`
   - `src/app/settings/profile.tsx` → `import { ProfileHubScreen } from '@/features/profile/profile-hub-screen'`
2. **Import-Pfade innerhalb von `src/features/`**:
   - Aktualisierung aller relativen und absoluten Importe (`@/features/...`) auf die neuen Dateipfade.
3. **Test-Dateien**:
   - Aktualisierung aller Test-Importe und Mocks.

---

## 🧪 Verifikationsplan

### Automatisierte Tests & Checks
1. `bun run check:fix` — Biome Formatting & Linter-Prüfung aller umbenannten und verschobenen Dateien.
2. `bun run typecheck` — Vollständige TypeScript-Kompilierung ohne `any` oder fehlende Module.
3. `bun run test` — Ausführung aller 87 Jest-Testsuiten (666 Tests).
4. `git status` — Sicherstellen, dass keine ungetrackten Reste verbleiben.
