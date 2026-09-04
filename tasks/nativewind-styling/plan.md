# Implementation Plan: NativeWind Styling Stabilisierung

## Overview

Wir ersetzen die fehleranfällige Mischung aus alten `ThemedText`-/`ThemedView`-Wrappern, unvollständigen NativeWind-Klassen und dem noch nicht integrierten UI-Referenzcode durch eine einzige Fam-Lösung. NativeWind bleibt für deklaratives Layout aktiv. Theme-abhängige Kernwerte und native Spezialfälle laufen über typisierte React-Native-Styles. Die ausführlichen Verträge stehen in `docs/specs/nativewind-styling/`.

Dieses Dokument liegt absichtlich unter `tasks/nativewind-styling/`, weil `tasks/plan.md` bereits zu einer anderen, gelöschten Arbeit gehörte. Die neue Arbeit überschreibt keinen bestehenden unvollständigen Plan.

## Architekturentscheidungen

- `src/components/theme/index.ts` wird die öffentliche Tokenquelle und erhält die Fam-Palette, nicht die andere-Palette.
- Die Komponentenbreite, Props und das Verhalten aus `ui.tsx` bleiben erhalten. Ersetzt werden nur direkte Fam-Gegenstücke, falsche Projektimports, die bereits vorhandene Haptics-Quelle und leicht ersetzbare unsichere Typen.
- `src/components/theme/ThemeProvider.tsx` wird als Fam-Provider unter einem eindeutigen Importalias in `AppProviders` gemountet.
- `useThemedStyles()` ist der einzige dynamische StyleSheet-Helper.
- `Txt` und `Surface` leben in `src/constants/ui.tsx` und ersetzen `ThemedText` beziehungsweise `ThemedView`.
- `src/lib/haptics.ts` bleibt die einzige Haptics-Grenze und wird direkt verwendet.
- Die Theme-Präferenz wird verbindlich über den vorhandenen MMKV-Gerätespeicher aus `src/lib/storage/device-storage.ts` gehalten.
- Alte Dateien werden zuletzt gelöscht, nicht am Anfang. So bleibt jeder Zwischenschritt rückrollbar.
- Die Downloads-Dateien werden als Referenz adaptiert, nicht unverändert kopiert.

## Abhängigkeitsgraph

```text
Fam-Tokens
    |
    +--> ThemeProvider und StyleSheet-Helfer
              |
              +--> Txt und Surface
              |       |
              |       +--> Button, Card, Field, Press
              |
              +--> Provider-Mount und Hook-Migration
                              |
                              +--> Importmigration nach Feature-Batches
                                      |
                                      +--> alte Dateien entfernen
                                              |
                                              +--> statische und visuelle Abnahme
```

## Task List

### Phase 1: Foundation

- [x] Task 1: Fam-Tokenvertrag in `index.ts` konsolidieren.
- [x] Task 2: Fam-ThemeProvider an den existierenden Gerätespeicher und App-Provider anbinden.
- [x] Task 3: `ui.tsx` typisieren und Haptics korrekt anbinden.

### Checkpoint: Foundation

- [ ] Fam-Provider ist genau einmal im App-Tree gemountet.
- [ ] Menschliche Review der Token- und Provider-API vor der Massenmigration.

### Phase 2: Core component migration

<!-- - [ ] Task 4: `Txt` und `Surface` implementieren und die alten Theme-Wrapper-Tests auf den neuen Vertrag übertragen. -->
- [ ] Task 5: Button-, Press- und IconButton-Verträge stabilisieren.
- [ ] Task 6: Card-, Field-, Badge-, Pill-, SegmentedControl- und EmptyState-Verträge stabilisieren.

### Checkpoint: Core UI

- [ ] Fokussierte RNTL-Tests für Typografie, Surface, Buttons und Fields sind grün.
- [ ] Light/Dark und disabled/loading/pressed sind in der Referenzprüfung sichtbar korrekt.
- [ ] Neue und leicht ersetzbare `any`-Styles sind typisiert; technisch unvermeidbare Bibliotheksausnahmen sind lokal dokumentiert.

### Phase 3: Migration

- [x] Layout-Token-Importmigration: `src/constants/layout.ts` durch vorhandene
  `space`-/`radius`-Tokens aus `src/components/theme/index.ts` ersetzt und die
  unreferenzierte Datei entfernt. Die Wertänderungen sind in `todo.md` dokumentiert.
- [ ] Task 7: `useTheme`- und Theme-Imports auf die eine Provider-API migrieren.
- [ ] Task 8: `ThemedText`-Aufrufe in kleinen Feature-Batches durch `Txt` ersetzen.
- [ ] Task 9: `ThemedView`-Aufrufe durch `Surface`, `Card` oder explizites View-Layout ersetzen.
- [ ] Task 10: Konfliktierende und ungültige NativeWind-Klassen bereinigen.

### Checkpoint: Migration

- [ ] `rg` findet keine Production-Importe aus `themed-text.tsx` oder `themed-view.tsx`.
- [ ] `rg` findet keine falschen `~/theme`- oder `~/lib/store`-Imports.
- [ ] Spezialkomponenten verwenden `style` statt unwirksamer `className`-Props.
- [ ] Bestehende `.android.tsx`-Varianten sind mit ihren gemeinsamen Gegenstücken konsistent.

### Phase 4: Removal and visual decision checkpoint

- [ ] Task 11: Alte `themed-text.tsx`- und `themed-view.tsx`-Dateien sowie obsolete Tests entfernen, sobald der Audit null Treffer liefert.
- [ ] Task 12: Zwei statische Screen-Mocks für Dashboard und Essensplaner erstellen und die visuellen Entscheidungen daran prüfen.
- [ ] Task 13: Dokumentation des finalen Style-Vertrags und verbleibender Ausnahmen aktualisieren.

### Checkpoint: Complete

- [ ] `bun run check` erfolgreich.
- [ ] `bun run check:css` erfolgreich.
- [ ] `bun run typecheck` erfolgreich.
- [ ] Betroffene gezielte Tests erfolgreich.
- [ ] Zwei statische Screen-Mocks geprüft; Geräteprüfung ist außerhalb dieses Scopes.
- [ ] Keine neue Styling-Abhängigkeit und kein Frameworkwechsel.

## Parallelisierung

- Nach Task 1 und Task 2 können reine Testfälle für Tokens und Provider parallel vorbereitet werden.
- Task 4 bis Task 6 teilen sich `ui.tsx` und müssen deshalb sequenziell oder in einem klar koordinierten Branch bearbeitet werden.
- Feature-Batches in Task 8 und Task 9 können nach der Core-API parallelisiert werden, solange kein Batch dieselbe Datei bearbeitet.
- Provider-, Token- und gemeinsame UI-Dateien werden nicht parallel gegen unterschiedliche APIs geändert.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Alte ThemedText-Rollen sind semantisch uneinheitlich | Visuelle Regression bei der Migration | explizite Migrationstabelle und Screenshot-Fälle |
| NativeWind- und Inline-Style-Priorität wird falsch eingeschätzt | Farben oder Schriftgrößen verschwinden | Kernsemantik in StyleSheet, Style-Reihenfolge testen |
| Waivy-Referenzcode wird unverändert übernommen | Fremde Palette und Compile-Fehler | Komponenten, Props und Verhalten behalten, aber nur direkte Fam-Gegenstücke und reale Projektimports ersetzen |
| Provider wird neben dem alten Hook betrieben | Dark Mode bleibt inkonsistent | ein `useTheme`-Export und statischer Importaudit |
| Spezialkomponenten akzeptieren `className` nicht | Styling wirkt nur scheinbar | Boundary-Matrix und echte `style`-Props |
| Plattformdetails bleiben ohne Geräteprüfung unbestätigt | spätere native Abweichung | im Scope dokumentieren und keine Geräteabnahme behaupten |

## Open Questions

- Theme-Default: Empfehlung `system`, sofern keine bestehende Nutzerpräferenz festgelegt ist.
- Icon-API: Feather aus der Referenz bleibt erhalten.
- 3D-Buttontiefe: bleibt zunächst erhalten; Entscheidung über sichtbare Anpassungen erfolgt erst anhand der zwei Screen-Mocks.

## Definition of Done

Die Arbeit ist erledigt, wenn alle Success Criteria aus `docs/specs/nativewind-styling/SPEC.md` erfüllt sind, die alten Wrapper nicht mehr importiert werden, die fokussierten Prüfungen erfolgreich sind und die zwei statischen Screen-Mocks die getroffenen visuellen Entscheidungen abbilden. Eine Geräteprüfung ist nicht Teil der Definition of Done.
