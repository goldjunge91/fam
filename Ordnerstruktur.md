# Ziel-Ordnerstruktur & Architekturplan: NutriTrack (fam)

> [!NOTE]
> **Planungsphase**: Es werden noch keine Dateien verändert. Dieses Dokument definiert die Ziel-Architektur für das Repository.
>
> **Status (2026-08-18):** Migration ist bewusst zurückgestellt, bis die NativeWind-Implementierung abgeschlossen ist (siehe `improve_app_ui_responsiveness` / laufender Merge aus `feat/nativewind-migration-local`). Erst danach wird dieser Plan umgesetzt, damit Import-Pfad-Änderungen nicht mit dem parallelen Styling-Umbau kollidieren.
>
> **Revision:** Gegenüber der ursprünglichen Fassung wurde der Scope bewusst reduziert. Grund: Eine flächendeckende `components/screens/hooks/utils`-Unterteilung in jedem Feature ist Ceremony ohne funktionalen Gewinn, wenn ein Feature nur 5–15 Dateien hat (siehe Abschnitt 5 "Bewusst nicht übernommen"). Der Plan behebt echte Probleme (Dopplung `fridge`/`inventory`, fehlende `api.ts`/`types.ts`), statt eine Struktur überzustülpen, die an der Codebase-Größe vorbeigeht.

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
│   ├── app/                          # Expo Router: Reine Routing-Schicht
│   │   ├── (app)/                    # Geschützte Routen (Tabs, Drawer, Feature-Screens)
│   │   ├── (auth)/                   # Öffentliche Auth-Routen (Login, Registrierung, Reset)
│   │   └── _layout.tsx               # Root-Layout mit Provider-Bootstrap
│   │
│   ├── components/                   # Geteilte, wiederverwendbare UI-Komponenten
│   │   ├── ui/                       # Basis-Bausteine & Atome (bereits vorhanden, wird ausgebaut)
│   │   └── ...                       # Rest bleibt flach (screen.tsx, card.tsx, page-header.tsx, ...)
│   │                                 # Keine erzwungene layout/ + feedback/ Aufspaltung, siehe Abschnitt 5
│   │
│   ├── constants/                    # Theme-Tokens, Farbpaletten, Layout-Konstanten
│   │   ├── theme.ts                  # Mauve/Creme Farbsystem (Light & Dark)
│   │   └── layout.ts                 # NEU: Standard-Abstände, Border-Radius, Breakpoints
│   │
│   ├── features/                     # Fachdomänen — bleibt flach pro Feature (siehe Abschnitt 4)
│   │   ├── auth/
│   │   ├── calorie-tracking/
│   │   ├── dashboard/
│   │   ├── household/
│   │   ├── inventory/                 # KONSOLIDIERT: übernimmt fridge/ komplett (siehe Abschnitt 3)
│   │   ├── meal-planner/
│   │   ├── navigation/
│   │   ├── onboarding/
│   │   ├── premium/
│   │   ├── recipes/                   # inkl. recipe-templates/ (siehe Abschnitt 3)
│   │   ├── settings/                  # inkl. profile/ (aktuell fast leer, siehe Abschnitt 3)
│   │   └── shopping-list/
│   │
│   ├── hooks/                         # Geteilte, App-weite Custom Hooks
│   │
│   └── lib/                           # Infrastruktur, Core-Services & Helfer
│       ├── db/                        # Lokale SQLite-Datenbank & Adapter
│       ├── sync/                      # Outbox-Sync-Engine & Queue
│       ├── off-dump/                  # OpenFoodFacts Offline-Cache
│       ├── database.types.ts          # Generierte Supabase TypeScript-Typen
│       ├── supabase.ts                # Supabase Client Singleton
│       └── ...
│
├── supabase/                          # Declarative Schemas, Migrations & Tests
└── types/                             # Globale TypeScript Deklarationen
```

---

## 2. Feature-Blueprint (schlank statt tief verschachtelt)

Kein erzwungenes `screens/` / `hooks/` / `utils/`-Grid pro Feature. Stattdessen:

```
src/features/<domain>/
├── components/       # UI-Bausteine, nur wenn mehr als ~3 Stück (sonst flach im Root)
├── api.ts            # Supabase API Calls, Sync-Queries & Mutationen — verpflichtend, auch wenn klein
├── types.ts           # Feature-spezifische Typen, Enums & Interfaces — verpflichtend
├── EXPLANATION.md      # Kurzbeschreibung der Feature-Architektur — verpflichtend
└── *.tsx / *.ts       # Screens, Hooks, Utils flach im Feature-Root
```

**Ausnahme (Unterordner erlaubt, nicht vorgeschrieben):** Ein Feature darf `screens/`, `hooks/`, `utils/` einführen, sobald es mehr als ~15 Dateien im Root hat und die Trennung tatsächlich Navigierbarkeit verbessert. Aktuell trifft das nur auf `settings/` (20 Dateien) und `recipes/` (nach Merge mit `recipe-templates/`, ~18 Dateien) zu — für alle anderen Features bleibt es flach.

---

## 3. Notwendige Konsolidierungen (echte Dopplung, kein Nice-to-have)

### `fridge/` → aufgehen in `inventory/`
Beide Features haben aktuell eine eigene `fridge-screen.tsx` und überschneidende Produkt-/Item-Logik. Ziel: eine Quelle der Wahrheit unter `inventory/`.

- `fridge/components/*` → `inventory/components/`
- `fridge/expiry.ts`, `fridge/use-expiry-notifications.ts`, `fridge/use-fridge-items.ts`, `fridge/use-fridge-mutations.ts` → `inventory/`
- Die beiden `fridge-screen.tsx`-Varianten müssen inhaltlich verglichen und zu einer zusammengeführt werden (nicht blind überschreiben — vor dem Merge beide lesen und Unterschiede klären).
- Tests wandern mit, `inventory/EXPLANATION.md` wird um den Fridge-Teil ergänzt.

### `recipe-templates/` → aufgehen in `recipes/`
Nur 3 Dateien, kein eigenständiges Feature-Gewicht. Wandert nach `recipes/` (ggf. `recipes/templates/` als Unterordner, falls die Abgrenzung im Code sinnvoll bleibt).

### `profile/` → aufgehen in `settings/`
Enthält aktuell nur `EXPLANATION.md`, keine Implementierung. `edit-profile-screen.tsx` liegt bereits in `settings/`. Der leere `profile/`-Ordner entfällt, Inhalt der `EXPLANATION.md` wandert in `settings/EXPLANATION.md`.

### Fehlende `api.ts` / `types.ts` ergänzen
Betrifft: `fridge` (nach Merge ohnehin obsolet), `dashboard`, `recipes`, `settings`, `premium`, `navigation`, `onboarding`. Nicht neu schreiben, sondern bestehende Supabase-Calls/Typen aus den Screens/Hooks in diese Dateien extrahieren.

---

## 4. Die 11 Fachdomänen (`src/features/`) nach Konsolidierung

`auth`, `calorie-tracking`, `dashboard`, `household`, `inventory` (inkl. fridge), `meal-planner`, `navigation`, `onboarding`, `premium`, `recipes` (inkl. templates), `settings` (inkl. profile), `shopping-list`.

Kein separates Kapitel pro Domäne mehr nötig — die aktuelle Datei-Benennung im Repo ist bereits konsistent genug (`use-*.ts` für Hooks, `*-screen.tsx` für Screens, `api.ts`/`types.ts` für Contracts). Der Plan schreibt keine neuen Namenskonventionen vor, sondern übernimmt die etablierten.

---

## 5. Bewusst nicht übernommen (aus der Erstfassung gestrichen)

- **`components/` in `ui/`, `layout/`, `feedback/` voll aufgespalten:** Zu viel Bewegung für zu wenig Nutzen bei aktuell ~25 Dateien im Root. `components/ui/` existiert bereits als Ort für echte Atome und wird bei Bedarf organisch erweitert; der Rest bleibt flach.
- **`screens/` / `hooks/` / `utils/` in jedem Feature erzwungen:** Siehe Abschnitt 2. Nur bei Features mit spürbarer Root-Unübersichtlichkeit (>15 Dateien).
- **Vollständiger `docs/`-Umbau als Pflichtteil dieser Migration:** Bleibt als separate, risikoarme Aufräumaktion (keine Imports betroffen), wird aber nicht mit der Code-Migration vermischt, da unabhängig timebar.

---

## 6. Plattform-Differenzierungs-Standard (iOS, Android, Web)

Unverändert gegenüber Erstfassung, bereits gelebte Praxis im Repo:

1. **Standard `.tsx` / `.ts`**: Universeller React Native & Expo Code.
2. **`.web.tsx` / `.web.ts`**: Web-Spezifika (DOM-Workarounds, CSS Modules, `window`-Events).
3. **`.ios.tsx` / `.ios.ts`**: iOS-Spezifika (Wheel-Pickers, native Blur-Effekte, Haptics).
4. **`.android.tsx` / `.android.ts`**: Android-Spezifika (Material Elevation, Ripple, BackHandler).

---

## 7. Reihenfolge bei Umsetzung (sobald NativeWind-Migration steht)

1. `fridge/` → `inventory/`-Merge (echte Dopplung zuerst beseitigen)
2. `recipe-templates/` → `recipes/`, `profile/` → `settings/`
3. Fehlende `api.ts` / `types.ts` extrahieren, wo sinnvoll
4. `constants/layout.ts` einführen, falls Bedarf an zentralen Spacing-Tokens besteht
5. `docs/`-Reorg separat, unabhängig vom Code-Zeitpunkt

Jeder Schritt einzeln committen, nach jedem Schritt `bun run check`, `bun run typecheck`, `bun run test`.
