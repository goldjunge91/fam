# Ordnerstruktur & Architekturstandards: fam

---

## 1. Gesamte Baumstruktur im Überblick

```txt
fam/
├── .agents/                          # AI Agent Skills & Regeln (Offizieller Standard)
├── assets/                           # Statische Assets (Icons, Splash, Bilder, Fonts)
├── docs/                             # Zentrale Dokumentation & Spezifikationen
│   ├── architecture/                 # System-Architektur, Datenschutz, DB-Design
│   ├── design-system/                # Design-Tokens, UI Single Source of Truth
│   ├── features/                     # Fachliche Spezifikationen & Funktionsdiagramme
│   ├── adr/                          # Architecture Decision Records (ADRs)
│   ├── mockups/                      # UI/UX Mockups & Screens
│   └── archive/                      # Historische Dokumente & alte Guides
│
├── supabase/                         # Supabase Konfiguration & Declarative Schemas
│   ├── schemas/                      # Declarative Schema Definitionen (*.sql, Single Source of Truth)
│   ├── migrations/                   # Generierte Migrationen (nur via `bun run db:diff`)
│   └── tests/                        # pgTAP Datenbank-Tests (*.sql)
│
├── types/                            # Globale TypeScript-Deklarationen (*.d.ts)
│
└── src/
    ├── app/                          # Expo Router: Reine Routing-Schicht (dünn, delegiert an features)
    │   ├── _layout.tsx               # Root-Layout mit Theme-Bootstrap & Session-Guard
    │   ├── onboarding.tsx            # Initialer Onboarding-Screen (vor Login / First Launch)
    │   │
    │   ├── (auth)/                   # Öffentliche Auth-Routen (Login, Registrierung, Passwort)
    │   │   ├── _layout.tsx           # Auth-Stack-Layout
    │   │   ├── sign-in.tsx           # /sign-in
    │   │   ├── sign-up.tsx           # /sign-up
    │   │   ├── forgot-password.tsx   # /forgot-password
    │   │   └── reset-password.tsx    # /reset-password
    │   │
    │   ├── (app)/                    # Geschützte Haupt-Hubs mit AppShell (Drawer, FAB, Sync-Banner)
    │   │   ├── _layout.tsx           # Auth-Guard + AppShell-Layout (Drawer, Global FAB)
    │   │   ├── index.tsx             # / (Dashboard)
    │   │   ├── shopping-list.tsx     # /shopping-list (Einkaufsliste)
    │   │   ├── fridge.tsx            # /fridge (Vorrat & Kühlschrank)
    │   │   ├── recipes.tsx           # /recipes (Rezepte-Hub)
    │   │   ├── meal-planner.tsx      # /meal-planner (Wochen-Essensplaner)
    │   │   ├── diary.tsx             # /diary (Kalorien- & Nährwert-Tagebuch)
    │   │   ├── settings.tsx          # /settings (Einstellungen-Übersicht)
    │   │   └── brochures/            # /brochures (Prospekte-Viewer)
    │   │       ├── index.tsx
    │   │       └── [id].tsx
    │   │
    │   ├── household/                # Haushalts-Subscreens
    │   │   ├── _layout.tsx
    │   │   ├── create.tsx            # /household/create
    │   │   ├── join.tsx              # /household/join
    │   │   ├── members.tsx           # /household/members
    │   │   ├── children.tsx          # /household/children
    │   │   ├── stores.tsx            # /household/stores
    │   │   └── storage-locations.tsx # /household/storage-locations
    │   │
    │   ├── profile/                  # Profil-Subscreens
    │   │   ├── _layout.tsx
    │   │   ├── index.tsx             # /profile (Profil-Hub)
    │   │   ├── edit.tsx              # /profile/edit (Name, Avatar, Account)
    │   │   └── tracking.tsx          # /profile/tracking (Tracking-Ziele, BMR/TDEE)
    │   │
    │   ├── recipe/                   # Rezept-Subscreens
    │   │   ├── _layout.tsx
    │   │   ├── detail.tsx                # /recipe/detail (Rezept-Detailansicht)
    │   │   ├── cook.tsx                  # /recipe/cook (Vollbild-Kochmodus)
    │   │   ├── create.tsx                # /recipe/create (Rezept-Editor / Wizard)
    │   │   ├── log.tsx                   # /recipe/log (In Tagebuch eintragen)
    │   │   └── template-detail.tsx   # /recipe/template-detail
    │   │
    │   ├── settings/                 # Einstellungen-Subscreens & Dev-Tools
    │   │   ├── _layout.tsx
    │   │   ├── modules.tsx           # /settings/modules
    │   │   ├── export.tsx            # /settings/export
    │   │   ├── delete-account.tsx    # /settings/delete-account
    │   │   ├── privacy.tsx           # /settings/privacy
    │   │   ├── notifications.tsx     # /settings/notifications
    │   │   ├── permissions.tsx       # /settings/permissions
    │   │   ├── sync-debug.tsx        # /settings/sync-debug
    │   │   ├── sync-settings.tsx     # /settings/sync-settings
    │   │   ├── dev.tsx               # /settings/dev
    │   │   ├── glass-lab.tsx         # /settings/glass-lab
    │   │   └── camera-lab.tsx        # /settings/camera-lab
    │   │
    │   ├── add-item.tsx              # Schnelleingabe Inventar / Vorrat (Modal)
    │   ├── add-food-entry.tsx        # Schnelleingabe Kalorientagebuch (Modal)
    │   ├── add-product.tsx           # Neues Produkt anlegen (Modal)
    │   └── food-search.tsx           # Globale Produktsuche (Modal)
    │
    ├── components/                   # Geteilte, domänenfreie UI-Komponenten
    │   ├── components_camera/        # Kamera-Controls, Scanner-Views & Overlays
    │   ├── forms/                    # Formular-Controls (date-picker, text-field, wheel-picker)
    │   ├── icons/                    # Icons (fam-icon, animated-icon, calendar-day-icon)
    │   ├── layout/                   # Layout-Gerüste (screen, page-header, hub-screen, gradient-background, app-shell)
    │   ├── theme/                    # Theming-Wrapper (themed-text, themed-view)
    │   └── ui/                       # Wiederverwendbare Basis-Bausteine:
    │       ├── buttons/              # button, back-button, menu-button, profile-button, floating-action-button
    │       ├── card.tsx
    │       ├── empty-state.tsx
    │       ├── filter-chip-bar.tsx
    │       ├── glass-card.tsx
    │       ├── inline-select.tsx
    │       ├── item-source-filter.tsx
    │       ├── module-gate.tsx       # Feature-Gate (Modul aktiv / inaktiv)
    │       ├── module-locked-overlay.tsx
    │       ├── product-information.tsx
    │       ├── progress-bar.tsx
    │       ├── progress-ring.tsx
    │       ├── quantity-stepper.tsx
    │       ├── sync-status-banner.tsx
    │       └── ...
    │
    ├── constants/                    # Unveränderliche Tokens & Konfigurationen
    │   ├── theme.ts                  # Mauve/Creme Farbsystem (Light & Dark)
    │   ├── layout.ts                 # Standard-Abstände, Border-Radius, Breakpoints
    │   ├── feature-registry.ts       # Modul-Registry & Feature-Flags
    │   └── rings.ts                  # Ring-Konstanten für Tracker
    │
    ├── hooks/                        # Geteilte, App-weite Custom Hooks
    │   ├── use-theme.ts
    │   ├── use-color-scheme.ts
    │   ├── use-sync-status.ts
    │   └── ...
    │
    ├── lib/                          # Infrastruktur, Core-Services & Helfer (UI-frei)
    │   ├── analytics/                # Aptabase Analytics & Event-Tracking
    │   ├── db/                       # Lokale SQLite-Datenbank, Drizzle-Schema, Outbox-Queue & Migrations
    │   ├── off-dump/                 # OpenFoodFacts Offline-Cache & Dump-Import
    │   ├── sync/                     # Outbox-Sync-Engine & Realtime-Sync
    │   ├── storage/                  # Lokaler Key-Value Storage
    │   ├── supabase.ts               # Supabase Client Singleton
    │   ├── database.types.ts         # Generierte Supabase TypeScript-Typen
    │   ├── purchases.ts              # RevenueCat SDK-Initialisierung & Helfer
    │   ├── open-food-facts.ts        # OpenFoodFacts API-Client & Typen
    │   ├── sentry.ts                 # Sentry Error Reporting
    │   ├── posthog.tsx               # PostHog Analytics Provider
    │   ├── env.ts                    # Validierte Umgebungsvariablen
    │   └── ...
    │
    └── features/                     # Fachdomänen (Business-Logik, Screens, Hooks & API)
        │
        ├── [Geteilte Haushalts-Domänen]
        ├── household/                # Haushaltsmitglieder, Rollen, Einladungen, Vorratsorte, Supermärkte
        ├── inventory/                # Geteilter Vorrat & Kühlschrank, Haltbarkeits-Tracking, Push-Repair
        ├── shopping-list/            # Einkaufsliste, Kategorisierung, Sortierung, Laufwege, Sheets
        ├── recipes/                  # Rezepte, Kochmodus, Wizard, Scaling, templates/
        ├── meal-planner/             # Wochen-Essensplaner, Mahlzeitenzuweisung, Einkaufsbedarfs-Berechnung
        ├── brochures/                # Prospekte-Viewer, Händler-Hotspots, PLZ-Filter, Sync
        │
        ├── [Private Tracking-Domänen (RLS-isoliert)]
        ├── calorie-tracking/         # Kalorien-/Makro-Tracking, Low-Carb-Modus, Quick-Log, Goals, BMR/TDEE
        ├── workouts/                 # Workouts, Aktivitäten, Vitalwerte
        │
        ├── [Querschnitts- & System-Domänen]
        ├── ads/                      # Banner, Interstitial-Hook, AdMob-Service
        ├── app-shell/                # App-Bootstrap, Lifecycle-Handling, Crash-Fallback, Global Providers
        ├── auth/                     # Sign-In, Sign-Up, Session-Provider, Deep-Links, Account-Isolation
        ├── dashboard/                # Start-Hub, Widgets, Tagesübersichten
        ├── experimentalscreens/      # Kamera/Video Test-Screens
        ├── navigation/               # TabBar, Header, Drawer-Navigation, FAB-Settings
        ├── onboarding/               # Onboarding-Flow, Präferenzen, Setup-Strecke
        ├── premium/                  # RevenueCat Paywalls, Offerings, Pro-Status-Gating
        ├── profile/                  # Profil-Hub, Avatar-Upload, Profil-Edit, BMR/TDEE & Tracking-Ziele
        ├── search/                   # Globale Suche: Ranking, Barcode-Lookup, Supermarkt-Treffer, OpenFoodFacts
        └── settings/                 # App-Optionen, Benachrichtigungen, Permissions, Export, dev/
```

---

## 2. Dateinamen-Regeln (Naming Conventions)

Alle Dateinamen folgen strikt einheitlichen Konventionen:

### 1. Kebab-Case als Standard
Alle TypeScript/TSX-Dateien im Projekt werden in **kebab-case** benannt (Kleinbuchstaben mit Bindestrichen).
* **Screens:** `*-screen.tsx` (z. B. `inventory-screen.tsx`, `edit-profile-screen.tsx`)
* **Hooks:** `use-*.ts` (z. B. `use-theme.ts`, `use-brochures.ts`)
* **Tests:** `*.test.ts` oder `*.test.tsx` (liegen direkt neben der Implementierungsdatei)
* **Integration Tests:** `*.integration.test.ts`
* **Components / Cards / Sheets:** `*-card.tsx`, `*-sheet.tsx`, `*-banner.tsx`, `*-button.tsx`
* **Feature Verträge:** `api.ts`, `types.ts`, `EXPLANATION.md`

### 2. Plattform-Differenzierung (Expo / React Native)
Plattformspezifische Implementierungen nutzen standardmäßige Plattform-Suffixe:
* `.tsx` / `.ts`: Universeller Code (iOS, Android, Web)
* `.ios.tsx` / `.ios.ts`: Spezifisch für iOS (z. B. native Blur-Effekte, Wheel-Picker)
* `.android.tsx` / `.android.ts`: Spezifisch für Android (z. B. Material-Effekte, BackHandler)
* `.web.tsx` / `.web.ts`: Spezifisch für Web

### 3. Expo Router Konventionen (`src/app/`)
* Layouts: `_layout.tsx`
* Route Groups (unsichtbar in URL): `(app)`, `(auth)`
* Dynamische Routen: `[id].tsx`
* 404-Route: `+not-found.tsx`

---

## 3. Zuordnungsregeln (Placement Rules)

Um die Codebase modular und wartbar zu halten, gilt für jede Datei eine eindeutige Zuordnungsregel:

### 1. `src/app/` — Reine Routing-Schicht
* **Erlaubt:** Expo Router Layouts (`_layout.tsx`), Routen-Dateien, Parameter-Parsing aus der URL, Rendering von Feature-Screens mit `<ModuleGate>`.
* **Verboten:** Geschäftslogik, komplexe State-Verwaltung, direkte Supabase/SQLite-Aufrufe, umfangreiches UI-Markup.
* **Faustregel:** Eine Datei in `src/app/` sollte in der Regel nicht mehr als 10–20 Zeilen haben und nur an einen Screen aus `src/features/` delegieren.

### 2. `src/features/<domain>/` — Fachdomänen
* Jede Fachdomäne bündelt ihre eigene Business-Logik, Screens, Hooks, State und API-Aufrufe.
* **Standard-Feature (flach, bis ~10 Dateien):**
  * `api.ts` (Supabase / SQLite Abfragen)
  * `types.ts` (Interfaces & Typen)
  * `*-screen.tsx` (Screen-Komponenten)
  * `use-*.ts` (Feature-Hooks)
  * `EXPLANATION.md` (Kurzbeschreibung der Domäne)
* **Großes Feature (geschichtet, ab ~10–15 Dateien, z. B. `shopping-list`, `recipes`, `settings`):**
  * `screens/` (Screen-Komponenten)
  * `sheets/` (Bottom-Sheets & Modals)
  * `forms/` (Formulare & Eingabemasken)
  * `components/` (Reine Anzeige-Komponenten)
  * `hooks/` (Data-Fetching & Mutation-Hooks)
  * `domain/` (Reine Business-Logik & Config ohne React)
  * `api.ts` & `types.ts` & `EXPLANATION.md`

### 3. `src/components/` — Geteilte, domänenfreie UI
* Komponenten, die in **mindestens zwei unterschiedlichen Fachdomänen** verwendet werden und **keine Bindung an eine bestimmte Domäne** haben (z. B. generische Buttons, Cards, Screen-Wrapper, Layouts, Formular-Felder).
* UI-Bausteine, die nur in einem Feature gebraucht werden, gehören in das jeweilige Feature (`src/features/<domain>/components/`).

### 4. `src/lib/` — Infrastruktur & Core-Services (UI-frei)
* Alles Technische ohne React-UI: SQLite-Datenbank (`db/`), Outbox-Sync (`sync/`), Supabase Client (`supabase.ts`), Third-Party SDKs (RevenueCat `purchases.ts`, Aptabase `analytics/`, Sentry, PostHog), OpenFoodFacts API (`open-food-facts.ts`), Umgebungsvariablen (`env.ts`).

### 5. `src/constants/` — Globale Konstanten
* Design-Tokens (`theme.ts`), Layout-Konstanten (`layout.ts`), Modul-Registrierung (`feature-registry.ts`).

### 6. `src/hooks/` — App-weite Custom Hooks
* Domänenunabhängige Custom Hooks (`useTheme`, `useColorScheme`, `useSyncStatus`).

### 7. `supabase/` — Datenbank & RLS (Single Source of Truth)
* **`schemas/*.sql`** ist die einzige deklarative Wahrheit.
* Niemals Migrationen von Hand schreiben; Migrationen werden ausschließlich über `bun run db:diff` erzeugt.
* Alle Tabellen müssen RLS-Policies und zugehörige pgTAP-Tests in `supabase/tests/` besitzen.
