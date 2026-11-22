# Implementation Plan: tracking-large-text-layout

## Overview

Dieser Plan setzt die freigegebenen Requirements und das Design für `tracking-large-text-layout` um. Ziel ist ein vollständig lesbarer und bedienbarer Screen „Mein Tracking“ mit dem manuellen Tagesstart-Modal im bestehenden Expo-/React-Native-/Unistyles-Stack. Die Umsetzung bleibt lokal an der bestehenden Oberfläche: keine neue Tracking-Fachlogik, keine Änderung an Queries, Mutationen, Datenbesitz oder Datenmodellen.

Die Reihenfolge ist verbindlich: zuerst Layout und Scroll-Owner, danach gezielte Regressionen und der deterministische iOS-Harness bei 320 logischen Punkten mit `fontScale === 2`, anschließend die reale iPhone-Abnahme bei 414 pt mit dem tatsächlich gemessenen `fontScale`, zuletzt die Abschlussentscheidung für `fam-qu0f`.

## Scope und feste Grenzen

- Produktänderungen bleiben auf `src/features/profile/tracking-screen.tsx` und die minimal erforderliche optionale Scroll-Ref-Weitergabe in `src/components/layout/screen.tsx` begrenzt.
- Tests bleiben in `src/features/profile/tracking-screen.test.tsx` und `harness/typography-large-text.harness.tsx`.
- Die bestehende Unistyles-Runtime, semantische UI-Primitiven, Schriftgrößen und Texte bleiben erhalten. Keine Hexfarben, keine zweite Styling-Runtime, kein `className`.
- Texttragende Container erhalten keine feste Höhe, keine Einzeilenbegrenzung, kein versteckendes Overflow und keine Schriftverkleinerung. Feste Maße für Touch-Ziele bleiben zulässig.
- Der vorhandene vertikale `Screen`-Scroll-Owner bleibt der einzige vertikale Owner des Tracking Screens. Das Modal erhält nur seine eigene innere vertikale ScrollView.
- Keine Supabase-Schemaänderung, keine manuelle SQL-Datei, kein Datenbank- oder Migrationstask.
- OTA-, Signing- und Build-Probleme werden nicht repariert und verändern die Layout-Akzeptanz nicht.

## Tasks

- [ ] 1. Mein-Tracking-Layout im bestehenden Unistyles-Stack reflow-fähig machen
  - [ ] 1.1 Bestehende Layoutstruktur prüfen und lokale Text-/Makro-/Tagesstart-Regeln in `src/features/profile/tracking-screen.tsx` anpassen
    - Vor der Änderung die texttragenden Container, konkurrierenden Zeilen und das vorhandene Modal gegen die Requirements 1 bis 6 und Designabschnitte 4.1 bis 4.5 prüfen. Die Änderung bleibt auf lokale Styles und Komposition in dieser Datei begrenzt.
    - Für Methodenname, Beschreibung und Status `minWidth: 0`, `flexShrink: 1`, bei Bedarf `flex: 1` und eine obere Ausrichtung verwenden. Beschreibung und Status dürfen umbrechen und bestimmen die Höhe der Methode.
    - Für Kalorienziel, Makro-Bereiche, Tagesstartwert, Presets und Erklärung content-derived heights verwenden. Die drei Makro-Bereiche mit `flexWrap` und Theme-Abständen responsiv anordnen, sodass Label und Wert vollständig erhalten bleiben.
    - Die Tagesstart-Zeile für Wert und Stepper reflow-fähig machen. Die 48-pt-Stepperflächen bleiben als Interaktionsuntergrenze bestehen; nur texttragende Höhen werden dynamisch.
    - Im Day-Start-Modal den Header außerhalb der inneren Scrollfläche halten, den Titel schrumpfen und umbrechen lassen und Eingabe, Erklärung, Validierungsfehler sowie beide Aktionen in einer inneren vertikalen Scrollfläche mit wachsendem Inhalt anordnen.
    - **Akzeptanz:** Alle drei Tracking-Gruppen, Methodeninhalte, Zielwerte, Makro-Bereiche, Tagesstart-Anzeige, Presets, Erklärung und Modalaktionen bleiben im Renderpfad. Kein betroffener Text wird verkleinert, gekürzt, auf eine Zeile gezwungen oder durch Overflow verborgen.
    - **Prüfung:** Der geänderte Code verwendet ausschließlich vorhandene Theme-Werte und Unistyles-Style-Arrays; es gibt keinen Daten-, Query- oder Mutationsdiff.
    - **Dateien:** `src/features/profile/tracking-screen.tsx`
    - **Requirements:** 1.1, 1.2, 1.3, 2.1, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.3, 6.1, 6.2
    - **Abhängigkeit:** keine

  - [ ] 1.2 Den bestehenden Screen- und Modal-Scroll-Owner ausschließlich für den Harness adressierbar machen
    - Die kleinste vom Design erlaubte Schnittstelle verwenden: entweder einen zuverlässig unterstützten nativen Scroll-Selektor nutzen oder, falls dieser den bestehenden Owner nicht deterministisch erreicht, optionale Refs ergänzen.
    - Falls Refs erforderlich sind, `scrollRef?: RefObject<ScrollView | null>` in `src/components/layout/screen.tsx` nur an die bereits vorhandene `ScrollView` im `scroll={true}`-Zweig weiterreichen. `TrackingScreen` erhält dafür einen optionalen `screenScrollRef` und reicht ihn weiter.
    - `TimePicker` erhält analog einen optionalen `modalScrollRef`, der ausschließlich die innere Modal-ScrollView referenziert. Die Produktionsroute setzt keinen dieser Props.
    - Keine zusätzliche äußere vertikale ScrollView, kein Context, kein Testflag, kein Netzwerkadapter und keine Änderung des Default-Verhaltens einführen.
    - **Akzeptanz:** Die normale Route `/profile/tracking` rendert unverändert mit genau einem vertikalen Scroll-Owner pro Oberfläche. Der Harness kann den Screen und das Modal jeweils bis zum Ende scrollen, ohne eine zusätzliche Scrollfläche zu erzeugen.
    - **Prüfung:** Typen der optionalen Refs sind React-Native-ScrollView-Typen; der Prop-Durchgriff ist im gezielten Render-Test nachweisbar.
    - **Dateien:** `src/components/layout/screen.tsx`, `src/features/profile/tracking-screen.tsx`
    - **Requirements:** 5.1, 5.2, 5.3, 7.2, 7.4
    - **Abhängigkeit:** 1.1

- [ ] 2. Gezielte fachliche Regressionen für Tracking und Modal ergänzen
  - [ ]* 2.1 Bestehende RNTL-Abdeckung in `src/features/profile/tracking-screen.test.tsx` um die layoutrelevanten Randzustände erweitern
    - Das bestehende Fixture und alle vorhandenen Beispiele behalten. Einen Zustand ohne `currentGoal` ergänzen und `Nicht festgelegt` sowie alle drei `–`-Platzhalter sichtbar prüfen.
    - Den ungültigen manuellen Tagesstart weiterhin über das echte `TextField` und die echte Übernehmen-Aktion auslösen. Den sichtbaren Alert, die offene Modalfläche und die Erreichbarkeit von Übernehmen und Abbrechen prüfen.
    - Einen Abbrechen-/Schließen-Fall ergänzen, der den ungespeicherten Wert verwirft und keine Startzeit-Mutation auslöst. Den gültigen Fall und die bestehende Normalisierung unverändert behalten.
    - Falls 1.2 optionale Refs einführt, einen kleinen Render-Test für den Prop-Durchgriff auf die vorhandene Screen- und Modal-ScrollView ergänzen, ohne Snapshot des gesamten Screens.
    - **Akzeptanz:** Die Tests prüfen nur zugängliche Rollen, Labels und sichtbare Texte sowie notwendige Flex-Verträge. Kein Test entfernt oder ersetzt einen bestehenden fachlichen Nachweis.
    - **Prüfung:** `bun run test src/features/profile/tracking-screen.test.tsx`
    - **Dateien:** `src/features/profile/tracking-screen.test.tsx`
    - **Requirements:** 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 5.3, 7.3
    - **Abhängigkeit:** 1.2

- [ ] 3. Deterministischen Large-Text-Harness für Tracking ergänzen
  - [ ]* 3.1 Einen festen Tracking-Testaufbau in `harness/typography-large-text.harness.tsx` verdrahten, ohne bestehende Fälle zu ersetzen
    - `TrackingScreen` mit festen Session-, Profil-, Ziel-, Feature-Flag- und Mock-Mutationsdaten rendern. Die Daten müssen einen nichttrivialen Tagesstart, Kalorien- und Makro-Werte, Methodenbeschreibung und Status enthalten; es darf kein Netzwerkzugriff entstehen.
    - Die bestehenden Provider aus der Suite weiterverwenden: i18n, `ThemeProvider` und retry-freier `QueryClient`. Den bestehenden `renderViewport` so nutzen, dass er für Tracking nur misst und nicht mit einer zusätzlichen vertikalen ScrollView den Produkt-Scroll-Owner überlagert.
    - Den bestehenden `captureEvidence`-/`persistScreenshot`-Vertrag weiterverwenden. Vorhandene E-Mail- und Rezept-Tests, ihre Zustände, Scrollaktionen und Artefakte bleiben vollständig erhalten.
    - **Akzeptanz:** Die Suite enthält einen eigenen Tracking-Fall und führt ihn gemeinsam mit allen bestehenden Produktflächen aus. Für den Tracking-Fall gelten weiterhin iOS, Breite 320 und `UnistylesRuntime.fontScale === 2`.
    - **Prüfung:** Der neue Fall verwendet ausschließlich deterministische Fixtures und vorhandene Harness-Hilfen; keine zufälligen UI-Bäume, keine neue Test-Runtime und kein Ersatz vorhandener `it`-Blöcke.
    - **Dateien:** `harness/typography-large-text.harness.tsx`
    - **Requirements:** 7.1, 7.2, 7.3, 7.4
    - **Abhängigkeit:** 2.1

  - [ ]* 3.2 **Property 1: Vollständige content-derived Textdarstellung** als deterministischen UI-Vertrag abdecken
    - Für den Tracking-Screen und das Modal die vollständige Darstellung von Methodenname, Beschreibung, Status, Tagesziel, allen Makro-Labels/-Werten, Tagesstart-Erklärung, Modal-Titel, Eingabefeld, Fehler und Aktionen über Accessibility-Abfragen und die erzeugten Artefakte prüfen.
    - Die Prüfung muss die Zustände mit vorhandenen und fehlenden Zielwerten sowie einen sichtbaren Validierungsfehler berücksichtigen, ohne Schriftgröße oder Textinhalt zu verändern.
    - **Akzeptanz:** Jeder betroffene Text bleibt bei 320 logischen Punkten und `fontScale === 2` vollständig im Produktbaum und im erfassten Zustand erreichbar; die Evidenz enthält Breite, `fontScale`, URI und Byteanzahl.
    - **Property:** Jeder betroffene Textinhalt in jeder vom Harness dargestellten Zielbreite und Schriftstufe erhält eine aus dem umgebrochenen Inhalt abgeleitete Höhe und bleibt ohne Einzeilenbegrenzung oder Clipping vollständig sichtbar.
    - **Validiert:** Requirements 3.1, 3.2, 4.1, 4.3, 4.4, 4.6, 6.1, 6.2; Design Property 1.
    - **Dateien:** `harness/typography-large-text.harness.tsx`
    - **Abhängigkeit:** 3.1

  - [ ]* 3.3 **Property 2: Reflow erhält angrenzende Controls** als deterministischen UI-Vertrag abdecken
    - Den Methodenbereich mit mehrzeiligem Text, den Tagesstartwert zusammen mit dem Stepper sowie den Modal-Header mit Schließen-Button bei 320 pt und `fontScale === 2` prüfen.
    - Nach dem Reflow die angrenzenden Aktionen über ihre Accessibility-Labels suchen und bedienen. Für den Screen den echten Screen-Scroll-Owner und für das Modal die echte innere Modal-ScrollView verwenden.
    - **Akzeptanz:** Textbereiche dürfen innerhalb der verfügbaren Breite schrumpfen und umbrechen; Radio, Stepper, Schließen, Übernehmen und Abbrechen bleiben fokussierbar und erreichbar.
    - **Property:** Jede Text-/Control-Zeile hält das Control innerhalb der Oberfläche erreichbar, während der Textbereich `minWidth: 0` und `flexShrink: 1` nutzen kann.
    - **Validiert:** Requirement 4.2; Design Property 2.
    - **Dateien:** `harness/typography-large-text.harness.tsx`
    - **Abhängigkeit:** 3.2

  - [ ]* 3.4 **Property 3: Responsive Makro-Anordnung** als deterministischen UI-Vertrag abdecken
    - Den Ernährungsbereich bei 320 pt und `fontScale === 2` erfassen und Protein, Carbs sowie Fett jeweils mit vollständigem Label und Wert abfragen.
    - Die Prüfung muss den Wrap-/Stacking-Zustand tolerieren, darf aber keine fehlenden Texte, abgeschnittenen Werte oder feste Textzeilen als gültig akzeptieren. Das bestehende 414-pt-Verhalten bleibt für die spätere Geräteabnahme offen und wird nicht über einen Produktcode-Breitenbranch gelöst.
    - **Akzeptanz:** Alle drei Makro-Bereiche behalten Label und Wert; die Anordnung darf von drei Spalten in mehrere Zeilen wechseln, ohne dass die Bearbeitungsaktion aus dem vertikalen Inhaltsfluss fällt.
    - **Property:** Sobald drei Bereiche nicht vollständig in eine Reihe passen, werden sie responsiv umgebrochen oder gestapelt und behalten ihren vollständigen Inhalt.
    - **Validiert:** Requirement 4.5; Design Property 3.
    - **Dateien:** `harness/typography-large-text.harness.tsx`
    - **Abhängigkeit:** 3.3

  - [ ]* 3.5 **Property 4: Vertikale Reichweite aller Zustände** durch echte Scrollaktionen nachweisen
    - Zustände mit vorhandenem Ziel, methodenspezifischem Inhalt und sichtbarer Modal-Validierung ausführen. Den Tracking Screen über seinen bestehenden Scroll-Owner bis zum Ende scrollen und danach die Rhythmus-/Zeitfenster-Gruppe, Tagesstart-Aktion und untere Inhalte abfragen.
    - Das Modal öffnen, initiale Inhalte erfassen, eine ungültige Zeit eingeben, den Fehler auslösen, die Modal-ScrollView bis zum Ende scrollen und anschließend Fehlermeldung sowie beide Aktionen erneut abfragen.
    - Für initiale, Screen-Ende, Modal-initial, Modal-Validierung und Modal-Ende jeweils `captureEvidence` aufrufen. Keine reine Tree-Anwesenheit ohne Scrollaktion als Nachweis akzeptieren.
    - **Akzeptanz:** Jeder untere Screen-Bereich, jede Modal-Fehlermeldung und beide Modal-Aktionen sind nach dem tatsächlichen Scrollen erreichbar; jeder Tracking-Zustand besitzt ein redigiertes Screenshot-Artefakt mit Breite 320 und gemessenem `fontScale` 2.
    - **Property:** Für jeden dargestellten Tracking-Zustand mit oder ohne Ziel, methodenspezifischem Inhalt oder Validierungsmeldung erreicht der zuständige vertikale Scroll-Owner alle unteren Bereiche und Aktionen.
    - **Validiert:** Requirements 5.1, 5.2, 5.3; Design Property 4.
    - **Dateien:** `harness/typography-large-text.harness.tsx`
    - **Abhängigkeit:** 3.4

- [ ] 4. Checkpoint: Software-Nachweis vor der Geräteabnahme
  - **Akzeptanz:** Die fokussierten Tracking-Tests, der iOS-Harness mit dem bestehenden und dem neuen Fall, `bun run typecheck` und `bun run check` bestehen. Ein fehlendes Ziel, ein Runner-Fehler oder ein fehlendes Artefakt wird nicht als Layout-Erfolg gewertet.
  - **Prüfung:** `bun run test src/features/profile/tracking-screen.test.tsx`; `bun --env-file=.env.development.local run harness:run -- --harnessRunner ios --testPathPatterns=typography-large-text`; `bun run typecheck`; `bun run check`.
  - **Scope-Grenze:** Keine vollständige Testsuite, kein SQL-/Datenbanklauf und keine Reparatur von OTA-, Signing- oder Build-Problemen in diesem Featurepass.
  - **Abhängigkeit:** 3.5

- [ ] 5. Native iPhone-Abnahme bei 414 pt mit tatsächlichem `fontScale` durchführen
  - [ ] 5.1 Screen und Day-Start-Modal auf dem bestätigten physischen iPhone vollständig prüfen und die Runtime-Evidenz ablegen
    - Vor der Abnahme die Geräteidentität gegen die erlaubte physische iPhone-UDID `00008030-001C38C41430802E` prüfen. Keinen Simulator und kein Android-Ziel als Ersatz verwenden.
    - Die logische Breite zur Laufzeit messen und exakt 414 pt im Nachweis festhalten. Den tatsächlich beobachteten nativen `fontScale` aus der Runtime-Evidenz dokumentieren; `fontScale` darf nicht auf 2,0 vorausgesetzt oder zur Abnahme künstlich gesetzt werden.
    - „Mein Tracking“ von oben nach unten mit großer iOS-Schrift prüfen: Methodenname, Beschreibung, Status, Tagesziel, alle Makro-Labels/-Werte, Bearbeiten, Tagesstartwert, Stepper, Presets und Erklärung müssen innerhalb der horizontalen Grenzen vollständig lesbar und erreichbar sein.
    - Das Day-Start-Modal in den Zuständen initial, mit ungültiger Zeit und am Ende der inneren Scrollfläche bedienen. Titel, Eingabe, Erklärung, Alert, Übernehmen und Abbrechen dürfen nicht überlaufen, clippen oder verborgen sein.
    - Screenshots und Runtime-Pfade zusammen mit Breite und tatsächlichem `fontScale` in `.agents/evidence/fam-qu0f-tracking-large-text-414.md` dokumentieren. Der Gerätepass enthält nur diese iPhone-Abnahme und keine zusätzlichen Android-, Simulator-, Typecheck-, Biome- oder Jest-Läufe.
    - **Akzeptanz:** Der Report enthält die gemessene Breite `414`, den tatsächlichen numerischen `fontScale`, die Zustände und die tatsächlichen Artefaktpfade. Ein Geräte-/Runner-/Signing-/Build-Blocker bleibt als externer Nachweisblocker dokumentiert; er schwächt die Layoutbedingungen nicht ab und erlaubt keine vorzeitige Schließung.
    - **Dateien/Artefakte:** `.agents/evidence/fam-qu0f-tracking-large-text-414.md` sowie die zugehörigen redigierten Runtime-Screenshots.
    - **Requirements:** 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 6.1, 6.2, 8.1, 8.2, 8.3
    - **Abhängigkeit:** 4

- [ ] 6. Finaler Abschluss-Checkpoint für `fam-qu0f`
  - `fam-qu0f` darf erst geschlossen werden, wenn 1. das Layoutreview abgeschlossen ist, 2. der deterministische iOS-Harness alle bestehenden E-Mail-/Rezeptnachweise und den neuen Tracking-Fall bei 320 pt mit `fontScale === 2` bestanden hat, 3. der Report der physischen iPhone-Abnahme die gemessenen 414 pt und den tatsächlichen `fontScale` enthält und 4. Screen sowie Modal vollständig erreichbar und ohne Clipping nachgewiesen sind.
  - Bei fehlendem physischem Ziel, fehlenden Screenshot-/Runtime-Pfaden, einem nicht erreichten unteren Zustand oder einem nur durch OTA-, Signing- oder Build-Anpassungen lösbaren Problem bleibt `fam-qu0f` offen.
  - Diese Task-Spezifikation schließt `fam-qu0f` nicht selbst und nimmt keine Code-, Datenbank- oder Bead-Änderung vor.
  - **Abhängigkeit:** 5.1

## Notes

- Aufgaben mit `*` sind Test-/Harness-Aufgaben und gemäß Fast-Task-Workflow optional markiert. Fachlich sind sie Bestandteil der angeforderten Abschlussbedingungen; `fam-qu0f` darf ohne die gezielten Regressionen und den deterministischen Tracking-Nachweis nicht geschlossen werden.
- Die Correctness Properties werden wegen nativer React-Native-Geometrie, Font-Metriken und Screenshot-Verhalten als deterministische, property-orientierte Harness-/Vertragsfälle über feste Zustände geprüft. Es wird keine zufällige UI-Baumgenerierung eingeführt. Sollte bei der Implementierung eine reine Layout- oder Zeitfunktion extrahiert werden, erhält nur diese Funktion zusätzlich einen passenden Property-Test.
- Es werden keine neuen Architektur- oder Datenzugriffsschichten eingeführt. Die optionale Scroll-Ref ist ausschließlich Harness-Plumbing und bleibt im normalen Produktpfad ungesetzt.
- Der reale iPhone-Pass ist vom Software-Checkpoint getrennt. Ein gemessener `fontScale` am Gerät ist ein dokumentierter Beobachtungswert, kein Ersatz für den deterministischen `fontScale === 2`-Harness.
- Die vollständige Testsuite ist nicht erforderlich; alle Prüfungen bleiben gezielt und auf die geänderten Oberflächen bezogen.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3"] },
    { "id": 6, "tasks": ["3.4"] },
    { "id": 7, "tasks": ["3.5"] },
    { "id": 8, "tasks": ["4"] },
    { "id": 9, "tasks": ["5.1"] },
    { "id": 10, "tasks": ["6"] }
  ]
}
```
