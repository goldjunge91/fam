# Modul-Spec: feature-migration

Status: bereit für Implementierung
Beads: `fam-978.14` bis `fam-978.46` und `fam-978.61` bis `fam-978.64`
Abhängigkeiten: `shared-ui-migration`

## Objective

Alle aktiven Feature- und Route-Verbraucher werden in kleinen, überprüfbaren
Slices auf die gemeinsame Unistyles-/native Style-Architektur umgestellt. Die
Migration betrifft Styling und notwendige Prop-Anpassungen, nicht Fachlogik,
Datenmodelle oder Sync-Verhalten.

## Domänengrenzen

Die Beads-Slices decken vollständig ab:

- Auth und Onboarding einschließlich Plattformvarianten.
- Calorie Tracking, GLP-1 und Profile als private Tracking-Domänen.
- Household als geteilte Haushaltsdomäne.
- Inventory einschließlich Barcode-, Sheet-, Row- und Tab-Grenzen.
- Meal Planner und Recipes einschließlich Reanimated, Drag-Reorder und Timer.
- Feedback und Premium.
- Settings einschließlich Design-System-Showcase und Sync-Debug-Oberflächen.
- Shopping List einschließlich FlashList, Modals und Reorder-Sheets.
- `src/app/settings/product-search.tsx` als verbleibende Route.

## Slice-Regeln

- Jeder Slice berührt höchstens fünf zusammengehörige Produktionsdateien.
- Android-/iOS-/Shared-Dateipaare werden im selben Slice behandelt.
- Datenbank-, RLS-, SQLite-, Outbox- und Sync-Owner werden nicht verändert.
- Feature-Code nutzt zentrale Primitiven und Tokens; er definiert keine neue
  semantische Farbe, Typografierolle oder globale Layoutklasse.
- Gegenaktionen, Accessibility und Loading-/Error-/Empty-States bleiben
  unverändert beobachtbar.
- `className`-Entfernung erfolgt mit echten `style`-/Unistyles-Props. Bei
  FlashList und nativen Komponenten werden tatsächliche Style-APIs verwendet.

## Success Criteria

1. Jeder in der Capability Map aufgeführte Consumer-Slice ist abgeschlossen.
2. Kein aktiver Feature- oder Route-Consumer verwendet `className` oder
   `contentContainerClassName`.
3. Fokussierte Tests für betroffene Screens/Komponenten bleiben grün.
4. Fachliches Verhalten und private/geteilte Datengrenzen bleiben unangetastet.

## Verification

- Pro Slice: `bun run test <betroffene-testdatei>` sowie `bun run check` und
  `bun run typecheck`.
- Nach jedem Domänenblock: statischer Scan der aktiven Quellen und gezielte
  RNTL-/Harness-Prüfung für Zustände und Plattformgrenzen.
- Nach Abschluss aller Domänen: vollständiger Removal-Scan vor Retirement.
