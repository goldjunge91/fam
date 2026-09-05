# Todo: NativeWind Styling Stabilisierung

## Task 14: Öffentliche Typografie vereinfachen

**Description:** Die gewachsene `Txt`-API wird auf Waivys sieben allgemeine
Rollen reduziert. Technische Größen einzelner Komponenten bleiben intern.

**Acceptance criteria:**

- [x] `TxtVariant` enthält ausschließlich `display`, `title`, `heading`,
      `subheading`, `body`, `label` und `caption`.
- [x] `bodySmall`, `bodyLarge`, `bodyRelaxed`, `control*`, `page*`,
      `stepper*`, `ringValue`, `metricValue`, `navigationArrow`,
      `captionCompact`, `detail`, `micro`, `link`, `code` und `meta` sind aus
      der öffentlichen API entfernt.
- [x] Der Design-System-Screen zeigt nur die sieben öffentlichen Varianten.
- [x] Der Typografievertrag dokumentiert die erlaubte Verwendung und die
      Zuordnung der entfernten Rollen.

**Verification:**

- [x] Produktiver Aufrufer-Audit mit `rg`.
- [x] Fokussierter Biome-Check der zentralen und reparierten Dateien.
- Nicht ausgeführt: Build, Typecheck und Tests waren in diesem Arbeitsschritt
  nicht Teil der Freigabe.

## Phase 1: Foundation

## Task 1: Fam-Tokenvertrag konsolidieren

**Description:** Die aktuell ui-geprägte `index.ts` wird auf die bestehende Fam-Farb- und Layoutsprache ausgerichtet. Es bleibt eine öffentliche Tokenquelle.

**Acceptance criteria:**

- [x] Light/Dark enthalten dieselben semantischen Fam-Schlüssel.
- [x] Bestehende Fam-Werte aus `src/constants/theme.ts` und `src/constants/layout.ts` bleiben erhalten.
- [x] Keine ui-Farbwerte werden als Production-Default verwendet.

**Verification:**

- [x] Token-Unit-Test ausführen.
- [x] `bun run check` und `bun run typecheck` gezielt prüfen.

**Dependencies:** None

**Files likely touched:**

- `src/components/theme/index.ts`
- `src/components/theme/index.test.ts`
- `docs/specs/nativewind-styling/SPEC-token-contract.md`

**Estimated scope:** Medium

## Task 2: Fam-ThemeProvider integrieren

**Description:** `ThemeProvider.tsx` wird von den nicht vorhandenen Referenzpfaden gelöst, verwendet den vorhandenen MMKV-Gerätespeicher und wird in beiden `AppProviders`-Varianten unter einem Alias gemountet.

**Acceptance criteria:**

- [x] Kein Import aus `~/lib/store` oder `~/theme` bleibt im Provider.
- [x] Theme-Präferenz wird über `src/lib/storage/device-storage.ts` in MMKV gespeichert.
- [x] System-/Light-/Dark-Auflösung ist deterministisch.
- [x] Es existiert genau ein Fam-Provider im App-Tree.

**Verification:**

- [x] Provider-Unit-Test für System, Light und Dark.
- [x] `bun run typecheck`.
- [x] Keine neue native Dependency hinzufügen.

**Dependencies:** Task 1

**Files likely touched:**

- `src/components/theme/ThemeProvider.tsx`
- `src/features/app-shell/app-providers.tsx`
- `src/features/app-shell/app-providers.android.tsx`
- `src/lib/storage/device-storage.ts` oder ein kleiner bestehender Storage-Adapter
- `src/components/theme/ThemeProvider.test.tsx`

**Estimated scope:** Large, bei mehr als fünf Dateien in zwei fokussierte Commits teilen

## Task 3: `ui.tsx` typisieren und Haptics verdrahten

**Description:** Die Referenzprimitive bleiben als Struktur erhalten, werden aber auf `@/...`-Imports, React-Native-Typen, Fam-Tokens und `src/lib/haptics.ts` umgestellt.

**Acceptance criteria:**

- [x] Neue und leicht ersetzbare `any`-Typen in `ui.tsx` sind durch sichere React-Native-Typen ersetzt.
- [x] Unvermeidbare bestehende `any`-Typen sind lokal begrenzt und dokumentiert, nicht als Workaround ausgeweitet.
- [x] Keine undefinierten Haptic-Funktionen.
- [x] `ReactNode`, `StyleProp`, `TextStyle` und `ViewStyle` werden korrekt verwendet.

**Verification:**

- [x] `bun run check`.
- [x] `bun run typecheck`.
- [x] gezielter Render-Smoke-Test der Primitive.

**Dependencies:** Tasks 1-2

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/lib/haptics.ts`
- `src/constants/ui.test.tsx`

**Estimated scope:** Medium

## Checkpoint: Foundation review

- [x] Token-, Provider- und UI-API vom Maintainer geprüft.
- [x] Keine Implementierung der Feature-Migration starten, wenn die semantischen Namen noch geändert werden sollen.

## Phase 2: Core UI

## Task 4: `Txt` und `Surface` einführen

**Description:** `Txt` erhält die vollständige Fam-Typografietabelle. `Surface` übernimmt die generische themed View-Funktion und dokumentiert semantische Töne.

**Acceptance criteria:**

- [x] Alle `Typography`-Rollen können dargestellt werden.
- [x] Caller-Style ist der letzte Style-Eintrag.
- [x] `Surface` unterstützt page, surface, soft und accent. Auswahlzustände
      bleiben Aufgabe der interaktiven Komponente.

**Verification:**

- [x] Fokussierte RNTL-Tests.
- [x] `bun run test src/components/theme`.

**Dependencies:** Tasks 1-3

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/constants/ui.test.tsx`
- `src/components/theme/themed-text.test.tsx` nur als Übergang oder neue Testdatei

**Estimated scope:** Medium

## Task 5: Buttons und Press-Verhalten stabilisieren

**Description:** Button, Press und IconButton bekommen deterministische Varianten, Größen, Zustände, Accessibility und Haptics.

**Acceptance criteria:**

- [x] Hintergrund, Textfarbe und Größe funktionieren für alle Button-Varianten.
- [x] Disabled und Loading verhindern Aktion und Haptics.
- [x] Press-Feedback verändert Layout nicht unkontrolliert.

**Verification:**

- [x] Button-RNTL-Tests.
- [x] Statischer Mock-Fall für primary, secondary, danger und loading vorbereitet.

**Dependencies:** Task 4

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/constants/ui.test.tsx`
- `src/components/ui/buttons/button.tsx` nur wenn der bestehende App-Button auf das Primitive migriert wird

**Estimated scope:** Medium

## Task 6: Cards, Fields und Status-Primitive stabilisieren

**Description:** Card, Field, Badge, Pill, SegmentedControl, EmptyState und SectionHeading behalten ihre Referenz-Props und ihr Verhalten. Direkte Fam-Gegenstücke werden verwendet, ui-only Werte werden nicht als globale Theme-Tokens exportiert.

**Acceptance criteria:**

- [x] Card-Surface, Border, Radius und Elevation wechseln mit dem Theme.
- [x] Field-Label, Placeholder und Textfarbe sind sichtbar korrekt.
- [x] Selected-, Disabled- und Status-Töne sind semantisch und typisiert.

**Verification:**

- [x] fokussierte Component-Tests.
- [x] Referenzprüfung mit Light/Dark.

**Dependencies:** Task 4

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/constants/ui.test.tsx`
- `src/components/ui/card.tsx` nur bei Adaptermigration
- `src/components/forms/text-field.tsx` nur bei Adaptermigration

**Estimated scope:** Large, in Card/Field und Status-Primitive teilen, falls die API noch wächst

## Checkpoint: Core UI review

- [x] Text, Surface, Card und Button visuell mit Fam-Palette geprüft.
- [x] Keine ui-Optik versehentlich als neue Designrichtung übernommen.

## Abgeschlossene Layout-Token-Migration

`src/constants/layout.ts` wurde entfernt. Die produktiven Aufrufer verwenden die
bereits vorhandenen Tokens aus `src/components/theme/index.ts`. Die neuen Werte
skalieren weiterhin über den dort vorhandenen responsiven `rs()`-Faktor.

|---|---:|---|---:|---:|
| `Spacing.two` | 8 | `space.sm` | 8 | 0 |
| `Spacing.three` | 16 | `space.lg` | 16 | 0 |
| `Spacing.four` | 24 | `space.xl` | 20 | -4 |
| `Layout.floatingActionClearance` | 64 | `space.xxxl` | 40 | -24 |
| `Layout.floatingActionAreaHeight` | 88 | `space.xl + space.xxxl` | 60 | -28 |
| `IconSize.header` | 20 | `space.xl` | 20 | 0 |
| `IconSize.nav` | 24 | `space.xl` | 20 | -4 |
| `IconSize.xs` | 14 | `space.md` | 12 | -2 |
| `ButtonSize.backArrow` | 45 | `space.xxxl` | 40 | -5 |
| `Radius.sheet` | 20 | `radius.lg` | 20 | 0 |
| `Radius.hairline` | 2 | `radius.sm` | 12 | +10* |

\* `Radius.hairline` wird am 5px hohen Sheet-Handle verwendet. Der neue Wert
führt dort weiterhin zu einer vollständig abgerundeten Kapsel, weil der Radius
praktisch durch die Elementhöhe begrenzt wird.

- [x] Keine produktiven Importe aus `@/constants/layout` verbleiben.
- [x] `src/constants/layout.ts` entfernt.
- [x] `src/constants/ui.tsx` und `src/components/theme/index.ts` unverändert.
- [x] Visuelle Prüfung der absichtlich geänderten Abstände und Größen.

## Phase 3: Importmigration

## Task 7: `useTheme`-API vereinheitlichen

**Description:** Bestehende Aufrufer des alten Hooks werden auf den Provider-Vertrag migriert. Der alte Hook bleibt höchstens als dünner, zeitlich begrenzter Re-Export ohne eigene Logik.

**Acceptance criteria:**

- [x] Kein Screen liest Theme-Farben aus einer zweiten Runtime-Quelle.
- [x] Provider-Hook und Tokenzugriff sind konsistent.
- [x] Alias-Importe sind project-konform.

**Verification:**

- [x] `rg`-Audit auf alte Hook- und Theme-Imports.
- [x] `bun run typecheck`.

**Dependencies:** Checkpoint Foundation

**Files likely touched:**

- `src/hooks/use-theme.ts`
- maximal vier betroffene Provider-/Screen-Dateien pro Batch

**Estimated scope:** Medium pro Batch

## Task 8: `ThemedText` nach `Txt` migrieren

**Description:** Alle Textaufrufe werden anhand der Migrationstabelle in kleine, überprüfbare Feature-Batches umgestellt. Android-Dateipaare werden jeweils gemeinsam behandelt.

**Acceptance criteria:**

- [x] Jeder alte Rollenname hat eine bewusste neue Variante.
- [x] Keine semantische Textfarbe bleibt als widersprüchliche `className`-Kombination bestehen.
- [x] Feature-Batch rendert mit denselben Größen und Tönen.

**Verification:**

- [x] Batch-spezifischer RNTL-Test.
- [x] `rg`-Audit nach jedem Batch.

**Dependencies:** Task 4 und Task 7

**Files likely touched:**

- maximal fünf Dateien pro Feature-Batch unter `src/features/` oder `src/components/`

**Estimated scope:** Large insgesamt, bewusst in S-/M-Batches ausführen

## Task 9: `ThemedView` nach `Surface` oder `Card` migrieren

**Description:** Generische themed Views werden zu `Surface`, echte Karten zu `Card` und reine Layout-Views zu `View` mit NativeWind-Layoutklassen.

**Acceptance criteria:**

- [x] `lightColor`/`darkColor`-Props werden nicht weiter verwendet.
- [x] Jeder View-Fall hat eine klare semantische oder reine Layoutabsicht.
- [x] Keine Hintergrundfarbe wird durch ein zufälliges Utility verdeckt.

**Verification:**

- [x] Batch-spezifischer Component-Test oder Snapshot-freier Render-Test.
- [x] Light/Dark in den zwei Screen-Mocks prüfen.

**Dependencies:** Task 4 und Task 7

**Files likely touched:**

- maximal fünf Dateien pro Feature-Batch unter `src/features/` oder `src/components/`

**Estimated scope:** Medium pro Batch

## Task 10: NativeWind-Boundaries bereinigen

**Description:** Unwirksame `className`-Verwendungen an `expo-image`, FlashList, Bottom Sheets, SVG und anderen Spezialkomponenten werden auf `style` oder dokumentierte Adapter umgestellt.

**Acceptance criteria:**

- [x] Jede Spezialkomponente hat eine echte Style-Übergabe.
- [x] Nur registrierte Custom Components akzeptieren `className`.
- [x] Ungültige Token wie `bg-card`, `bg-surface` oder `text-small` sind ersetzt oder explizit registriert.

**Verification:**

- [x] `rg`-Boundary-Audit.
- [x] `bun run check:css` und `bun run typecheck`.

**Dependencies:** Tasks 1, 3, 8 und 9

**Files likely touched:**

- maximal fünf betroffene Komponenten pro Batch

**Estimated scope:** Large insgesamt, in Batches ausführen

## Phase 4: Maintainer approval and verification

## Task 11: Alte Wrapper nach Maintainer-Freigabe entfernen

**Description:** Nach einem Null-Treffer-Importaudit wurden `themed-text.tsx` und `themed-view.tsx` nach ausdrücklicher Maintainer-Freigabe entfernt. Übergangstests wurden auf `Txt` und `Surface` verschoben oder angepasst.

**Acceptance criteria:**

- [x] Keine Production-Importe zeigen auf die alten Wrapper.
- [x] Übergangstests sind auf `Txt` und `Surface` migriert.
- [x] Die alten Dateien wurden nach ausdrücklicher Maintainer-Freigabe gelöscht.
- [x] Keine öffentliche Exportdatei referenziert sie.

**Verification:**

- [x] `rg "themed-text|themed-view|ThemedText|ThemedView" src` findet keine verbliebenen Quelltextreferenzen.
- [x] gezielte Theme-Tests.

**Dependencies:** Tasks 8-10

**Files likely touched:**

- `src/components/theme/themed-text.test.tsx`
- betroffene Exportdateien, falls vorhanden

**Estimated scope:** Small

## Task 12: Zwei statische Screen-Mocks als Entscheidungsgrundlage

**Description:** Für Dashboard und Essensplaner werden zwei statische Screen-Mocks erstellt. Sie zeigen die Kernfälle mit Fam-Farben, den übernommenen UI-Primitiven, Typografie und Buttonzuständen. Diese Mocks entscheiden, ob die Referenz-3D-Tiefe und andere sichtbare Details unverändert bleiben.

**Acceptance criteria:**

- [x] Beide Mocks enthalten Light/Dark sowie primary, secondary, ghost, danger, loading und disabled.
- [x] Typografie, Card-Surface, Hintergrund, Border und Textfarben sind eindeutig vergleichbar.
- [x] Eine Geräteprüfung wird nicht als erledigt markiert, da sie außerhalb des Scopes liegt.

**Verification:**

- [x] `bun run check`.
- [x] `bun run check:css`.
- [x] `bun run typecheck`.
- [x] gezielte `bun run test <file>`-Aufrufe.
- [x] Mock-Review dokumentieren.

**Dependencies:** Task 11

**Files likely touched:**

- `docs/specs/nativewind-styling/mocks/index.html`
- `docs/specs/nativewind-styling/SPEC-verification-matrix.md`
- `docs/design-system/DESIGN_SYSTEM.md` bei dokumentierter Abweichung

**Estimated scope:** Medium

## Task 13: Abschlussdokumentation

**Description:** Die finalen Ausnahmen, Adapter und verbleibenden platform-spezifischen Grenzen werden in der Styling-Dokumentation festgehalten.

**Acceptance criteria:**

- [x] Ein Maintainer kann anhand der Dokumentation entscheiden, ob `className` oder `style` zu verwenden ist.
- [x] Keine ui-Referenz wird als aktuelle Produktentscheidung missverstanden.

**Verification:**

- [x] Dokumentationsreview.

**Dependencies:** Task 12

**Files likely touched:**

- `docs/specs/nativewind-styling/SPEC.md`
- `docs/specs/nativewind-styling/SPEC-native-boundaries.md`
- `docs/design-system/DESIGN_SYSTEM.md`

**Estimated scope:** Small

## Final checkpoint

- [x] Alle Tasks abgeschlossen.
- [x] Keine Frameworkänderung.
- [x] Keine unfreigegebene Dependency oder native Änderung.
- [x] Erfolgskriterien aus der Spezifikation erfüllt.

## Ergänzende Designänderung: aktive Drawer-Navigation

- [x] Der geöffnete Drawer markiert den aktuell angezeigten Bereich aus
  `usePathname()`.
- [x] Unterseiten und Expo-Route-Gruppen werden korrekt dem Hauptbereich
  zugeordnet; reine String-Präfixe ohne Pfadgrenze werden nicht verwendet.
- [x] Die Markierung nutzt Fam-Auswahlfläche, stärkeren Text,
  Theme-Akzentfarbe am Icon und `accessibilityState.selected`.
- [x] Gemeinsame und Android-Drawer-Variante bleiben synchron.
- [x] Die Designregel ist in `SPEC.md`, der Verification-Matrix und dem
  Design-System dokumentiert.

**Verification:**

- [x] Fokussierter Drawer-Test: 5/5 Tests bestanden.
- [x] `bun run check` und `bun run typecheck` bestanden.
