# Modul-Spec: shared-ui-migration

Status: bereit für Implementierung
Beads: `fam-978.9` bis `fam-978.13`
Abhängigkeiten: `design-system-core`

## Objective

Gemeinsam verwendete Form-, Icon-, Layout-, Card-, Progress- und Button-
Komponenten werden auf den Core-Vertrag umgestellt. Jede native oder
plattformabhängige Ausnahme bleibt an ihrer tatsächlichen API-Grenze.

## Slices

- Datum-/Zeit-/Wheel-Fields behalten Fokus, Modal, Keyboard und
  Android-/Shared-Varianten.
- Animated Icons behalten Web-, Android-, SVG- und Reanimated-Grenzen.
- Gemeinsame Layout- und Card-Komponenten verwenden zentrale Semantik sowie
  lokales typed Layout.
- Product-/Progress-/Quantity-/Snackbar-Komponenten behalten berechnete
  Geometrie und Zustandsdarstellung.
- Back-, Compact-, Floating-, Header- und Profile-Buttons behalten Touchflächen,
  Accessibility und die statische Face-Basis auf realen Geräten.

## Regeln

- `StyleSheet` kommt aus `react-native-unistyles` oder der tatsächlichen nativen
  Integrations-API.
- FlashList, Bottom Sheets, SVG, `expo-image` und Reanimated erhalten keine
  erfundene CSS-Interop.
- Lokale Klassen werden nicht mechanisch in semantische Token-Duplikate
  übersetzt. Wiederkehrende Darstellung geht in `ui.tsx`.
- Plattformpaare werden zusammen migriert und gemeinsam geprüft.

## Success Criteria

1. Die fünf Shared-Slices haben keine aktiven `className`-Props.
2. Bestehende APIs, Accessibility und dynamische/native Verhalten bleiben
   erhalten.
3. Pressable-Callback-Probleme werden nicht durch Tests allein kaschiert;
   Gerätebeleg und statische Face-Styles bleiben Teil der Abnahme.
4. Jeder Slice besteht die fokussierten Tests und die relevanten Gates.

## Verification

- Fokussierte Tests der jeweils betroffenen Komponente mit `bun run test <file>`.
- `bun run check` und `bun run typecheck` nach jedem Slice.
- iOS-/Android-Dev-Client-Prüfung für interaktive Flächen und Plattformvarianten.
