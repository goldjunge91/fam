# Implementation Plan: NativeWind Styling Stabilisierung

## Status

Phase 1 bis 5 dokumentieren die abgeschlossene historische Implementierung.
Phase 6 ist die aktive, schrittweise Reduktion der NativeWind-Fläche. Normativ
sind ausschließlich `AGENTS.md` und `docs/design-system/contracts/`.

## Overview

Wir ersetzen die fehleranfällige Mischung aus alten `ThemedText`-/`ThemedView`-
Wrappern, semantischen NativeWind-Klassen und dem UI-Referenzcode durch eine
einzige Fam-Lösung. NativeWind bleibt ausschließlich für einfaches statisches
Layout aktiv. Themeabhängige und semantische Werte laufen über die drei
zentralen UI-Quellen. Die alten Wrapper sind nach ausdrücklicher
Maintainer-Freigabe entfernt. Die aktuellen Verträge stehen unter
`docs/design-system/contracts/`; `docs/specs/nativewind-styling/` ist nur noch
historischer Kontext.

Dieser scoped Plan liegt neben dem aktuellen Top-Level-Plan unter
`tasks/plan.md` und überschreibt ihn nicht.

## Architekturentscheidungen

- `src/components/theme/index.ts` wurde die öffentliche Tokenquelle und erhielt
  die Fam-Palette, nicht die fremde Referenzpalette.
- Komponentenbreite, Props und Verhalten aus der Referenz wurden in
  `src/constants/ui.tsx` adaptiert. Direkte Fam-Gegenstücke, Projektimports,
  Haptics und ersetzbare unsichere Typen wurden angepasst.
- `src/components/theme/ThemeProvider.tsx` wurde als Fam-Provider unter einem
  eindeutigen Importalias in `AppProviders` gemountet.
- `useThemedStyles()` wurde der einzige dynamische StyleSheet-Helper.
- `Txt` und `Surface` leben in `src/constants/ui.tsx` und ersetzten
  `ThemedText` beziehungsweise `ThemedView`.
- NativeWind besitzt nur einfaches statisches Layout. `src/global.css` und
  `tailwind.config.js` sind keine Theme-, Typografie- oder Komponentenquelle.
- `src/lib/haptics.ts` blieb die einzige Haptics-Grenze und wird direkt verwendet.
- Die Theme-Präferenz wurde verbindlich über den vorhandenen MMKV-Gerätespeicher
  aus `src/lib/storage/device-storage.ts` gehalten.
- Alte Wrapper-Dateien wurden nach ausdrücklicher manueller Maintainer-Freigabe
  entfernt; die Übergangstests verwenden jetzt `Txt` und `Surface`.
- Die damals bereitgestellten externen Dateien wurden als Referenz adaptiert,
  nicht unverändert kopiert.

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
                                      +--> alte Wrapper nach Freigabe entfernen
                                              |
                                              +--> statische und visuelle Abnahme
```

## Task List

### Phase 1: Foundation

- [x] Task 1: Fam-Tokenvertrag in `index.ts` konsolidieren.
- [x] Task 2: Fam-ThemeProvider an den existierenden Gerätespeicher und App-Provider anbinden.
- [x] Task 3: `ui.tsx` typisieren und Haptics korrekt anbinden.

### Checkpoint: Foundation

- [x] Fam-Provider ist genau einmal im App-Tree gemountet.
- [x] Menschliche Review der Token- und Provider-API vor der Massenmigration.

### Phase 2: Core component migration

- [x] Task 4: `Txt` und `Surface` implementieren; die alten Wrapper sind nach Freigabe entfernt.
- [x] Task 5: Button-, Press- und IconButton-Verträge stabilisieren.
- [x] Task 6: Card-, Field-, Badge-, Pill-, SegmentedControl- und EmptyState-Verträge stabilisieren.

### Checkpoint: Core UI

- [x] Fokussierte RNTL-Tests für Typografie, Surface, Buttons und Fields sind grün.
- [x] Light/Dark und disabled/loading/pressed sind in der Referenzprüfung sichtbar korrekt.
- [x] Neue und leicht ersetzbare `any`-Styles sind typisiert; technisch unvermeidbare Bibliotheksausnahmen sind lokal dokumentiert.

### Phase 3: Migration

- [x] Layout-Token-Importmigration: `src/constants/layout.ts` durch vorhandene
  `space`-/`radius`-Tokens aus `src/components/theme/index.ts` ersetzt und die
  unreferenzierte Datei entfernt.
- [x] Task 7: `useTheme`- und Theme-Imports auf die eine Provider-API migrieren.
- [x] Task 8: `ThemedText`-Aufrufe in kleinen Feature-Batches durch `Txt` ersetzen.
- [x] Task 9: `ThemedView`-Aufrufe durch `Surface`, `Card` oder explizites View-Layout ersetzen.
- [x] Task 10: Konfliktierende und ungültige NativeWind-Klassen bereinigen.

### Checkpoint: Migration

- [x] `rg` findet keine Production-Importe aus `themed-text.tsx` oder `themed-view.tsx`.
- [x] `rg` findet keine falschen `~/theme`- oder `~/lib/store`-Imports.
- [x] Spezialkomponenten verwenden `style` statt unwirksamer `className`-Props.
- [x] Bestehende `.android.tsx`-Varianten sind mit ihren gemeinsamen Gegenstücken konsistent.

### Phase 4: Maintainer approval and visual decision checkpoint

- [x] Task 11: Alte Wrapper nach ausdrücklicher Maintainer-Freigabe entfernt.
- [x] Task 12: Zwei statische Screen-Mocks für Dashboard und Essensplaner erstellen und die visuellen Entscheidungen daran prüfen.
- [x] Task 13: Dokumentation des finalen Style-Vertrags und verbleibender Ausnahmen aktualisieren.

### Phase 5: Öffentliche Typografie vereinfachen

- [x] Task 14: `TxtVariant` auf die sieben waivy-nahen Rollen `display`,
      `title`, `heading`, `subheading`, `body`, `label` und `caption`
      reduzieren.
- [x] Alle produktiven Verwendungen der entfernten Rollen direkt zuordnen.
- [x] Komponentenspezifische Typografierezepte für Button, Eingabe und Stepper
      zentral in `src/constants/ui.tsx` belassen, ohne daraus öffentliche
      `Txt`-Varianten zu machen.
- [x] Typografie-Showcase und Verträge auf die tatsächliche API aktualisieren.

### Phase 6: NativeWind-Fläche reduzieren

- [x] `AGENTS.md`, Design-System-Verträge und historische Specs auf die drei
      zentralen UI-Quellen ausrichten.
- [ ] Semantische Farb-, Typografie-, Komponenten- und Zustandsklassen in
      kleinen Feature-Batches aus Produktcode und `src/global.css` migrieren.
- [ ] `tailwind.config.js` auf die für einfaches statisches Layout benötigte
      Konfiguration begrenzen.
- [ ] Nach Abschluss jedes Batches nur nachweislich ungenutzte globale Klassen
      entfernen. Keine vollständige Datei wird gelöscht.

### Checkpoint: Complete

- [ ] Phase 6 vollständig abgeschlossen.
- [ ] `bun run check` erfolgreich.
- [ ] `bun run check:css` erfolgreich.
- [ ] `bun run typecheck` erfolgreich.
- [ ] Betroffene gezielte Tests erfolgreich.
- [x] Zwei statische Screen-Mocks geprüft; Geräteprüfung ist außerhalb dieses Scopes.
- [x] Keine neue Styling-Abhängigkeit und kein Frameworkwechsel.

## Build-Grenze

Für die Dokumentations- und Stylingmigration wird kein nativer Build gestartet.
Ein Build erfolgt nur nach einer neuen ausdrücklichen Freigabe.

## Parallelisierung

- Nach Task 1 und Task 2 können reine Testfälle für Tokens und Provider parallel vorbereitet werden.
- Task 4 bis Task 6 teilen sich `ui.tsx` und müssen deshalb sequenziell oder in einem klar koordinierten Branch bearbeitet werden.
- Feature-Batches in Task 8 und Task 9 können nach der Core-API parallelisiert werden, solange kein Batch dieselbe Datei bearbeitet.
- Provider-, Token- und gemeinsame UI-Dateien werden nicht parallel gegen unterschiedliche APIs geändert.

## Risiken und Gegenmaßnahmen

| Risiko | Auswirkung | Gegenmaßnahme |
| --- | --- | --- |
| Alte ThemedText-Rollen sind semantisch uneinheitlich | Visuelle Regression bei der Migration | explizite Migrationstabelle und Screenshot-Fälle |
| NativeWind- und Inline-Style-Priorität wird falsch eingeschätzt | Farben oder Schriftgrößen verschwinden | Kernsemantik in `src/constants/ui.tsx`, NativeWind nur für Layout |
| ui-Referenzcode wird unverändert übernommen | Fremde Palette und Compile-Fehler | Komponenten, Props und Verhalten behalten, aber nur direkte Fam-Gegenstücke und reale Projektimports ersetzen |
| Provider wird neben dem alten Hook betrieben | Dark Mode bleibt inkonsistent | ein `useTheme`-Export und statischer Importaudit |
| Spezialkomponenten akzeptieren `className` nicht | Styling wirkt nur scheinbar | Boundary-Matrix und echte `style`-Props |
| Plattformdetails bleiben ohne Geräteprüfung unbestätigt | spätere native Abweichung | im Scope dokumentieren und keine Geräteabnahme behaupten |

## Festgelegte Entscheidungen

- Theme-Default ist `system`.
- Feather bleibt in referenznahen Low-Level-Primitiven erhalten;
  feature-facing Icons folgen `FamIcon` und den aktuellen Verträgen.
- Die 3D-Buttontiefe beträgt 4pt.
- NativeWind bleibt installiert, wird aber auf einfaches statisches Layout
  reduziert.

## Definition of Done

Die Arbeit ist erledigt, wenn die aktuellen Verträge unter
`docs/design-system/contracts/` der Implementierung entsprechen, neue Screens
keine semantischen NativeWind-Klassen einführen, der bestehende Migrationsbestand
in kleinen Batches reduziert wurde und die fokussierten statischen Prüfungen
erfolgreich sind. Native Builds und Geräteprüfung sind nicht Teil dieser Phase.
