# Todo: UI-Konsolidierung (fam-Design-System)

Status: Geplant (bereit zur schrittweisen Ausführung)  
Initiative: `ui-consolidation`  
Hinweis zum Scope: PLAT-01 (Plattformparität / separate `.android.tsx`-Dateien) ist ausdrücklich **out of scope**.  
Zugehöriger Plan: [plan.md](./plan.md)  
Referenzdokumente: [SPEC.md](../../docs/specs/ui-consolidation/SPEC.md), [Contracts](../../docs/design-system/contracts/README.md)

---

## Phase 1: Foundations & Token-Reaktivität

### Task 1.1: Reaktive Skalierung `rs()`, Window-Dimensionen und Spacing-Basisskala
- **Description:** Überarbeitung der Skalierungsfunktion `rs()` in `src/components/theme/index.ts` und Bereitstellung eines reaktiven Hooks bzw. Helpers für Dimensionen (`useWindowDimensions`). Beseitigung der reinen Modulimport-Bindung von `SCREEN_W` für Typografie- und Abstandsmaße. Sicherstellung, dass die Basisskala (`xs` bis `xxxl`) bei Skalierungsfaktor 1,0 unverändert bleibt und Mindesttouchmaße (44pt) nicht unterschritten werden.
- **Acceptance criteria:**
  - [ ] `rs()` skaliert reaktiv basierend auf der aktuellen Fensterbreite, begrenzt auf den Bereich `0.9` bis `1.06`.
  - [ ] `space.xs` bis `space.xxxl` entsprechen exakt der normativen Skala (4, 8, 12, 16, 20, 28, 40) bei Designfaktor 1.0.
  - [ ] Keine statische Importzeit-Konstante erzwingt mehr einen Neustart bei Resize/Rotation.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/components/theme/index.test.ts`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Überprüfung der Token-Werte im Theme-Showcase.
- **Dependencies:** Keine
- **Files likely touched:**
  - `src/components/theme/index.ts`
  - `src/components/theme/index.test.ts`
- **Estimated scope:** Small (2 files)

### Task 1.2: Farbpaare, Schatten-Bereinigung & Kontrast-Härtung
- **Description:** Bereinigung der Farbdefinitionen in `src/components/theme/index.ts` gemäß Vertrag 01 und 04. Striktes Verbot von Schattenfarben (`shadowCard`, `shadowSheet`) als Text- oder Icon-Vordergrundfarben in `makeAccent()` und `makeCategoryTone()`. Einführung geprüfter Text-Farbwerte (`onAccent`, Status-Vordergründe), sodass alle Text-/Flächenpaare die geforderten 4,5:1 (und Nicht-Text 3:1) Kontrast erreichen.
- **Acceptance criteria:**
  - [ ] `makeAccent()` und `makeCategoryTone()` verwenden keine Schattenfarben mehr für Vordergrund/Text.
  - [ ] Status-Farben trennen Füllung und Text, wenn der Hintergrundkontrast < 4,5:1 wäre.
  - [ ] Alle unterstützten Text- und Hintergrund-Paare in Light und Dark erfüllen die Kontrastanforderungen.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/components/theme/index.test.ts`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Kontrastberechnung für alle Paare in Light und Dark validieren.
- **Dependencies:** Task 1.1
- **Files likely touched:**
  - `src/components/theme/index.ts`
  - `src/components/theme/index.test.ts`
- **Estimated scope:** Small (2 files)

### Task 1.3: Typografie-Basisskala & ThemeProvider-Härtung
- **Description:** Angleichung von `font.sizes` und `font.lineHeights` in `src/components/theme/index.ts` an die 7 normativen Basiskategorien (`display`, `title`, `heading`, `subheading`, `body`, `label`, `caption`). Sicherstellung in `src/components/theme/ThemeProvider.tsx`, dass Systemwechsel und explizite Gegenpräferenzen (`light` bei System `dark` und umgekehrt) stabil aufgelöst werden und kein Screen-Remount erzwungen wird.
- **Acceptance criteria:**
  - [ ] Die 7 Basiskategorien stimmen exakt mit Tabelle in Vertrag 02 überein.
  - [ ] `ThemeProvider` unterstützt reibungslosen Theme-Wechsel ohne State-Verlust in Formularen.
  - [ ] Keine statischen Light-Fallback-Exporte versorgen ungeprüft Theme-Zustände.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/components/theme/themed-text.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Manueller Theme-Toggle im Simulator/Web.
- **Dependencies:** Task 1.2
- **Files likely touched:**
  - `src/components/theme/index.ts`
  - `src/components/theme/ThemeProvider.tsx`
  - `src/components/theme/themed-text.test.tsx`
- **Estimated scope:** Medium (3 files)

### Checkpoint: Foundation & Tokens
- [ ] Alle Unit-Tests unter `src/components/theme/` laufen fehlerfrei durch.
- [ ] `bun run typecheck` ist fehlerfrei.
- [ ] Reaktivität und Kontraste sind rechnerisch abgesichert.

---

## Phase 2: Core Primitives & Produkt-Adapter

### Task 2.1: Einheitliche Button-Basis, Haptik & Reduced Motion
- **Description:** Zusammenführung der Button-Darstellung zwischen `src/constants/ui.tsx` und `src/components/ui/buttons/button.tsx`. Festschreibung von 4pt sichtbarer Tiefe (`BUTTON_DEPTH = 4`) und 4pt Druckweg. Integration der Systempräferenz für `Reduced Motion` (kein Überschwingen/Federung). Mindesttouchfläche 44 × 44 pt für alle Button-Größen (`default`, `large`, `compact`).
- **Acceptance criteria:**
  - [ ] Produktadapter `Button` und primitives `Button` teilen dieselbe Styling- und Animationsbasis.
  - [ ] 4pt Tiefe und Druckweg konsistent umgesetzt; Header-Ausnahme via `flat` unterstützt.
  - [ ] Reduced Motion deaktiviert Federung/Scale und bietet sofortiges/ruhiges Feedback.
  - [ ] Touchziel ist mindestens 44 × 44 pt groß; Loading meldet `busy` und sperrt Haptik/Aktivierung.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/constants/ui.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Klick-, Lade- und Disabled-Verhalten im Dev-Showcase prüfen.
- **Dependencies:** Task 1.3
- **Files likely touched:**
  - `src/constants/ui.tsx`
  - `src/components/ui/buttons/button.tsx`
  - `src/constants/ui.test.tsx`
- **Estimated scope:** Medium (3 files)

### Task 2.2: Gemeinsame Field- & TextField-Eingabebasis mit Fokus & Fehler
- **Description:** Konsolidierung von `Field` (in `ui.tsx`) und `TextField` (in `src/components/forms/text-field.tsx`). Beseitigung der semantischen CSS-Klassen (`input-field`, `input-field-error`). Zentralisierung des Kontur- und Fokusrezepts (1,5pt Basis, 2pt Fokus) mit Geometrieausgleich. Volle Unterstützung von gleichzeitigem Fokus- und Fehlerzustand, Trailing Action, RHF-Refs und KeyboardToolbar-Integration.
- **Acceptance criteria:**
  - [ ] `TextField` nutzt die zentralen Rezepte aus `ui.tsx` statt CSS-Klassen.
  - [ ] Fokus und Fehler können gleichzeitig dargestellt werden ohne Layoutsprung.
  - [ ] Explizite `accessibilityLabel`- und `accessibilityHint`-Eigenschaften bleiben erhalten.
  - [ ] Ref-Fokussierung und native Event-Weitergabe funktionieren ungestört.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/constants/ui.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Formularfeld mit Validierungsfehler fokussieren und testen.
- **Dependencies:** Task 2.1
- **Files likely touched:**
  - `src/constants/ui.tsx`
  - `src/components/forms/text-field.tsx`
  - `src/constants/ui.test.tsx`
- **Estimated scope:** Medium (3 files)

### Task 2.3: SegmentedControl-, Pill- & Badge-Konsolidierung
- **Description:** Vereinheitlichung der Auswahlkomponenten. `src/components/ui/segmented-control.tsx` wird als kanonischer Einstiegspunkt etabliert und die Variante in `ui.tsx` konsolidiert. Sicherstellung korrekter Barrierefreiheitsrollen (`tab` für Ansichten vs. Auswahlliste für Formulare), Mindesttouchzielgröße auch bei kompakten Segmenten, und Unterstützung des Abwählens bei Mehrfachfiltern (`Pill`).
- **Acceptance criteria:**
  - [ ] Genau eine Kern-Implementierung für SegmentedControl mit einheitlicher Prop-Struktur (`options`, `selected`, `onSelect`).
  - [ ] Reale Touchbereiche erreichen mindestens 44 × 44 pt.
  - [ ] `Badge` ist standardmäßig informativ (kein Button) mit geprüften Farbpaaren.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/constants/ui.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Umschalten von Tabs und Formularoptionen.
- **Dependencies:** Task 2.2
- **Files likely touched:**
  - `src/constants/ui.tsx`
  - `src/components/ui/segmented-control.tsx`
- **Estimated scope:** Small (2 files)

### Task 2.4: Surface- & Card-Foundation
- **Description:** Abstimmung von `Surface` (Töne: `page`, `surface`, `soft`, `accent`) und `Card` auf die gemeinsamen Rezepte. Eliminierung dekorativer Card-in-Card-Verschachtelungen in den Produktkomponenten. Sicherstellung, dass antippbare Cards die vollständigen Interaktionskriterien (Fokus, Pressed, keine verschluckten Kind-Aktionen, keine doppelte Haptik) erfüllen.
- **Acceptance criteria:**
  - [ ] `Card` basiert auf der gemeinsamen `Surface`-Foundation und nutzt zentrale Schatten-/Radius-Tokens.
  - [ ] Antippbare Cards melden ihre Rolle korrekt an Barrierefreiheitsdienste.
  - [ ] Kein Screen erfindet eigene weiße Box/Border/Schatten-Kombinationen.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/constants/ui.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Card-Klick und verschachtelte Button-Aktionen prüfen.
- **Dependencies:** Task 2.3
- **Files likely touched:**
  - `src/constants/ui.tsx`
  - `src/components/ui/card/card.tsx` (oder jeweilige Card-Komponente)
- **Estimated scope:** Small (2 files)

### Checkpoint: Core Primitives
- [ ] Alle zentralen UI-Tests in `src/constants/ui.test.tsx` sind grün.
- [ ] Button, TextField, SegmentedControl und Card sind konsolidiert und typsicher.
- [ ] Keine semantischen CSS-Klassen mehr in den Core-Komponenten.

---

## Phase 3: Screen-Layout & Datenzustände

### Task 3.1: Screen-Gerüst, Safe-Area & Scroll-Ownership
- **Description:** Härtung von `src/components/layout/screen.tsx` gemäß Vertrag 09. Sicherstellung der eindeutigen Scroll-Ownership (keine doppelten ScrollViews mit FlashList). Safe-Area-Insets werden genau einmal berücksichtigt. Header wachsen kontrolliert bei Schriftfaktor 2,0 oder langen Titeln, ohne Aktionen abzuschneiden.
- **Acceptance criteria:**
  - [ ] Genau ein verantwortlicher Scrollcontainer pro Screen (keine Verschachtelung von FlashList in ScrollView).
  - [ ] Safe-Area wird konsistent gehandhabt, auch bei eingeblendetem Sync-Banner.
  - [ ] Unterer Freiraum stellt sicher, dass der letzte Listeninhalt über globale Aktionsleisten scrollt.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/components/layout/screen.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Screen mit langer Liste im Simulator scrollen.
- **Dependencies:** Task 2.4
- **Files likely touched:**
  - `src/components/layout/screen.tsx`
  - `src/components/layout/screen.test.tsx`
- **Estimated scope:** Small (2 files)

### Task 3.2: Datenzustände EmptyState & Ruhiges Erstladen
- **Description:** Überarbeitung von `EmptyState` und Ladeindikatoren gemäß STATE-01 und Vertrag 10. Klare Differenzierung zwischen Erstladen (ruhige Platzhalter/Skeletons), echtem Leerzustand (mit Primäraktion), Filter ohne Treffer (Filter zurücksetzen) und Lesefehlern (gezielter Retry). Sicherstellung, dass Offline mit lokalen Daten nicht als Lesefehler angezeigt wird.
- **Acceptance criteria:**
  - [ ] `EmptyState` teilt dieselbe Darstellungsbasis wie das Design-System.
  - [ ] Trennung von Initial Loading, echtem Leerzustand, Filterleere und Fehlerzustand.
  - [ ] Retries triggern nur Leseoperationen, keine doppelten Mutationen.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/constants/ui.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Simuliere Offline- und Fehlerzustände in der Vorratsübersicht.
- **Dependencies:** Task 3.1
- **Files likely touched:**
  - `src/components/ui/empty-state.tsx`
  - `src/constants/ui.tsx`
- **Estimated scope:** Small (2 files)

### Checkpoint: Layout & States
- [ ] `src/components/layout/screen.test.tsx` besteht fehlerfrei.
- [ ] Datenzustände sind auditierbar voneinander getrennt.

---

## Phase 4: Feature-Migration der Kernscreens

### Task 4.1: Vorrat (Inventory-Screen) Migration
- **Description:** Migration des Vorrats-Screens (`src/features/inventory/`) auf die konsolidierten Primitives (`Button`, `TextField`, `SegmentedControl`, `EmptyState`). Beseitigung lokaler semantischer CSS-Klassen und Farb-Overrides.
- **Acceptance criteria:**
  - [ ] Vorrats-Screen nutzt ausschließlich die kanonischen Produkt-APIs.
  - [ ] Erstladen zeigt ruhigen Platzhalter statt leerer weißer Fläche.
  - [ ] Keine semantischen CSS-Klassen oder manuell zusammengebastelten Card-Styles.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/features/inventory/inventory-screen.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Vorratsliste öffnen, nach Kategorien filtern und Ladezustand prüfen.
- **Dependencies:** Task 3.2
- **Files likely touched:**
  - `src/features/inventory/inventory-screen.tsx`
  - `src/features/inventory/inventory-screen.test.tsx`
- **Estimated scope:** Small (2 files)

### Task 4.2: Einkaufsliste (Shopping-List-Screen) Migration
- **Description:** Migration des Einkaufslisten-Screens (`src/features/shopping-list/`) auf die konsolidierten APIs. Beseitigung unvollständiger Ladezustände und semantischer Klassen. Sicherstellung stabiler Zahlen- und Mengenausrichtung.
- **Acceptance criteria:**
  - [ ] Einkaufsliste nutzt kanonische Buttons, Checkboxen/Pills und Eingaben.
  - [ ] Keine leere Fläche beim Erstladen; korrekte Unterscheidung von leerer Liste vs. Ladevorgang.
  - [ ] Konsistente Typografie für Produktnamen, Mengen und Preise.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/features/shopping-list/screens/shopping-list-screen.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Artikel abhaken und filtern.
- **Dependencies:** Task 4.1
- **Files likely touched:**
  - `src/features/shopping-list/screens/shopping-list-screen.tsx`
  - `src/features/shopping-list/screens/shopping-list-screen.test.tsx`
- **Estimated scope:** Small (2 files)

### Task 4.3: Forms-, Settings- & Dashboard-Konsolidierung
- **Description:** Bereinigung der verbliebenen semantischen NativeWind-Klassen in Formularen (`src/components/forms/`), Profile/Settings und Dashboard-Karten. Sicherstellung, dass alle Buttons und Felder die konsolidierten Einstiegspunkte verwenden.
- **Acceptance criteria:**
  - [ ] Formulare verwenden konsolidiertes `TextField` mit einheitlichem Fokus/Fehler.
  - [ ] Profile-Buttons und Header-Actions erfüllen den 44 × 44 pt Touchbereich.
  - [ ] Entfernung harter Farb- und Radiusklassen zugunsten von `ui.tsx`-Rezepten.
- **Verification:**
  - [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/components/ui/buttons/profile-button.test.tsx`
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Profil- und Einstellungsnavigation durchgehen.
- **Dependencies:** Task 4.2
- **Files likely touched:**
  - `src/components/ui/buttons/header-icon-button.tsx`
  - `src/components/ui/buttons/profile-button.tsx`
  - `src/components/forms/form-sheet.tsx` (oder relevante Form-Datei)
- **Estimated scope:** Medium (3 files)

### Checkpoint: Feature-Migration
- [ ] Alle Feature-Tests für Vorrat, Einkaufsliste und UI-Komponenten laufen fehlerfrei.
- [ ] Keine sichtbaren Regressionen in den Hauptflows.

---

## Phase 5: Showcase-Referenz & Abschlussverifikation

### Task 5.1: Showcase-Screen `/settings/design-system` Abgleich
- **Description:** Aktualisierung der Design-System-Referenzseiten unter `src/features/settings/dev/design-system/`. Entfernung paralleler Alt-Varianten; stattdessen Darstellung der kanonischen Produktkomponenten neben klar markierten Gegenbeispielen. Abdeckung aller Töne, Varianten, Zustände (Normal, Focused, Error, Disabled, Loading) in Light und Dark Mode.
- **Acceptance criteria:**
  - [ ] Showcase zeigt alle kanonischen Komponenten und Tokenwerte real an.
  - [ ] Gegenbeispiele sind deutlich als solche gekennzeichnet.
  - [ ] Vollständige Konsolidierung ohne verwaiste Komponentenimporte.
- **Verification:**
  - [ ] Build succeeds: `bun run typecheck`
  - [ ] Manual check: Showcase-Screen in App öffnen, Themes umschalten und inspizieren.
- **Dependencies:** Task 4.3
- **Files likely touched:**
  - `src/features/settings/dev/design-system/showcase-components.tsx`
  - `src/features/settings/dev/design-system/showcase-foundations.tsx`
- **Estimated scope:** Small (2 files)

### Task 5.2: CSS-Cleanup & Legacy-Bereinigung
- **Description:** Bereinigung von `src/global.css` und `tailwind.config.js`. Entfernung ungenutzter semantischer Komponentenklassen (`input-field`, `button-*`), die durch `ui.tsx` ersetzt wurden. Validierung gegen die Tailwind-CLI via `bun run check:css`.
- **Acceptance criteria:**
  - [ ] Keine unbenutzten semantischen Klassen in `src/global.css`.
  - [ ] `bun run check:css` meldet Erfolg ohne Syntax- oder Parser-Fehler.
  - [ ] Keine CSS-Variablen fungieren als parallele Designquelle.
- **Verification:**
  - [ ] Tests pass: `bun run check:css`
  - [ ] Build succeeds: `bun run check`
- **Dependencies:** Task 5.1
- **Files likely touched:**
  - `src/global.css`
  - `tailwind.config.js`
- **Estimated scope:** Small (2 files)

### Task 5.3: End-to-End-Verifikation & Dokumentationsprüfung
- **Description:** Vollständige Überprüfung aller Abnahmekriterien AC-01 bis AC-17 aus `SPEC.md` (unter Ausschluss der separaten `.android.tsx`-Plattformdateien). Ausführung der statischen Code- und Typprüfungen (`biome`, `tsc`), gezielte Test-Suite der betroffenen Module, und Abgleich mit den normativen Verträgen in `docs/design-system/contracts/`.
- **Acceptance criteria:**
  - [ ] `bun run typecheck` ist fehlerfrei.
  - [ ] `bun run check` (Biome) meldet keine Verstöße.
  - [ ] Alle gezielten Tests der betroffenen Dateien bestehen.
  - [ ] Keine offenen Diskrepanzen zwischen Code, Contracts und Showcase.
- **Verification:**
  - [ ] Tests pass:
    ```bash
    bun run test --runInBand --runTestsByPath src/constants/ui.test.tsx src/components/theme/index.test.ts src/components/theme/themed-text.test.tsx src/components/layout/screen.test.tsx src/features/inventory/inventory-screen.test.tsx src/features/shopping-list/screens/shopping-list-screen.test.tsx
    bun run typecheck
    bun run check
    bun run check:css
    git diff --check
    ```
- **Dependencies:** Task 5.2
- **Files likely touched:**
  - Projektweit (nur Verifikation / Dokumentationsstatus)
- **Estimated scope:** XS (1 file: Statusreport / Walkthrough)

### Checkpoint: Abschluss
- [ ] Alle 15 Tasks abgeschlossen und verifiziert.
- [ ] Konsolidierungsziel erreicht: 3 Verantwortliche, kanonische APIs und saubere Barrierefreiheit.
