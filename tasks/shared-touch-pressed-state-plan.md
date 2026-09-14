# Umsetzungsplan: Touch- und Pressed-State-Probleme in Shared Components

Status: Zur Umsetzung vorbereitet · 2026-09-14

Beads-Epic: `fam-3nxy`

Die Arbeitspakete werden ausschließlich in Beads geführt. `tasks/todo.md` wird
nicht angelegt. `tasks/plan.md` sowie der separate Plan für
`SectionHeading` bleiben unverändert.

## Overview

Die Shared Components haben derzeit fünf zusammenhängende Interaktionsrisiken:

- `QuantityStepper` nutzt 42-Punkt-Segmente und rohe `Pressable`s ohne
  sichtbares Pressed-Feedback.
- `FilterChipBar` nutzt eine dynamische `style={({ pressed }) => ...}`-Funktion
  und Web-ARIA-Props statt nativer Accessibility-Properties.
- `InlineSelect` nutzt 42 Punkte für den Trigger und rohe `Pressable`s ohne
  klares Pressed-Feedback.
- `IconButton` hat einen Default von 42 Punkten; der Accessibility-Name ist
  optional, obwohl die Komponente ausschließlich Icon-Aktionen rendert.
- `HeaderIconButton` ist als kompakte 39-Punkt-Visualisierung angelegt. Sein
  wirksamer Bereich muss deshalb auf dem Gerät über `hitSlop` nachgewiesen und
  gegen Abschneiden oder Nachbarziele geprüft werden.

Ziel ist ein begrenzter Accessibility- und Device-Test-Slice: reale
Touchbereiche, verständliche native Semantik und verlässliches Pressed-Feedback
über `Press` aus `src/constants/ui.tsx`. Datenbank, Sync, Navigation und native
Abhängigkeiten liegen ausdrücklich außerhalb des Scopes.

## Architecture Decisions

- Ein eigenständiges interaktives Ziel besitzt mindestens 44 × 44 logische
  Einheiten wirksamen Touchbereich. Für `QuantityStepper`, `FilterChipBar`,
  `InlineSelect` und `IconButton` wird diese Grenze an der sichtbaren bzw.
  interaktiven Fläche umgesetzt, nicht nur behauptet.
- `HeaderIconButton` darf die 39-Punkt-Visualisierung behalten, wenn der
  bestehende `hitSlop` einen nicht abgeschnittenen Bereich von mindestens 44
  Punkten sicherstellt und keine Nachbaraktion überlappt. Das ist nur durch
  eine native Stichprobe belegbar; bei negativem Nachweis wird die Basis auf
  44 Punkte angehoben.
- Rohes `Pressable` mit `style={({ pressed }) => ...}` wird in den betroffenen
  Komponenten nicht weitergeführt. `Press` liefert Scale/Haptik und erhält die
  vollständige sichtbare Fläche als statisches Style-Array. Bei Full-Width-
  Segmenten wird zusätzlich `containerStyle` verwendet, damit der äußere
  `Press`-Wrapper die Flexverteilung nicht verändert.
- Filterauswahl meldet `accessibilityRole="button"`, einen verständlichen
  `accessibilityLabel` und `accessibilityState={{ selected }}`. `InlineSelect`
  meldet `expanded`, `selected` und `disabled` jeweils am passenden nativen
  Element. Web-ARIA-Props werden nicht als Ersatz für native Props verwendet.
- `IconButton` bleibt eine kompatible Foundation-API mit vorhandenen
  Farb-/Größen-Overrides. Der Default wird 44; kleinere explizite Größen werden
  effektiv auf mindestens 44 angehoben. Der `accessibilityLabel` wird für die
  Icon-only-API verpflichtend, da alle geprüften Consumer bereits einen
  verständlichen Namen liefern.
- Es wird keine vierte Theme-/Style-Quelle und keine neue allgemeine
  Pressed-State-Abstraktion eingeführt. Semantische Rollen bleiben bei den
  bestehenden Theme-/UI-Ownern; die Komponenten ändern nur Verhalten,
  Komposition und lokales Layout.

## Dependency Graph

```text
fam-3nxy.1 Vertrag und Regression-Gate
        ↓
  ┌─────┼────────┬────────┐
  ↓     ↓        ↓        ↓
 .2    .3       .4       .5
Filter Quantity Inline  Icon-/Header-Buttons
  └─────┴────────┴────────┘
                 ↓
           fam-3nxy.6
     Native Abnahme und Abschluss-Gate
```

`fam-3nxy.2` bis `.5` sind nach dem Contract-Slice unabhängig und können
parallel umgesetzt werden. Der Filter-Slice hat wegen der bekannten
Geräteabhängigkeit der dynamischen Style-Funktion die höchste technische
Priorität. `.6` wartet auf alle vier Component-Slices.

## Task List

### Phase 1: Contract und Regression-Schranke

1. `fam-3nxy.1` · Interaktionsvertrag und Regression-Gate festlegen

   **Beschreibung:** Die bestehenden Verträge werden auf die konkrete
   Component-Gruppe angewendet und ein syntaktisches Gate gegen dynamische
   sichtbare Pressable-Styles ergänzt.

   **Akzeptanzkriterien:**

   - [ ] 44 × 44 wirksamer Touchbereich, native Rolle/Name/State, statische
         sichtbare Fläche und `Press` sind als Regeln für diesen Slice benannt.
   - [ ] `HeaderIconButton` ist als kompakte Ausnahme mit nachweispflichtigem
         Hit-Bereich dokumentiert.
   - [ ] Das Gate deckt alle fünf Component-Dateien ab und meldet jede erneute
         `style={({ pressed }) => ...}`-Verwendung.

   **Voraussichtlich betroffene Dateien:**

   - `docs/design-system/contracts/07-buttons-and-interaction.md`
   - `docs/design-system/contracts/10-accessibility-and-states.md`
   - `test/conventions/shared-touch-contract.test.ts`

   **Verifikation:**

   - `bun run test test/conventions/shared-touch-contract.test.ts --watchman=false --runInBand`
   - `bun run check`
   - `bun run typecheck`

   **Umfang:** Small, drei Dateien.

### Phase 2: Component-Slices

2. `fam-3nxy.2` · `FilterChipBar` auf native Auswahl und statisches Pressed-Feedback umstellen

   **Beschreibung:** Die Optionen verwenden `Press` mit statischer thematischer
   Fläche. Die Auswahlsemantik wird vollständig nativ ausgedrückt.

   **Akzeptanzkriterien:**

   - [ ] `role`, `aria-label` und `aria-pressed` sind aus dem Production-
         Component entfernt; jede Option hat native Rolle, Namen und selected-
         State.
   - [ ] Jede Option besitzt mindestens 44 Punkte wirksame Höhe und ihre
         sichtbare Fläche liegt statisch am interaktiven Element.
   - [ ] Selection-Haptik/Pressed-Feedback, horizontales Scrollen, Auswahl-
         Callback und Light/Dark-Farbrollen bleiben erhalten.

   **Voraussichtlich betroffene Dateien:**

   - `src/components/ui/filter-chip-bar.tsx`
   - `src/components/ui/filter-chip-bar.test.tsx`

   **Verifikation:**

   - Fokussierter RNTL-Test für Rolle, Name, selected-State, Touchziel und
     Callback mit `screen`/`userEvent`.
   - `bun run test src/components/ui/filter-chip-bar.test.tsx --watchman=false --runInBand`
   - `bun run check` und `bun run typecheck`

   **Umfang:** Small, zwei Dateien.

3. `fam-3nxy.3` · `QuantityStepper` auf 44-Punkt-Segmente und `Press` umstellen

   **Beschreibung:** Minus, direkte Eingabe und Plus werden auf die zentrale
   Press-Basis migriert. Die Flex-Verteilung im Full-Width-Modus wird am äußeren
   Press-Wrapper abgesichert.

   **Akzeptanzkriterien:**

   - [ ] Minus-, Eingabe- und Plus-Ziel sind im festen Modus mindestens 44
         Punkte breit; Full-Width verteilt weiterhin alle drei Segmente gleich.
   - [ ] Pressed-/Reduced-Motion-Feedback kommt aus `Press` mit statischen
         Styles; Grenzwerte bleiben sichtbar deaktiviert und nicht aktivierbar.
   - [ ] Adjustable-Label, `min`/`max`/`now`, direkte Eingabe und bestehende
         Callback-Semantik bleiben erhalten.

   **Voraussichtlich betroffene Dateien:**

   - `src/components/ui/quantity-stepper.tsx`
   - `src/components/ui/quantity-stepper.test.tsx`

   **Verifikation:**

   - Fokussierter RNTL-Test für 44-Punkt-Ziele, Full-Width, Disabled und
     Aktivierung.
   - `bun run test src/components/ui/quantity-stepper.test.tsx --watchman=false --runInBand`
   - `bun run check` und `bun run typecheck`

   **Umfang:** Small, zwei Dateien.

4. `fam-3nxy.4` · `InlineSelect` auf 44-Punkt-Controls und native States umstellen

   **Beschreibung:** Trigger und Optionen werden mit statischen `Press`-Flächen
   und nativen Zustandsmeldungen umgesetzt, ohne die bestehende Panel-Komposition
   zu verallgemeinern.

   **Akzeptanzkriterien:**

   - [ ] Trigger und auswählbare Optionen besitzen mindestens 44 Punkte
         wirksame Höhe und klares Pressed-Feedback über `Press`.
   - [ ] `expanded`, `selected` und `disabled` werden am passenden nativen
         interaktiven Element gemeldet; Disabled-Optionen blockieren weiterhin.
   - [ ] Öffnen, Auswahl, Panel-Schließen, Icons, Hinweise und Positionierung
         bleiben erhalten.

   **Voraussichtlich betroffene Dateien:**

   - `src/components/ui/inline-select.tsx`
   - `src/components/ui/inline-select.test.tsx`

   **Verifikation:**

   - Fokussierter RNTL-Test für Öffnen, `expanded`, `selected`, `disabled` und
     Auswahl-Callback.
   - `bun run test src/components/ui/inline-select.test.tsx --watchman=false --runInBand`
   - `bun run check` und `bun run typecheck`

   **Umfang:** Small, zwei Dateien.

5. `fam-3nxy.5` · `IconButton` und `HeaderIconButton` touch- und accessibility-sicher machen

   **Beschreibung:** Die Foundation-API erhält eine sichere Mindestgröße und
   einen verpflichtenden Namen. Der Header bleibt nur dann kompakt, wenn der
   effektive Bereich auf dem Gerät nachweislich funktioniert.

   **Akzeptanzkriterien:**

   - [ ] `IconButton` verwendet 44 als Default und unterschreitet die Grenze
         auch bei kleineren expliziten Größen nicht; `accessibilityLabel` ist
         verpflichtend und Disabled wird nativ gemeldet.
   - [ ] `HeaderIconButton` behält 39 Punkte nur bei nachgewiesenem 44+-Bereich
         ohne Clipping/Overlap; andernfalls wird die Standardvariante auf 44
         angehoben. Beide Varianten nutzen Pressed-Feedback über `Press`.
   - [ ] Bestehende Labels, Modal-Close-/Header-Varianten, Hintergrund- und
         Callback-Verträge der Consumer bleiben erhalten.

   **Voraussichtlich betroffene Dateien:**

   - `src/constants/ui.tsx`
   - `src/constants/ui.test.tsx`
   - `src/components/ui/buttons/header-icon-button.tsx`
   - `src/components/ui/buttons/header-icon-button.test.tsx`

   Consumer-Dateien werden per `rg` und Typecheck auf vollständige Labels und
   unveränderte Aufrufverträge geprüft; Änderungen an Consumern sind nur nötig,
   wenn dieser Scan einen konkreten Verstoß findet.

   **Verifikation:**

   - Fokussierte Tests für Defaultgröße, explizite kleine Größe, Label,
     Disabled, HitSlop, Varianten und Callback.
   - `bun run test src/constants/ui.test.tsx src/components/ui/buttons/header-icon-button.test.tsx --watchman=false --runInBand`
   - `bun run check` und `bun run typecheck`

   **Umfang:** Medium, vier Dateien plus Consumer-Scan.

### Checkpoint: Nach den Component-Slices

- [ ] Alle fünf Komponenten verwenden statische sichtbare Styles; die drei
      bisher rohen Komponenten verwenden `Press`.
- [ ] Native Rollen, Namen und States sind in fokussierten Tests abgedeckt.
- [ ] Kein Component-Slice hat Datenbank-, Sync-, Navigation- oder
      Native-Dependency-Dateien berührt.
- [ ] Die statische Architektur-Schranke ist grün, bevor die Geräteabnahme
      beginnt.

### Phase 3: Native Abnahme und Abschluss-Gate

6. `fam-3nxy.6` · Native Geräteabnahme und Abschluss-Gate durchführen

   **Beschreibung:** Die Jest-Nachweise werden durch reale iOS-/Android-
   Dev-Client-Prüfungen ergänzt. Dabei wird besonders verifiziert, dass die
   sichtbare Fläche auf dem Gerät existiert und Pressed-Feedback nicht nur im
   RNTL-Baum sichtbar ist.

   **Akzeptanzkriterien:**

   - [ ] Verfügbare iOS- und Android-Dev-Clients prüfen Light/Dark, 320/393
         Punkte, große Schrift, VoiceOver/TalkBack und Reduced Motion.
   - [ ] Für alle fünf Komponenten sind Aktivierung, Disabled bzw. selected/
         expanded, Abbruch/Nachbarziel, sichtbare Fläche und Pressed-Feedback
         dokumentiert.
   - [ ] Abschlussreview deckt Korrektheit, Lesbarkeit, Architektur,
         Accessibility/Sicherheit und Performance ab. Nicht verfügbare
         Plattformen werden als fehlender Nachweis dokumentiert.

   **Voraussichtlich betroffene Dateien:**

   - `test/conventions/shared-touch-contract.test.ts`
   - Beads-Abschlussnachweis für die Runtime- und Review-Evidenz

   **Verifikation:**

   - Fokussierte Component- und Convention-Tests
   - `bun run check`
   - `bun run typecheck`
   - Verfügbare iOS-/Android-Dev-Client-Stichprobe; keine Web-Vorschau als
     Ersatz für native Touch-/Screenreader-Nachweise

   **Umfang:** Medium, eine Gate-Datei plus manuelle Plattformprüfung.

## Risks and Mitigations

| Risiko | Auswirkung | Mitigation |
| --- | --- | --- |
| `Press` fügt einen äußeren Animated-Wrapper ein und verändert Flex-/Layout-Verhalten | Mittel | Bei Full-Width-Segmenten `containerStyle` gezielt prüfen; nach jedem Slice Layouttest und native Stichprobe durchführen |
| Eine dynamische Pressed-Funktion bleibt in einer betroffenen Komponente | Hoch | Gemeinsames Convention-Gate und statische Style-Arrays als Akzeptanzkriterium |
| 44-Punkt-Anhebung verändert kompakte Header-/Sheet-Abstände | Mittel | Icon- und Header-Varianten getrennt prüfen; Header-Visualisierung nur bei bestandenem HitSlop-Nachweis kompakt lassen |
| `hitSlop` wird vom Parent abgeschnitten oder überlappt Nachbaraktionen | Hoch | Native Prüfung mit realem Layout; nicht aus Style-/Jest-Assertions ableiten |
| Pflichtiger `IconButton`-Name findet einen bislang übersehenen Consumer | Mittel | Vollständiger `rg`-Scan und Typecheck vor dem Abschluss; fehlende Labels fachlich benennen statt still zu erfinden |
| Farb-/Typografieänderungen vermischen sich mit der Touch-Reparatur | Niedrig | Bestehende Theme-/UI-Owner und Farbrollen wiederverwenden; keine visuelle Neugestaltung im Slice |

## Open Questions

- Keine fachliche Blockade für den Start.
- Die einzige bewusst ergebnisabhängige Entscheidung ist
  `HeaderIconButton`: 39 Punkte bleiben nur bei bestandenem realem HitSlop-
  Nachweis; sonst wird auf 44 angehoben.
- Android ist für den vorherigen SectionHeading-Slice aktuell wegen fehlendem
  `adb` nicht nachgewiesen. Für diesen Slice wird Android erneut geprüft und
  bei gleicher Umgebung offen als fehlender Nachweis dokumentiert, nicht als
  bestanden behauptet.

## Completion Gate

- [ ] Beads `fam-3nxy.1` bis `.6` sind geschlossen.
- [ ] Die fünf Shared Components erfüllen Touch-, native Accessibility- und
      Pressed-State-Vertrag.
- [ ] Fokussierte Tests, Biome, Typecheck und das statische Regression-Gate sind
      grün.
- [ ] Native Nachweise für reale Touchbereiche, Pressed-State, Screenreader,
      große Schrift, Theme und Reduced Motion sind dokumentiert, mit expliziter
      Kennzeichnung nicht verfügbarer Plattformen.
- [ ] Arbeitsbaum und Diff enthalten keine fachfremden Änderungen.
