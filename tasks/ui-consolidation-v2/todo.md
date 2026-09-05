# Todo V2: UI-Konsolidierung mit weniger Code

Status: Entwurf, wartet auf Maintainer-Freigabe  
Initiative: `ui-consolidation-v2`  
Plan: [plan.md](./plan.md)  
Spec: [SPEC.md](../../docs/specs/ui-consolidation/SPEC.md)

## Task 1: V2-Scope in Spec und Contracts korrigieren

**Description:** Die normative Dokumentation wird an die aktuelle Maintainer-
Entscheidung angepasst. Die Pflicht zu neuen `.android`-Dateikopien, Android als
Abnahmegate dieses ersten Schritts und die geplante responsive Token-Laufzeit
werden entfernt. Bestehende plattformspezifische Dateien bleiben normale
Verbraucher, wenn sie einen zu löschenden Export direkt importieren.

**Acceptance criteria:**

- [ ] Spec und Contracts verlangen keine neuen `.android`-Kopien und behaupten keine ungeprüfte Android-Abnahme.
- [ ] Feste logische Tokenwerte und lokales `useWindowDimensions()` bei echtem Layoutbedarf ersetzen die globale `rs()`-Laufzeit als Zielbild.
- [ ] Die drei bestehenden Design-System-Verantwortlichen und der übrige Produktscope bleiben unverändert.

**Verification:**

- [ ] `rg -n "eigenständige.*android|Android-Feature-Kopien|reaktiv.*rs|responsive.*Token" docs/specs/ui-consolidation docs/design-system/contracts` liefert keinen widersprüchlichen Zielvertrag.
- [ ] `git diff --check` ist grün.
- [ ] Manual check: Marco bestätigt die Scope-Auslegung.

**Dependencies:** None

**Files likely touched:**

- `docs/specs/ui-consolidation/SPEC.md`
- `docs/design-system/contracts/02-typography.md`
- `docs/design-system/contracts/03-spacing-and-layout.md`
- `docs/design-system/contracts/05-nativewind-and-stylesheet.md`
- `docs/design-system/contracts/10-accessibility-and-states.md`

**Estimated scope:** Medium (5 files)

## Task 2: Palette und Dichte über statische Mocks entscheiden

**Description:** Vor sichtbaren Änderungen werden mehrere klar unterschiedliche
statische Varianten für die kontrastkorrigierte Mauve-/Creme-Palette sowie die
kritischen Inventory-/Shopping-Zustände bei schmaler Breite und großer Schrift
erstellt. Der Task endet mit Marcos Auswahl und ändert keinen Produktcode.

**Acceptance criteria:**

- [ ] Mindestens drei Varianten zeigen Light, Dark, Fokus/Fehler, Badges und lange deutsche Inhalte.
- [ ] Inventory- und Shopping-Zustände zeigen die geplante Informationsdichte ohne dekorative Card-in-Card-Struktur.
- [ ] Eine ausgewählte Variante und abgelehnte Alternativen sind eindeutig dokumentiert.

**Verification:**

- [ ] Manual check: Varianten sind über die vereinbarte HTML-Kommunikation erreichbar.
- [ ] Manual check: Marco hat Palette und Dichte ausdrücklich ausgewählt.

**Dependencies:** Task 1

**Files likely touched:**

- Keine Produktdateien; Mock-Artefakte außerhalb des Produktcodes

**Estimated scope:** Small (decision artifact)

## Task 3: Tokens und unterstützte Farbpaare vereinfachen

**Description:** Theme-Tokens werden auf feste logische RN-Werte zurückgeführt.
`rs()`, `SCREEN_W` und `IS_TABLET` werden gelöscht, sofern die abschließende
Verbrauchersuche den aktuellen Befund bestätigt. Unterstützte Vordergrund-/
Hintergrundpaare werden zentral kontrastfähig gemacht; Schattenfarben werden
nicht mehr als Text- oder Iconfarbe eingesetzt. Die Showcase-Anzeige wird nur an
die tatsächlich verbleibenden Tokens angepasst.

**Acceptance criteria:**

- [ ] Spacing und Typografie entsprechen bei Systemschriftfaktor 1,0 exakt der vereinbarten Basisskala, ohne importzeitabhängige Fensterbreite.
- [ ] Alle unterstützten informativen Farbpaare erfüllen 4,5:1 und notwendige nichttextliche Zustände 3:1 in Light und Dark.
- [ ] `rs`, `SCREEN_W`, `IS_TABLET` und Schattenfarben als Vordergrund haben keine produktiven Verbraucher mehr.

**Verification:**

- [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/components/theme/index.test.ts`
- [ ] `bun run typecheck` ist grün.
- [ ] Manual check: ausgewählte Palette und Tokenwerte in `/settings/design-system` prüfen.

**Dependencies:** Tasks 1 and 2

**Files likely touched:**

- `src/components/theme/index.ts`
- `src/components/theme/index.test.ts`
- `src/features/settings/dev/design-system/showcase-foundations.tsx`
- `src/features/settings/dev/design-system/showcase-foundations.android.tsx`

**Estimated scope:** Medium (4 files)

## Task 4: Produkt-Button als einzige Verhaltensbasis stabilisieren

**Description:** Der etablierte `Button` unter `src/components/ui/buttons/`
erhält den vollständigen zentralen Vertrag für Varianten, Größen, Loading,
Disabled, Accessibility, Haptik, Ereignisse und Reduced Motion. Gemeinsame Werte
kommen aus Theme und `ui.tsx`; es entsteht kein neuer Wrapper. Der alte Button
bleibt in diesem Task nur so lange bestehen, bis seine zwei Dashboard-Aufrufer
in Task 5 migriert werden können.

**Acceptance criteria:**

- [ ] Der Produkt-Button deckt alle belegten Varianten und Größen mit mindestens 44 × 44 Touchfläche ab.
- [ ] Loading/Disabled blockieren Aktivierung und Haptik; externe Press-Callbacks laufen genau einmal.
- [ ] Reduced Motion entfernt Federüberschwingen und Scale, ohne das Zustandsfeedback zu verlieren.

**Verification:**

- [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/components/ui/buttons/button.test.tsx`
- [ ] `bun run typecheck` ist grün.
- [ ] Manual check: Normal, Pressed, Loading, Disabled und große Schrift im Showcase.

**Dependencies:** Task 3

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/components/ui/buttons/button.tsx`
- `src/components/ui/buttons/button.test.tsx`

**Estimated scope:** Medium (3 files)

## Task 5: Legacy-Button nach Dashboard-Freigabe löschen

**Description:** Nach Freigabe der parallel bearbeiteten Dashboard-Dateien werden
die einzigen echten Aufrufer des `title`-/`sm|md|lg`-Buttons auf den Produkt-
Button umgestellt. Anschließend werden die alte Implementierung und ihre Tests
aus `ui.tsx` entfernt. Es bleibt kein Umbenennungsadapter zurück.

**Acceptance criteria:**

- [ ] Dashboard-Kartenlisten importieren den Produkt-Button mit unverändertem Nutzerverhalten.
- [ ] `ui.tsx` exportiert keinen zweiten `Button`; `title` und `sm|md|lg` sind keine Button-API mehr.
- [ ] Der Produktionsdiff dieses Schritts ist netto negativ.

**Verification:**

- [ ] Import-/JSX-Suche findet keinen Verbraucher des entfernten Buttons.
- [ ] Betroffene Dashboard-Tests und `src/constants/ui.test.tsx` bestehen gezielt.
- [ ] `bun run typecheck` ist grün.

**Dependencies:** Task 4 and release of the parallel dashboard owner

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/constants/ui.test.tsx`
- `src/features/dashboard/components/card-list.tsx`
- `src/features/dashboard/components/card-list.android.tsx`

**Estimated scope:** Medium (4 files)

## Task 6: TextField als einzige Eingabedarstellung konsolidieren

**Description:** `TextField` übernimmt Fokus, Fehler, Disabled, trailing action,
native Props und Ref-Weitergabe auf einer zentralen Rezeptbasis. Das nur in Tests
und Showcase verwendete `Field` aus `ui.tsx` wird entfernt. Die semantischen
Klassen `input-field` und `input-field-error` werden danach nicht mehr benötigt.

**Acceptance criteria:**

- [ ] Fokus und Fehler sind gleichzeitig sichtbar, zugänglich verbunden und verursachen keinen Layoutsprung.
- [ ] Explizite Accessibility-Props, native Events, RHF-/Fokus-Refs und Submit-Verhalten bleiben erhalten.
- [ ] Es existiert keine zweite `Field`-Implementierung und kein reiner Prop-Adapter.

**Verification:**

- [ ] Fokussierte TextField-Tests prüfen Rolle, Name, Fehler, Events, Ref und Disabled.
- [ ] `rg -n "<Field|input-field" src --glob '*.{ts,tsx}'` findet keine aktiven Verbraucher.
- [ ] `bun run typecheck` ist grün.

**Dependencies:** Task 3; run sequentially after Task 5 because both touch `ui.tsx`

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/components/forms/text-field.tsx`
- `src/constants/ui.test.tsx`
- `src/features/settings/dev/design-system/showcase-components.tsx`
- `src/features/settings/dev/design-system/showcase-components.android.tsx`

**Estimated scope:** Medium (5 files)

## Task 7: SegmentedControl als einzige Einzelauswahl konsolidieren

**Description:** Das Produkt-`SegmentedControl` bleibt die einzige Implementierung.
Das ungenutzte Gegenstück aus `ui.tsx` wird entfernt. Die bestehende API wird
vereinfacht: ignorierte Props werden entweder wirksam verwendet oder nach
Verbrauchermigration gelöscht. Rolle und State bleiben passend zur tatsächlichen
Verwendung und werden nicht pauschal als Tab erzwungen.

**Acceptance criteria:**

- [ ] Genau eine Implementierung verwendet `options`, `selected` und `onSelect`.
- [ ] Ausgewählt, Disabled, lange Labels und mindestens 44 Punkte Touchhöhe sind sichtbar und zugänglich korrekt.
- [ ] Ignorierte Props wie das derzeitige `gap`/`labelStyle` bleiben nicht als Schein-API bestehen.

**Verification:**

- [ ] Fokussierte SegmentedControl-Tests prüfen Auswahl, Disabled, Rolle, Label und Callback-Anzahl.
- [ ] Suche findet keinen Import oder JSX-Verbraucher der entfernten Foundation-Variante.
- [ ] `bun run typecheck` ist grün.

**Dependencies:** Task 3; run sequentially after Task 6 because both touch `ui.tsx`

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/components/ui/segmented-control.tsx`
- `src/constants/ui.test.tsx`
- `src/features/settings/dev/design-system/showcase-components.tsx`
- `src/features/settings/dev/design-system/showcase-components.android.tsx`

**Estimated scope:** Medium (5 files)

## Task 8: Card- und EmptyState-Verantwortung bereinigen

**Description:** `Card` behält nur die gerechtfertigte Trennung zwischen zentraler
Darstellung und Produktkomposition. Lokales `active:opacity` wird durch das
gemeinsame Interaktionsrezept ersetzt. Der ausschließlich in Test und Showcase
vorhandene zweite `EmptyState` aus `ui.tsx` wird gelöscht; der Produkt-EmptyState
erhält die benötigte optionale Action-Komposition ohne Domänenlogik.

**Acceptance criteria:**

- [ ] Card-Darstellung existiert einmal; der Produktadapter enthält nur Titel, Footer, Press-Verhalten und lokales Layout.
- [ ] Genau ein `EmptyState` unterstützt Titel, Hinweis, Symbol und optionale bestehende Aktion.
- [ ] Interaktive Cards und Empty-State-Aktionen besitzen verständliche Rolle, Namen und Touchfläche.

**Verification:**

- [ ] Fokussierte Card-/EmptyState-Tests bestehen.
- [ ] Suche findet keine zweite EmptyState-Implementierung oder semantische `active:`-Klasse in der Card.
- [ ] `bun run typecheck` ist grün.

**Dependencies:** Task 3; run sequentially after Task 7 because it touches `ui.tsx`

**Files likely touched:**

- `src/constants/ui.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/empty-state.tsx`
- `src/constants/ui.test.tsx`

**Estimated scope:** Medium (4 files)

## Checkpoint: Kanonische UI

- [ ] Je Vertrag existiert eine Darstellungsimplementierung.
- [ ] Keine neue Dependency, Theme-Schicht, Registry oder Wrapperkette wurde eingeführt.
- [ ] Fokussierte Tests, Typecheck und Biome sind grün.
- [ ] Produktionscode der Core-Konsolidierung ist netto nicht gewachsen oder die Abweichung wurde im Review begründet.
- [ ] Marco prüft den Zwischenstand vor den Screenänderungen.

## Task 9: Inventory-Datenzustände vertikal korrigieren

**Description:** Der bestehende Inventory-Screen wählt Loading, Empty, No Results,
Error und Refresh korrekt aus und verwendet dafür die kanonischen Komponenten.
Vorhandene Daten bleiben bei Refresh oder Offline sichtbar. Es wird kein
allgemeiner Async-Wrapper und keine neue Datenzugriffsschicht eingeführt.

**Acceptance criteria:**

- [ ] Initial Loading, echter Leerstand, Filterleere, Lesefehler und Refresh mit Daten sind unterscheidbar.
- [ ] Fehlender Haushalt und Offline mit lokalen Daten werden nicht als leerer Vorrat ausgegeben.
- [ ] Hinzufügen, Filter zurücksetzen und Retry verwenden ausschließlich die bestehenden zulässigen Wege.

**Verification:**

- [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/features/inventory/inventory-screen.test.tsx`
- [ ] Manual check: ausgewählte Zustände bei 320 Punkten, großer Schrift und Dark Mode auf dem freigegebenen iOS-Pfad.
- [ ] `bun run typecheck` ist grün.

**Dependencies:** Tasks 2, 6, 7 and 8

**Files likely touched:**

- `src/features/inventory/inventory-screen.tsx`
- `src/features/inventory/inventory-screen.test.tsx`

**Estimated scope:** Small (2 files)

## Task 10: Shopping-Datenzustände vertikal korrigieren

**Description:** Der Shopping-Screen erhält dieselbe klare Zustandsauswahl, ohne
Inventory-Code zu kopieren. Vorhandene Daten und Offline-Aktionen bleiben bei
Refresh sichtbar. Mengen-, Preis-, Swipe- und Check-Verhalten bleiben fachlich
unverändert; sichtbare Zeilenänderungen folgen der ausgewählten Mockvariante.

**Acceptance criteria:**

- [ ] Initial Loading, echter Leerstand, Filterleere, Lesefehler und Refresh mit Daten sind unterscheidbar.
- [ ] Produktname, Menge und Preis bleiben bei schmaler Breite und großer Schrift erreichbar, ohne fachliche Berechnung zu ändern.
- [ ] Check/Uncheck, Add/Remove und Retry bleiben getrennte bestehende Aktionen.

**Verification:**

- [ ] Tests pass: `bun run test --runInBand --runTestsByPath src/features/shopping-list/screens/shopping-list-screen.test.tsx`
- [ ] Manual check: ausgewählte Zustände und Zeilenlayout auf dem freigegebenen iOS-Pfad.
- [ ] `bun run typecheck` ist grün.

**Dependencies:** Tasks 2, 6, 7 and 8

**Files likely touched:**

- `src/features/shopping-list/screens/shopping-list-screen.tsx`
- `src/features/shopping-list/screens/shopping-list-screen.test.tsx`

**Estimated scope:** Small (2 files)

## Checkpoint: Hauptflows

- [ ] Inventory und Shopping erfüllen ihre Zustandsmatrix.
- [ ] Ausgewählte Mocks und Produktcode stimmen überein.
- [ ] Bestehende Offline- und Gegenaktionen sind durch fokussierte Tests geschützt.
- [ ] Tasks 9 und 10 haben keine neuen Android-Kopien erzeugt.

## Task 11: Verwaiste CSS-, Token- und Showcase-Bestände löschen

**Description:** Erst nachdem alle direkten Verbraucher migriert sind, werden
nur die dadurch nachweislich ungenutzten semantischen Klassen, CSS-Farbquellen,
Token-Aliase und Legacy-Beispiele entfernt. Die Developer-Referenz zeigt danach
echte kanonische Produktkomponenten statt paralleler Foundation-Varianten. Diese
Aufräumrunde ist keine Freigabe für die übrigen fachfremden 2.000+ CSS-Zeilen.

**Acceptance criteria:**

- [ ] Gelöschte Klassen, Tokens und Legacy-Beispiele haben exakt null aktive Verbraucher.
- [ ] `global.css` und `tailwind.config.js` enthalten für die migrierten Verträge keine zweite semantische Designquelle.
- [ ] Showcase und Produktimporte benennen dieselben kanonischen APIs.

**Verification:**

- [ ] `bun run check:css` ist grün.
- [ ] `bun run typecheck` und die betroffenen Showcase-/Komponententests sind grün.
- [ ] `rg`-Verbrauchersuche für jeden entfernten Namen ist leer.

**Dependencies:** Tasks 5 through 10

**Files likely touched:**

- `src/global.css`
- `tailwind.config.js`
- `src/features/settings/dev/design-system/showcase-components.tsx`
- `src/features/settings/dev/design-system/showcase-components.android.tsx`

**Estimated scope:** Medium (4 files)

## Task 12: Zielgerichtete Abschlussprüfung und Dokumentationsabgleich

**Description:** Der fertige V2-Diff wird gegen Scope, Spec, Contracts und die
Definition of Done geprüft. Es werden nur relevante Tests ausgeführt. Fehlende
Android-Geräteabnahme wird korrekt als nicht im aktuellen Gate geführt und nicht
als bestanden dargestellt.

**Acceptance criteria:**

- [ ] Alle V2-Abnahmekriterien und die anwendbaren Punkte der Definition of Done sind erfüllt.
- [ ] Keine entfernte API, Klasse oder statische Light-/Responsive-Quelle besitzt aktive Verbraucher.
- [ ] Produktcode, Referenz und normative Dokumente beschreiben denselben V2-Endzustand.

**Verification:**

- [ ] Betroffene Tests gezielt mit `bun run test --runInBand --runTestsByPath ...` ausführen.
- [ ] `bun run typecheck`, `bun run check`, `bun run check:css` und `git diff --check` sind grün.
- [ ] Manual check: Themewechsel, große Schrift, Reduced Motion, Fokus/Fehler und Datenzustände auf dem freigegebenen iOS-Pfad.
- [ ] Review: Produktions-LOC der definierten Core-Dateien sind netto nicht gewachsen oder jede Abweichung ist konkret begründet.

**Dependencies:** Task 11

**Files likely touched:**

- Keine Produktdatei vorgesehen; nur notwendige Statuskorrekturen in Plan/Contracts

**Estimated scope:** Extra small (verification only)

## Abschlusscheckpoint

- [ ] Alle Tasks und Checkpoints sind erledigt.
- [ ] Marco hat den fertigen Diff geprüft.
- [ ] Keine ungeprüfte Plattform wird als bestanden geführt.
- [ ] Die Änderung ist bereit für einen separaten Review-Schritt.
