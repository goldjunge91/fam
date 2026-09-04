# Todo: NativeWind Styling Stabilisierung

## Phase 1: Foundation

## Task 1: Fam-Tokenvertrag konsolidieren

**Description:** Die aktuell ui-geprägte `index.ts` wird auf die bestehende Fam-Farb- und Layoutsprache ausgerichtet. Es bleibt eine öffentliche Tokenquelle.

**Acceptance criteria:**

- [ ] Light/Dark enthalten dieselben semantischen Fam-Schlüssel.
- [ ] Bestehende Fam-Werte aus `src/constants/theme.ts` und `src/constants/layout.ts` bleiben erhalten.
- [ ] Keine ui-Farbwerte werden als Production-Default verwendet.

**Verification:**

- [ ] Token-Unit-Test ausführen.
- [ ] `bun run check` und `bun run typecheck` gezielt prüfen.

**Dependencies:** None

**Files likely touched:**

- `src/components/theme/index.ts`
- `src/components/theme/index.test.ts`
- `docs/specs/nativewind-styling/SPEC-token-contract.md`

**Estimated scope:** Medium

## Task 2: Fam-ThemeProvider integrieren

**Description:** `ThemeProvider.tsx` wird von den nicht vorhandenen Referenzpfaden gelöst, verwendet den vorhandenen MMKV-Gerätespeicher und wird in beiden `AppProviders`-Varianten unter einem Alias gemountet.

**Acceptance criteria:**

- [ ] Kein Import aus `~/lib/store` oder `~/theme` bleibt im Provider.
- [ ] Theme-Präferenz wird über `src/lib/storage/device-storage.ts` in MMKV gespeichert.
- [ ] System-/Light-/Dark-Auflösung ist deterministisch.
- [ ] Es existiert genau ein Fam-Provider im App-Tree.

**Verification:**

- [ ] Provider-Unit-Test für System, Light und Dark.
- [ ] `bun run typecheck`.
- [ ] Keine neue native Dependency hinzufügen.

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

- [ ] Neue und leicht ersetzbare `any`-Typen in `ui.tsx` sind durch sichere React-Native-Typen ersetzt.
- [ ] Unvermeidbare bestehende `any`-Typen sind lokal begrenzt und dokumentiert, nicht als Workaround ausgeweitet.
- [ ] Keine undefinierten Haptic-Funktionen.
- [ ] `ReactNode`, `StyleProp`, `TextStyle` und `ViewStyle` werden korrekt verwendet.

**Verification:**

- [ ] `bun run check`.
- [ ] `bun run typecheck`.
- [ ] gezielter Render-Smoke-Test der Primitive.

**Dependencies:** Tasks 1-2

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/lib/haptics.ts`
- `src/constants/ui.test.tsx`

**Estimated scope:** Medium

## Checkpoint: Foundation review

- [ ] Token-, Provider- und UI-API vom Maintainer geprüft.
- [ ] Keine Implementierung der Feature-Migration starten, wenn die semantischen Namen noch geändert werden sollen.

## Phase 2: Core UI

## Task 4: `Txt` und `Surface` einführen

**Description:** `Txt` erhält die vollständige Fam-Typografietabelle. `Surface` übernimmt die generische themed View-Funktion und dokumentiert semantische Töne.

**Acceptance criteria:**

- [ ] Alle `Typography`-Rollen können dargestellt werden.
- [ ] Caller-Style ist der letzte Style-Eintrag.
- [ ] `Surface` unterstützt page, surface, soft, selected und accent.

**Verification:**

- [ ] Fokussierte RNTL-Tests.
- [ ] `bun run test src/components/theme`.

**Dependencies:** Tasks 1-3

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/constants/ui.test.tsx`
- `src/components/theme/themed-text.test.tsx` nur als Übergang oder neue Testdatei

**Estimated scope:** Medium

## Task 5: Buttons und Press-Verhalten stabilisieren

**Description:** Button, Press und IconButton bekommen deterministische Varianten, Größen, Zustände, Accessibility und Haptics.

**Acceptance criteria:**

- [ ] Hintergrund, Textfarbe und Größe funktionieren für alle Button-Varianten.
- [ ] Disabled und Loading verhindern Aktion und Haptics.
- [ ] Press-Feedback verändert Layout nicht unkontrolliert.

**Verification:**

- [ ] Button-RNTL-Tests.
- [ ] Statischer Mock-Fall für primary, secondary, danger und loading vorbereitet.

**Dependencies:** Task 4

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/constants/ui.test.tsx`
- `src/components/ui/buttons/button.tsx` nur wenn der bestehende App-Button auf das Primitive migriert wird

**Estimated scope:** Medium

## Task 6: Cards, Fields und Status-Primitive stabilisieren

**Description:** Card, Field, Badge, Pill, SegmentedControl, EmptyState und SectionHeading behalten ihre Referenz-Props und ihr Verhalten. Direkte Fam-Gegenstücke werden verwendet, ui-only Werte werden nicht als globale Theme-Tokens exportiert.

**Acceptance criteria:**

- [ ] Card-Surface, Border, Radius und Elevation wechseln mit dem Theme.
- [ ] Field-Label, Placeholder und Textfarbe sind sichtbar korrekt.
- [ ] Selected-, Disabled- und Status-Töne sind semantisch und typisiert.

**Verification:**

- [ ] fokussierte Component-Tests.
- [ ] Referenzprüfung mit Light/Dark.

**Dependencies:** Task 4

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/constants/ui.test.tsx`
- `src/components/ui/card.tsx` nur bei Adaptermigration
- `src/components/forms/text-field.tsx` nur bei Adaptermigration

**Estimated scope:** Large, in Card/Field und Status-Primitive teilen, falls die API noch wächst

## Checkpoint: Core UI review

- [ ] Text, Surface, Card und Button visuell mit Fam-Palette geprüft.
- [ ] Keine ui-Optik versehentlich als neue Designrichtung übernommen.

## Abgeschlossene Layout-Token-Migration

`src/constants/layout.ts` wurde entfernt. Die produktiven Aufrufer verwenden die
bereits vorhandenen Tokens aus `src/components/theme/index.ts`. Die neuen Werte
skalieren weiterhin über den dort vorhandenen responsiven `rs()`-Faktor.

| Alter Token | Alter Wert | Neuer Token | Neuer Wert bei Basisbreite | Änderung |
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
- [ ] Visuelle Prüfung der absichtlich geänderten Abstände und Größen.

## Phase 3: Importmigration

## Task 7: `useTheme`-API vereinheitlichen

**Description:** Bestehende Aufrufer des alten Hooks werden auf den Provider-Vertrag migriert. Der alte Hook bleibt höchstens als dünner, zeitlich begrenzter Re-Export ohne eigene Logik.

**Acceptance criteria:**

- [ ] Kein Screen liest Theme-Farben aus einer zweiten Runtime-Quelle.
- [ ] Provider-Hook und Tokenzugriff sind konsistent.
- [ ] Alias-Importe sind project-konform.

**Verification:**

- [ ] `rg`-Audit auf alte Hook- und Theme-Imports.
- [ ] `bun run typecheck`.

**Dependencies:** Checkpoint Foundation

**Files likely touched:**

- `src/hooks/use-theme.ts`
- maximal vier betroffene Provider-/Screen-Dateien pro Batch

**Estimated scope:** Medium pro Batch

## Task 8: `ThemedText` nach `Txt` migrieren

**Description:** Alle Textaufrufe werden anhand der Migrationstabelle in kleine, überprüfbare Feature-Batches umgestellt. Android-Dateipaare werden jeweils gemeinsam behandelt.

**Acceptance criteria:**

- [ ] Jeder alte Rollenname hat eine bewusste neue Variante.
- [ ] Keine semantische Textfarbe bleibt als widersprüchliche `className`-Kombination bestehen.
- [ ] Feature-Batch rendert mit denselben Größen und Tönen.

**Verification:**

- [ ] Batch-spezifischer RNTL-Test.
- [ ] `rg`-Audit nach jedem Batch.

**Dependencies:** Task 4 und Task 7

**Files likely touched:**

- maximal fünf Dateien pro Feature-Batch unter `src/features/` oder `src/components/`

**Estimated scope:** Large insgesamt, bewusst in S-/M-Batches ausführen

## Task 9: `ThemedView` nach `Surface` oder `Card` migrieren

**Description:** Generische themed Views werden zu `Surface`, echte Karten zu `Card` und reine Layout-Views zu `View` mit NativeWind-Layoutklassen.

**Acceptance criteria:**

- [ ] `lightColor`/`darkColor`-Props werden nicht weiter verwendet.
- [ ] Jeder View-Fall hat eine klare semantische oder reine Layoutabsicht.
- [ ] Keine Hintergrundfarbe wird durch ein zufälliges Utility verdeckt.

**Verification:**

- [ ] Batch-spezifischer Component-Test oder Snapshot-freier Render-Test.
- [ ] Light/Dark in den zwei Screen-Mocks prüfen.

**Dependencies:** Task 4 und Task 7

**Files likely touched:**

- maximal fünf Dateien pro Feature-Batch unter `src/features/` oder `src/components/`

**Estimated scope:** Medium pro Batch

## Task 10: NativeWind-Boundaries bereinigen

**Description:** Unwirksame `className`-Verwendungen an `expo-image`, FlashList, Bottom Sheets, SVG und anderen Spezialkomponenten werden auf `style` oder dokumentierte Adapter umgestellt.

**Acceptance criteria:**

- [ ] Jede Spezialkomponente hat eine echte Style-Übergabe.
- [ ] Nur registrierte Custom Components akzeptieren `className`.
- [ ] Ungültige Token wie `bg-card`, `bg-surface` oder `text-small` sind ersetzt oder explizit registriert.

**Verification:**

- [ ] `rg`-Boundary-Audit.
- [ ] `bun run check:css` und `bun run typecheck`.

**Dependencies:** Tasks 1, 3, 8 und 9

**Files likely touched:**

- maximal fünf betroffene Komponenten pro Batch

**Estimated scope:** Large insgesamt, in Batches ausführen

## Phase 4: Removal and verification

## Task 11: TODO: DELETE alte Wrapper (Maintainer führt das später selbst aus)

**Description:** Nach einem Null-Treffer-Importaudit bleiben `themed-text.tsx` und `themed-view.tsx` bis zur manuellen Freigabe des Maintainers erhalten. Der Maintainer führt das Löschen später selbst aus. Übergangstests werden vorher auf `Txt` und `Surface` verschoben oder angepasst.

**Acceptance criteria:**

- [ ] Keine Production- oder Testimporte zeigen auf die alten Wrapper.
- [ ] TODO: DELETE — Die alten Dateien werden ausschließlich vom Maintainer gelöscht.
- [ ] Keine öffentliche Exportdatei referenziert sie.

**Verification:**

- [ ] `rg "themed-text|themed-view|ThemedText|ThemedView" src` ergibt nur bewusst dokumentierte Historie oder null Treffer.
- [ ] gezielte Theme-Tests.

**Dependencies:** Tasks 8-10

**Files likely touched:**

- `src/components/theme/themed-text.tsx`
- `src/components/theme/themed-view.tsx`
- `src/components/theme/themed-text.test.tsx`
- betroffene Exportdateien, falls vorhanden

**Estimated scope:** Small

## Task 12: Zwei statische Screen-Mocks als Entscheidungsgrundlage

**Description:** Für Dashboard und Essensplaner werden zwei statische Screen-Mocks erstellt. Sie zeigen die Kernfälle mit Fam-Farben, den übernommenen UI-Primitiven, Typografie und Buttonzuständen. Diese Mocks entscheiden, ob die Referenz-3D-Tiefe und andere sichtbare Details unverändert bleiben.

**Acceptance criteria:**

- [ ] Beide Mocks enthalten Light/Dark sowie primary, secondary, ghost, danger, loading und disabled.
- [ ] Typografie, Card-Surface, Hintergrund, Border und Textfarben sind eindeutig vergleichbar.
- [ ] Eine Geräteprüfung wird nicht als erledigt markiert, da sie außerhalb des Scopes liegt.

**Verification:**

- [ ] `bun run check`.
- [ ] `bun run check:css`.
- [ ] `bun run typecheck`.
- [ ] gezielte `bun run test <file>`-Aufrufe.
- [ ] Mock-Review dokumentieren.

**Dependencies:** Task 11

**Files likely touched:**

- `docs/specs/nativewind-styling/mocks/index.html`
- `docs/specs/nativewind-styling/SPEC-verification-matrix.md`
- `docs/design-system/DESIGN_SYSTEM.md` bei dokumentierter Abweichung

**Estimated scope:** Medium

## Task 13: Abschlussdokumentation

**Description:** Die finalen Ausnahmen, Adapter und verbleibenden platform-spezifischen Grenzen werden in der Styling-Dokumentation festgehalten.

**Acceptance criteria:**

- [ ] Ein Maintainer kann anhand der Dokumentation entscheiden, ob `className` oder `style` zu verwenden ist.
- [ ] Keine ui-Referenz wird als aktuelle Produktentscheidung missverstanden.

**Verification:**

- [ ] Dokumentationsreview.

**Dependencies:** Task 12

**Files likely touched:**

- `docs/specs/nativewind-styling/SPEC.md`
- `docs/specs/nativewind-styling/SPEC-native-boundaries.md`
- `docs/design-system/DESIGN_SYSTEM.md`

**Estimated scope:** Small

## Final checkpoint

- [ ] Alle Tasks abgeschlossen.
- [ ] Keine Frameworkänderung.
- [ ] Keine unfreigegebene Dependency oder native Änderung.
- [ ] Erfolgscriteria aus der Spezifikation erfüllt.
