# Ziel-Ordnerstruktur & Architekturplan: NutriTrack (fam)

> [!NOTE]
> **Planungsphase**: Es werden noch keine Dateien verändert. Dieses Dokument definiert die finale Ziel-Architektur für das Repository.

---

## 1. Gesamte Baumstruktur im Überblick

```
fam/
├── .agents/                          # AI Agent Skills & Regeln (Offizieller Standard)
├── assets/                           # Statische Assets (Icons, Splash, Bilder, Fonts)
├── docs/                             # Zentrale Dokumentation & Spezifikationen
│   ├── architecture/                 # System-Architektur, Sync-Engine, DB-Design
│   ├── archive/                      # Historische Walkthroughs & alte Migrationen
│   ├── design-system/                # Design-Tokens, UI Single Source of Truth
│   ├── features/                     # Fachliche Spezifikationen & Funktionsdiagramme
│   └── revenuecat/                   # In-App Purchases, Offerings, Webhook-Docs
│
├── src/
│   ├── app/                          # Expo Router: Reine Routing-Schicht (max. 5-10 Zeilen pro Route)
│   │   ├── (app)/                    # Geschützte Routen (Tabs, Drawer, Feature-Screens)
│   │   ├── (auth)/                   # Öffentliche Auth-Routen (Login, Registrierung, Reset)
│   │   └── _layout.tsx               # Root-Layout mit Provider-Bootstrap
│   │
│   ├── components/                   # Geteilte, wiederverwendbare UI-Komponenten
│   │   ├── ui/                       # Basis-Bausteine & Atome
│   │   │   ├── buttons/              # Button, BackButton, FAB, HeaderIconButton, MenuButton...
│   │   │   ├── inputs/               # TextField, InlineSelect, QuantityStepper, SegmentedControl...
│   │   │   ├── pickers/              # DatePicker, DateWheelField, WheelPickerField (.ios / .android / .web)
│   │   │   ├── typography/           # ThemedText, SectionHeading
│   │   │   └── cards/                # Card, GlassCard, ProductInformation
│   │   │
│   │   ├── layout/                   # Container & Struktur-Layouts
│   │   │   ├── screen.tsx            # Basis-Screen mit Safe-Area & KeyboardAvoiding
│   │   │   ├── app-shell.tsx         # Globaler Shell-Rahmen
│   │   │   ├── page-header.tsx       # Standard-Header mit Title & Action-Slots
│   │   │   ├── gradient-background.tsx # Hintergrund-Verläufe
│   │   │   ├── themed-view.tsx       # Theme-sensitiver View-Container
│   │   │   └── module-gate.tsx       # Feature-Flag / Modul-Freischaltung
│   │   │
│   │   └── feedback/                 # Status- & Interaktionsfeedback
│   │       ├── snackbar.tsx          # Toast- & Action-Meldungen
│   │       ├── sync-status-banner.tsx # Offline- & Sync-Statusanzeige
│   │       ├── progress-bar.tsx      # Linearer Fortschrittsbalken
│   │       ├── progress-ring.tsx     # Zirkulärer Ring (Kalorien / Makros)
│   │       ├── empty-state.tsx       # Standardisierter Leerzustand
│   │       └── animated-icon.tsx     # Feedback-Icons (.web.tsx / .module.css)
│   │
│   ├── constants/                    # Theme-Tokens, Farbpaletten, Layout-Konstanten
│   │   ├── theme.ts                  # Mauve/Creme Farbsystem (Light & Dark)
│   │   └── layout.ts                 # Standard-Abstände, Border-Radius, Breakpoints
│   │
│   ├── features/                     # Fachdomänen (Option 1 Blueprint)
│   │   ├── auth/                     # Authentifizierung & Session
│   │   ├── calorie-tracking/         # Kalorienzähler, Tagebuch, Makros, BMR/TDEE
│   │   ├── dashboard/                # Tagesübersicht & Daily Hub
│   │   ├── household/                # Haushaltsmitglieder, Einladungen, Kindprofile
│   │   ├── inventory/                # Geteilter Vorrat, Kühlschrank, Barcode-Scan, Lagerorte
│   │   ├── meal-planner/             # Wochenplan, Mahlzeitenzuweisung, Einkaufsbedarf
│   │   ├── navigation/               # Drawer, Profil-Sheet, Quick-Add
│   │   ├── onboarding/               # Setup-Wizard für neue Nutzer
│   │   ├── premium/                  # Paywall, Subscription-Gate, RevenueCat
│   │   ├── recipes/                  # Rezepte, Vorlagen/Templates, Koch-Modus
│   │   ├── settings/                 # Einstellungen, Profil bearbeiten, Sync-Debug
│   │   └── shopping-list/            # Einkaufsliste, Supermarkt-Laufstrecken
│   │
│   ├── hooks/                        # Geteilte, App-weite Custom Hooks
│   │   ├── use-color-scheme.ts       # (inkl. use-color-scheme.web.ts)
│   │   ├── use-theme.ts              # Theme-Token Resolver
│   │   ├── use-hub-gradient.ts       # Dynamische Farbverläufe
│   │   └── use-sync-status.ts        # Sync- & Online-State
│   │
│   └── lib/                          # Infrastruktur, Core-Services & Helfer
│       ├── formatters/               # Währung, Datum/Zeit, Einheiten, Initialen
│       ├── auth/                     # Deep-Links, Onboarding-State, Storage
│       ├── db/                       # Lokale SQLite-Datenbank & Adapter
│       ├── sync/                     # Outbox-Sync-Engine & Queue
│       ├── off-dump/                 # OpenFoodFacts Offline-Cache
│       ├── database.types.ts         # Generierte Supabase TypeScript-Typen
│       ├── supabase.ts               # Supabase Client Singleton
│       ├── query-client.ts           # React Query Client Konfiguration
│       ├── purchases.ts              # RevenueCat Purchases Helper
│       ├── notifications.ts          # Lokale & Push-Benachrichtigungen
│       └── open-food-facts.ts        # OpenFoodFacts API Client
│
├── supabase/                         # Declarative Schemas, Migrations & Tests
│   ├── schemas/                      # Einzige Wahrheitsquelle für DB-Tabellen & RLS
│   ├── tests/                        # pgTAP Datenbank-Tests
│   └── functions/                    # Supabase Edge Functions (Deno)
│
└── types/                            # Globale TypeScript Deklarationen (expo, jest, nativewind)
```

---

## 2. Der Option 1 Feature-Blueprint im Detail

Jedes Feature unter `src/features/<domain>/` folgt konsistent diesem Aufbau:

```
src/features/<domain>/
├── components/       # UI-Komponenten, Cards, Rows, Listen (z. B. fridge-item-row.tsx)
├── screens/          # Screens, Modals, Sheets (z. B. diary-screen.tsx, add-item-screen.tsx)
├── hooks/            # Feature-Hooks & Zustand-Stores (z. B. use-recipes.ts, use-diary.ts)
├── utils/            # Reine Logik, Rechner, Schemas (z. B. bmr.ts, expiry.ts, servings.ts)
├── api.ts            # Supabase API Calls, Sync-Queries & Mutationen
├── types.ts          # Feature-spezifische Typen, Enums & Interfaces
└── EXPLANATION.md    # Inline-Dokumentation der Feature-Architektur
```

---

## 3. Die 11 konsolidierten Fachdomänen (`src/features/`)

### 1. `auth/`
* **`components/`**: Auth-Header, Auth-Input-Groups, Social-Buttons
* **`screens/`**: `sign-in-screen.tsx`, `sign-up-screen.tsx`, `forgot-password-screen.tsx`, `reset-password-screen.tsx`
* **`hooks/`**: `use-session.ts`, `use-auth-mutations.ts`
* **`utils/`**: `auth-schemas.ts`, `orphaned-session.ts`, `onboarding-session.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 2. `calorie-tracking/`
* **`components/`**: Food-Entry-Row, Macro-Distribution-Bar, Calorie-Ring-Summary
* **`screens/`**: `diary-screen.tsx`, `add-food-entry-screen.tsx`, `food-search-screen.tsx`, `goal-setup-screen.tsx`
* **`hooks/`**: `use-diary.ts`, `use-active-profile.ts`, `use-local-food-usage.ts`
* **`utils/`**: `bmr.ts`, `tdee.ts`, `macros.ts`, `daily-totals.ts`, `food-history.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 3. `dashboard/`
* **`components/`**: Daily-Summary-Widget, Quick-Actions-Grid, Household-Status-Card
* **`screens/`**: `dashboard-screen.tsx`
* **`hooks/`**: `use-dashboard-data.ts`
* **`utils/`**: `widget-sorter.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 4. `household/`
* **`components/`**: Member-Row, Invite-QR-Modal, Role-Picker
* **`screens/`**: `members-screen.tsx`, `create-household-screen.tsx`, `join-household-screen.tsx`, `child-profiles-screen.tsx`, `household-switcher-modal.tsx`, `invite-modal.tsx`
* **`hooks/`**: `use-household.ts`, `use-household-members.ts`, `use-active-household.ts`
* **`utils/`**: `household-helpers.ts`, `query-keys.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 5. `inventory/` *(Konsolidiert aus fridge + inventory)*
* **`components/`**: `fridge-item-row.tsx`, `fridge-tab-bar.tsx`, `fridge-summary-card.tsx`, `edit-fridge-item-sheet.tsx`, `fridge-item-actions-sheet.tsx`, `frequent-products-quick-select.tsx`, `product-search-dropdown.tsx`, `product-detail-modal.tsx`, `barcode-scanner-modal.tsx`
* **`screens/`**: `fridge-screen.tsx` (Bestandsansicht), `add-item-screen.tsx`, `add-product-screen.tsx`, `storage-locations-screen.tsx`
* **`hooks/`**: `use-fridge-items.ts`, `use-fridge-mutations.ts`, `use-expiry-notifications.ts`, `use-product.ts`, `use-product-mutations.ts`, `use-storage-locations.ts`
* **`utils/`**: `expiry.ts`, `persist-off-product.ts`, `pending-product-selection.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 6. `meal-planner/`
* **`components/`**: Meal-Slot-Card, Day-Column, Recipe-Picker-Modal
* **`screens/`**: `meal-planner-screen.tsx`, `missing-ingredients-screen.tsx`
* **`hooks/`**: `use-meal-plans.ts`, `use-shopping-needs.ts`
* **`utils/`**: `week.ts`, `servings.ts`, `shopping-needs.ts`, `settings.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 7. `navigation/`
* **`components/`**: Navigation-Drawer-Item, User-Avatar-Badge
* **`screens/`**: `navigation-drawer.tsx`, `profile-sheet.tsx`, `quick-add-sheet.tsx`
* **`hooks/`**: `use-profile-initials.ts`, `use-navigation-chrome.ts`
* **`utils/`**: `route-helpers.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 8. `onboarding/`
* **`components/`**: Onboarding-Progress, Step-Container, Household-Choice-Card
* **`screens/`**: `onboarding-flow.tsx`, `goal-intro-screen.tsx`
* **`hooks/`**: `use-onboarding.ts`
* **`utils/`**: `onboarding-helpers.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 9. `premium/`
* **`components/`**: Paywall-Feature-Row, Pricing-Card, Restore-Button
* **`screens/`**: `premium-screen.tsx`, `paywall-modal.tsx`
* **`hooks/`**: `use-premium-status.ts`, `use-offerings.ts`
* **`utils/`**: `paywall.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 10. `recipes/` *(Inklusive Vorlagen/Templates)*
* **`components/`**: Recipe-Card, Ingredient-Row, Step-Item, Template-Card, Wizard-Steps
* **`screens/`**: `recipes-screen.tsx`, `recipe-detail-screen.tsx`, `recipe-create-screen.tsx`, `cooking-mode-screen.tsx`, `recipe-log-screen.tsx`, `recipe-template-detail-screen.tsx`
* **`hooks/`**: `use-recipes.ts`, `use-recipe-templates.ts`, `use-recipe-shopping-needs.ts`
* **`utils/`**: `nutrition.ts`, `recipe-favorites.ts`, `recipe-ratings.ts`, `recipe-image-uploader.ts`, `template-cover-images.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 11. `settings/` *(Inklusive Profilbearbeitung)*
* **`components/`**: Settings-Row, Settings-Group, Notification-Settings-Card, Premium-Promo-Card
* **`screens/`**: `settings-screen.tsx`, `edit-profile-screen.tsx`, `notifications-screen.tsx`, `module-settings-screen.tsx`, `meal-planner-settings-screen.tsx`, `sync-settings-screen.tsx`, `sync-debug-screen.tsx`, `privacy-screen.tsx`, `export-screen.tsx`, `delete-account-screen.tsx`
* **`hooks/`**: `use-profile-settings.ts`, `use-module-preferences.ts`
* **`utils/`**: `data-export.ts`, `module-preferences.ts`, `sync-status-text.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

### 12. `shopping-list/`
* **`components/`**: Shopping-Item-Row, Category-Section-Header, Store-Selector-Bar, Complete-Run-Sheet
* **`screens/`**: `shopping-list-screen.tsx`, `stores-screen.tsx`
* **`hooks/`**: `use-shopping-list.ts`, `use-shopping-list-mutations.ts`, `use-stores.ts`, `use-shopping-product-suggestions.ts`, `use-complete-shopping-run.ts`
* **`utils/`**: `shopping-categories.ts`, `store-presets.ts`
* **`api.ts`**, **`types.ts`**, **`EXPLANATION.md`**

---

## 4. Plattform-Differenzierungs-Standard (iOS, Android, Web)

Um plattformspezifische Besonderheiten sauber zu trennen, ohne den Code zu überfrachten:

1. **Standard `.tsx` / `.ts`**: Standard React Native & Expo Code, der universell auf allen Plattformen läuft.
2. **`.web.tsx` / `.web.ts`**: Web-Spezifika (z. B. HTML5 / DOM-Workarounds, CSS Modules, `window`-Events).
3. **`.ios.tsx` / `.ios.ts`**: iOS-Spezifika (z. B. Apple HIG Wheel-Pickers, native iOS Blur-Effekte, Haptic-Feedback).
4. **`.android.tsx` / `.android.ts`**: Android-Spezifika (z. B. Material Elevation, Ripple-Effekte, BackHandler).
