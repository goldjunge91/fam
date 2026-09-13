# Implementation Plan: Vollständige NativeWind-Ablösung durch Unistyles v3

Status: Entwurf zur menschlichen Plan-Abnahme
Spec: `docs/specs/nativewind-unistyles-migration/SPEC.md`
Capability Map: `docs/specs/nativewind-unistyles-migration/CAPABILITY_MAP.md`
Beads: `fam-978` und die unten aufgeführten Kind-Tasks

## Overview

Die bestätigte Migration wird vom aktiven Contract über die Foundation und die
drei Design-System-Owner durch Shared UI und alle Consumer bis zur Entfernung
der Legacy-Runtime geführt. Tasks werden ausschließlich in Beads geführt. Diese
Datei ist der geordnete Plan und keine zweite Aufgaben-Checkliste.

Der bestehende `tasks/plan.md`-Eintrag zur bereits umgesetzten i18n-Arbeit wird
durch diesen aktuellen Initiativenplan ersetzt; die fachliche Historie bleibt
in Git und der zugehörigen Spec dokumentiert.

## Architecture Decisions

- Unistyles v3 ist die einzige Styling-Runtime im Zielzustand.
- `src/components/theme/index.ts`, `ThemeProvider.tsx` und
  `src/constants/ui.tsx` bleiben die einzigen zentralen Design-System-Owner.
- Die Migration ist inkrementell. Der Mischbetrieb ist nur eine kurzlebige
  Übergangsgrenze und kein zulässiger Abschluss.
- Semantische Darstellung wird nicht mechanisch in neue Klassen übertragen.
  Verbraucher verwenden zentrale Primitive und typed native Styles.
- Native Integrationen wie FlashList, SVG, `expo-image`, Bottom Sheets und
  Reanimated behalten ihre tatsächlichen Style-Grenzen.
- Beads ist der externe Task-Tracker; `tasks/todo.md` wird nicht angelegt.

## Dependency Graph

```text
fam-978.1 → fam-978.2 → fam-978.3
                    ↓
                 fam-978.4 → fam-978.5 → fam-978.6
                                      ↓
                           fam-978.7 → fam-978.8
                                      ↓
                  fam-978.9 / .10 / .11 / .12 / .13
                                      ↓
                  fam-978.14 … .46, .61 … .64
                                      ↓
                           fam-978.65 → fam-978.66 → fam-978.67
                                      ↓
                                   fam-978.68
```

Die Consumer-Slices `.14` bis `.46` und `.61` bis `.64` sind nach Shared UI
untereinander unabhängig und können domänenweise parallel bearbeitet werden.
Retirement wartet auf alle Consumer-Slices.

## Task List

### Phase 1: Migration Contract

1. `fam-978.1` AGENTS und CLAUDE auf den Unistyles-Endzustand ausrichten.
2. `fam-978.2` Aktive Design-System-Verträge aktualisieren.
3. `fam-978.3` NativeWind-ADR supersedieren und Interaktionsverträge anpassen.

### Phase 2: Unistyles Foundation

4. `fam-978.4` Offizielle v3-Kompatibilität und native Voraussetzungen
   verifizieren.
5. `fam-978.5` Unistyles-Dependency sowie Babel-/Metro-Grundlage ergänzen,
   ohne Legacy-Verbraucher zu entfernen.
6. `fam-978.6` Native Artefakte regenerieren und Fingerprint-Auswirkung prüfen.

### Checkpoint: Foundation

- Kompatibilität ist belegt.
- Config-, Typecheck- und Biome-Gates sind grün.
- Der Dev-Client-Rebuild ist für die native Änderung eingeplant.

### Phase 3: Design-System Core

7. `fam-978.7` Theme-Tokens und Runtime migrieren.
8. `fam-978.8` Semantische UI-Primitiven migrieren.

### Phase 4: Shared UI

9. `fam-978.9` Datum-/Zeit-Fields.
10. `fam-978.10` Wheel-Picker und Animated-Icon-Varianten.
11. `fam-978.11` Gemeinsame Icons, Heading, Overlay und Cards.
12. `fam-978.12` Product-, Progress-, Quantity- und Snackbar-Komponenten.
13. `fam-978.13` Buttons und reale Pressable-Gerätegrenzen.

### Checkpoint: Core und Shared UI

- Die drei Owner enthalten keine aktive NativeWind-API.
- Alle Shared-Slices bestehen fokussierte Tests, `bun run check` und
  `bun run typecheck`.
- iOS-/Android-Stichproben belegen essenzielle interaktive Flächen.

### Phase 5: Feature Consumers

14. `fam-978.14` und `.15` Auth.
15. `fam-978.16` und `.17` Calorie Tracking.
16. `fam-978.18` Feedback.
17. `fam-978.19` und `.20` GLP-1.
18. `fam-978.21` und `.22` Household.
19. `fam-978.23` bis `.26` Inventory.
20. `fam-978.27` und `.28` Meal Planner.
21. `fam-978.29` und `.30` Onboarding.
22. `fam-978.31` Premium.
23. `fam-978.32` bis `.35` Profile.
24. `fam-978.36` bis `.40` Recipes.
25. `fam-978.41` bis `.44` Settings.
26. `fam-978.45`, `.46` und `.61` bis `.63` Shopping List.
27. `fam-978.64` verbleibende Product-Search-Route.

### Checkpoint: Alle Consumers

- Abschlusskriterium: Der aktive Scan meldet keine `className`- oder
  `contentContainerClassName`-Verwendung.
- Audit-Stand 2026-09-14: noch nicht erfüllt. Der Scan findet aktive Treffer in
  `inventory-search-field.tsx`, `inventory-item-actions-sheet.tsx`,
  `inventory-item-group-sheet.tsx`, `shopping-mode-screen.tsx` und
  `stores-screen.tsx`.
- Jeder Domänenblock hat seine fokussierten Verhaltenstests bestanden.
- Es gibt keine Änderung an Datenbank, RLS, SQLite, Outbox oder Sync.

### Phase 6: NativeWind Retirement

28. `fam-978.65` NativeWind-/Tailwind-Pakete und unbenutzte Tailwind-Assets
    entfernen.
29. `fam-978.66` NativeWind-Babel-/Metro-Integration entfernen.
30. `fam-978.67` Statisches Removal-Architektur-Gate und aktive Dokumentation
    finalisieren.

### Phase 7: Verification und Release-Nachweis

31. `fam-978.68` iOS-/Android-Migrationsnachweis, fokussierte Gates und
    Fingerprint-/Rebuild-Nachweis abschließen.

## Verification Checkpoints

Nach jedem Beads-Slice:

1. Betroffene fokussierte Tests mit `bun run test <file>`.
2. `bun run check` und `bun run typecheck`.
3. Scan des betroffenen aktiven Bereichs auf verbotene Legacy-APIs.

Vor dem Abschluss:

- `bun run test test/conventions/nativewind-removal.test.ts`
- `bun run native:status -- --diff`
- iOS- und Android-Dev-Client-Nachweise
- Diff-Review in Korrektheit, Lesbarkeit, Architektur, Sicherheit und
  Performance, dokumentiert in Beads `fam-978`.

## Risks and Mitigations

| Risiko | Auswirkung | Mitigation |
| --- | --- | --- |
| Unistyles-/Expo-/Native-Kompatibilität weicht ab | Hoch | Primärquellen-Spike vor Dependency-Änderung, kleiner Foundation-Slice, Fingerprint-Prüfung |
| Semantik geht bei mechanischer Klassenübersetzung verloren | Hoch | Drei Owner bleiben verbindlich; Core zuerst migrieren; fokussierte Verhaltenstests |
| Plattformpaare driften auseinander | Hoch | Android-/iOS-/Shared-Dateien je Slice gemeinsam bearbeiten und prüfen |
| Pressable-Flächen fehlen nur auf Geräten | Hoch | Statische Face-Styles und iOS-/Android-Gerätenachweis, nicht nur Jest |
| Große Consumer-Menge erzeugt Regressionen | Mittel | Domänenweise S-/M-Slices, Gates nach jedem Slice, unabhängige Parallelisierung erst nach Shared UI |
| Historische Docs werden irrtümlich als aktiv genutzt | Mittel | Supersedierendes ADR, aktive Contract-Referenzen, explizite Scan-Ausnahmen |

## Open Questions

- Die exakte Unistyles-v3-Version, Peer-Abhängigkeiten und Edge-to-Edge-Konfiguration
  werden in `fam-978.4` aus offiziellen Quellen festgelegt.
- Der Plan erweitert den bestätigten Scope nicht; neue native Abhängigkeiten,
  visuelle Änderungen oder CI-/Datenbankänderungen erfordern eine erneute
  Maintainer-Entscheidung.

## Approval Gate

Der Plan ist zur menschlichen Abnahme vor Implementierungsbeginn vorzulegen.
Nach Freigabe wird jeweils genau ein Beads-Slice geclaimt, implementiert,
gezielt geprüft und erst dann geschlossen.
