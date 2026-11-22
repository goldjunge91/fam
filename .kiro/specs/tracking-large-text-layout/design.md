# Technical Design: tracking-large-text-layout

## Overview

### Ziel und Leitentscheidung

Der Screen `Mein Tracking` soll bei nativer iOS-Großschrift lesbar und vollständig bedienbar bleiben. Die kleinste robuste Lösung bleibt im bestehenden Expo-SDK-57-, React-Native-0.86- und `react-native-unistyles`-Stack:

- Fachlogik, Queries, Mutationen und die Datenverantwortung bleiben unverändert.
- `Screen` bleibt der vertikale Scroll-Owner für den Produkt-Screen.
- `tracking-screen.tsx` erhält nur lokale Layoutanpassungen: content-derived heights, Wrapping, `flexShrink`, responsive Makro-Bereiche und einen eigenen Scroll-Bereich für das Day-Start-Modal.
- Schriftgrößen, Textinhalte und semantische UI-Primitiven bleiben erhalten.
- Der Large-Text-Harness wird um einen deterministischen Tracking-Fall erweitert. Die vorhandenen E-Mail- und Rezeptfälle bleiben bestehen.
- Die reale 414-pt-iPhone-Abnahme bleibt ein eigener Nachweis mit gemessener Breite und tatsächlich gemessenem `fontScale`.

Die zentrale Entscheidung ist, die bestehende Layoutstruktur weiterzuverwenden und nur die beiden Stellen zu entkoppeln, an denen Inhalt aktuell keinen eigenen Wachstums- oder Scrollraum besitzt: die Zeilen mit konkurrierendem Text und Control sowie das Modal ohne innere `ScrollView`.

## Architecture

### Bestand und Grenzen

### 2.1 Bestehende Verträge

- `src/features/profile/tracking-screen.tsx` enthält die komplette Produktfläche, die lokale Auswahl von Tracking-Methode und Tagesstart sowie das interne `TimePicker`-Modal.
- `src/components/layout/screen.tsx` rendert bei `scroll={true}` bereits einen vertikalen `ScrollView`, bewahrt horizontale Abstände und stellt unteren Safe-Area-/Aktionsabstand bereit.
- `SettingsGroup` und `Txt` liefern bestehende semantische Typografie und Flächen. Neue Farben, Schriftrollen oder globalen Abstände werden nicht eingeführt.
- `TextField` stellt den Validierungsfehler als sichtbaren Text mit `accessibilityRole="alert"` dar. Der Fehler muss deshalb als zusätzlicher Inhalt in der Modal-Scrollfläche wachsen können.
- `src/features/profile/tracking-screen.test.tsx` deckt die fachlichen Zustände, Mutationen, Navigation und die bestehende manuelle Zeitvalidierung bereits ab.
- `harness/typography-large-text.harness.tsx` prüft heute auf iOS mit 320 logischen Punkten und `UnistylesRuntime.fontScale === 2`, protokolliert Breite, `fontScale` und Screenshot-Artefakt und führt bereits E-Mail- und Rezeptfälle aus.

### 2.2 Nicht im Umfang

- Keine Änderung an Tracking-Datenmodell, Supabase-Schema, Offline-Schema, API, Query-Cache oder Mutationsemantik.
- Keine Änderung an globalen Theme-Tokens, `Txt`-Varianten, `Button`, `TextField` oder `SettingsGroup`, solange die gezielten Layouttests keinen bestehenden Shared-Primitive-Fehler belegen.
- Keine Schriftverkleinerung, kein `numberOfLines={1}` für betroffene Inhalte, kein `ellipsizeMode`, kein `overflow: 'hidden'` als Überlaufbehebung und kein Ausblenden von Text.
- Keine Ausweitung auf Android oder andere Large-Text-Flächen.
- Keine OTA-, Signing- oder Build-Reparatur im Rahmen dieser Layoutänderung.

## Components and Interfaces

### Zielarchitektur und Verantwortungen

| Oberfläche | Verantwortlicher Ort | Designentscheidung |
|---|---|---|
| Produkt-Layout des Tracking Screens | `src/features/profile/tracking-screen.tsx` | Lokale Unistyles-Regeln werden reflow-fähig. Höhen entstehen aus dem Inhalt. |
| Vertikales Scrollen des Screens | `src/components/layout/screen.tsx` | Bestehenden Scroll-Owner unverändert verwenden. Keine verschachtelte vertikale ScrollView im Screen einführen. |
| Day-Start-Modal | `TimePicker` in `tracking-screen.tsx` | Header bleibt erreichbar; Felder, Erklärung und beide Aktionen liegen in einer inneren, vertikal scrollbaren Fläche. |
| Fachliche Regressionen | `src/features/profile/tracking-screen.test.tsx` | Bestehende Query-, Mutations-, Validierungs- und Navigationsbeispiele behalten, nur layoutrelevante Reichweitenfälle ergänzen. |
| Deterministischer Large-Text-Nachweis | `harness/typography-large-text.harness.tsx` | Bestehende Suite erweitern, nicht ersetzen. Screen- und Modal-Endzustände mit Artefakten erfassen. |
| Reale Abnahme | Acceptance-Report außerhalb des Produktcodes | 414 pt messen, tatsächlichen `fontScale` dokumentieren und erst danach `fam-qu0f` schließen. |

### 3.1 Optionaler Scroll-Testzugang ohne Laufzeitänderung

Der Harness darf `TrackingScreen` nicht in einen zweiten vertikalen `ScrollView` einbetten. Das würde den vorhandenen `Screen`-Scroll-Owner überlagern und könnte einen falschen grünen Nachweis erzeugen.

Für eine deterministische Endposition erhält `Screen` deshalb, falls die Harness-API keinen bestehenden `ScrollView` zuverlässig adressieren kann, einen optionalen `scrollRef`-Prop. Dieser Ref wird nur an die bereits vorhandene `ScrollView` im `scroll={true}`-Zweig weitergereicht und ist im normalen Routing nicht gesetzt. `TrackingScreen` nimmt optional einen `screenScrollRef` an und reicht ihn an `Screen` weiter. Das ändert weder das Default-Verhalten noch die visuelle Laufzeitoberfläche.

Das interne Day-Start-Modal erhält analog einen optionalen `modalScrollRef` für seine eigene `ScrollView`. Beide Props sind ausschließlich Test-Harness-Plumbing. Alternativ darf der Harness vorhandene native Scroll-Selektoren verwenden, wenn die Harness-Version diese zuverlässig unterstützt; die Produktarchitektur bleibt in beiden Fällen bei genau einem vertikalen Scroll-Owner pro Oberfläche.

## Product Code Design

### Produktcode-Design

### 4.1 Screen- und Gruppenlayout

`Screen` bleibt mit `scroll` auf dem Defaultwert. Sein vorhandenes `contentContainerStyle` mit `flexGrow: 1` und unterem Clearance-Abstand bleibt die Grundlage dafür, dass die letzte Tracking-Gruppe inklusive ihrer Aktionen erreichbar ist.

In `tracking-screen.tsx` gelten für texttragende Container folgende Regeln:

- Keine feste `height` für Text-, Methoden- oder Makro-Container.
- `minHeight` wird nur behalten, wenn es ein berührbares Control schützt. Die bisherige `minHeight` der Methodenoption ist für die Textgeometrie nicht erforderlich und wird durch vertikales/horizontales Padding ersetzt.
- `alignItems: 'flex-start'` wird in mehrzeiligen Zeilen bevorzugt, damit die erste Textzeile nicht gegen die Mitte eines Controls ausgerichtet wird.
- `gap` und Padding kommen aus dem aktiven Theme. Die zusätzlichen vertikalen Abstände werden als lokale Komposition in den vorhandenen `groupContent`, `groupContentWide`, `timePicker` und Modal-Stilen gesetzt, nicht als neue Farb- oder Typografieentscheidung.
- Textblöcke bekommen `minWidth: 0`, `flexShrink: 1` und, wo sie den verfügbaren Bereich ausfüllen sollen, `flex: 1`.
- Betroffene `Txt`-Elemente erhalten keine Einzeilenbegrenzung und keinen versteckenden Overflow.

Damit bleibt der Screen bei normaler Schrift unverändert dicht, kann aber bei `fontScale === 2` in der Höhe wachsen.

### 4.2 Tracking-Methoden

Die Methodenoption bleibt eine zugängliche Radio-Aktion. Ihre innere Geometrie wird als flexible Row modelliert:

- Der Methoden-Textblock bleibt `flex: 1`, `minWidth: 0`, `flexShrink: 1`.
- Die Beschreibung darf mehrzeilig werden und bestimmt die Höhe der Option.
- Der Status `Aktiv` oder `Demnächst verfügbar` bleibt ein eigener Textbereich mit `flexShrink: 1` und ausreichendem Abstand. Er darf umbrechen, statt den Beschreibungstext aus dem verfügbaren Raum zu drängen.
- Die Row richtet Inhalte oben aus. Dadurch bleiben Name, Beschreibung und Status bei unterschiedlicher Zeilenanzahl vollständig sichtbar.
- Der GLP-1-Inhalt bleibt unterhalb der ausgewählten Methode. Er erhält keinen eigenen festen Höhenrahmen.

Der Status wird nicht durch ein Icon oder eine kürzere Ersatzbeschriftung kompensiert. Die vorhandenen Accessibility-Rollen und Zustände bleiben unverändert.

### 4.3 Ernährung, Tagesziel und Makro-Bereiche

Das Kalorienziel bleibt ein inhaltlich wachsender Hero-Bereich:

- Der Hero-Container darf in der Höhe wachsen.
- Label und Wert werden innerhalb der verfügbaren Breite zentriert, wobei der Wert selbst die volle Containerbreite zum Wrapping nutzen darf.
- `Nicht festgelegt` und die Makro-Platzhalter `–` bleiben explizite Zustände.

Die drei Makro-Bereiche werden von einer nicht umbrechenden Row zu einer responsiven Wrap-Anordnung:

- Der äußere Bereich verwendet `flexDirection: 'row'`, `flexWrap: 'wrap'`, ausreichendes `gap` und streckt die enthaltenen Bereiche auf ihre jeweilige Zeile.
- Ein Makro-Bereich wächst, schrumpft und besitzt eine kleine lokale Mindestbreite für lesbare Labels. Diese Mindestbreite ist eine horizontale Umbruchschwelle, keine feste Höhe und kein Ersatz für Textskalierung.
- Bei 320 pt entsteht dadurch je nach verfügbarer Breite eine Zwei-/Ein-Spalten-Anordnung. Bei 414 pt kann die Drei-Spalten-Anordnung bestehen bleiben; die Labels und Werte dürfen innerhalb des Bereichs trotzdem mehrzeilig werden.
- Label und Wert bleiben vertikal getrennt. Der Wert erhält keine Einzeilenbegrenzung und keine feste Kartenhöhe.
- Die Bearbeitungsaktion bleibt nach dem Makro-Bereich in derselben vertikalen Inhaltsfolge und profitiert vom vorhandenen Screen-Scroll-Abstand.

Die responsive Anordnung wird ausschließlich über Flexbox und vorhandene Theme-Abstände gelöst. Es wird kein Breiten- oder Font-Scale-Branch im Produktcode eingeführt.

### 4.4 Tagesstart, Presets und Erklärung

Das Tagesstart-Display ist die kritischste gemeinsame Row aus großem Wert und Stepper:

- Der anklickbare Textbereich bleibt flexibel, erhält `minWidth: 0` und `flexShrink: 1` und darf den Wert mehrzeilig darstellen.
- Der Stepper behält seine festen 48-pt-Touchflächen. Diese festen Maße sind Interaktionsuntergrenzen und keine Text- oder Kartenhöhen.
- Die gemeinsame Row richtet sich oben aus und darf bei Bedarf umbrechen oder den Stepper in den verfügbaren vertikalen Raum verlagern. Beide Buttons bleiben erreichbar.
- Die Presets behalten ihren horizontalen Scrollbereich. Ihre Höhe wird aus Label und Tag abgeleitet; die Preset-Buttons werden nicht auf eine feste Textzeile begrenzt.
- Die erklärende Beschreibung bleibt unterhalb der Presets und darf vollständig wachsen. Der Abstand zwischen Presets, Erklärung und nächstem Bereich wird über `gap` erhalten, damit bei mehreren Textzeilen keine Überlagerung entsteht.

### 4.5 Day-Start-Modal

Das Modal bleibt ein transparentes Bottom-Sheet mit bestehender `maxHeight`-Begrenzung. Der Inhalt wird so aufgeteilt:

1. Modal-Header außerhalb der Scrollfläche. Der Titel erhält `flex: 1`, `minWidth: 0` und darf umbrechen. Der Schließen-Button bleibt als eigenständiges Touch-Ziel erreichbar.
2. Eine innere vertikale `ScrollView` für Eingabefeld, Erklärung, Validierungsfehler und beide Aktionen.
3. Ein `contentContainerStyle` mit vertikalem `gap` und zusätzlichem unteren Padding.

Die innere ScrollView verwendet weiterhin `keyboardShouldPersistTaps="handled"` und zeigt keine feste Inhalts-Höhe. Das Modal selbst und die Scrollfläche dürfen schrumpfen, während der Inhalt aus seinem tatsächlichen Textumfang wächst. Die beiden Buttons liegen innerhalb der Scrollfläche und erhalten die verfügbare Breite, damit ihre Beschriftungen bei großer Schrift wachsen oder umbrechen können.

Ein Validierungsfehler wird nicht absolut positioniert und nicht abgeschnitten. Sobald `TextField` den Fehler rendert, wächst der Modalinhalt; das Scrollen zum Ende muss die Fehlermeldung, die Übernehmen-Aktion und Abbrechen-Aktion sichtbar beziehungsweise fokussierbar machen.

### 4.6 Styling-Grenzen

Alle neuen Regeln bleiben in `StyleSheet.create((theme) => ...)` in `tracking-screen.tsx`. Es werden nur bestehende Theme-Werte für Abstände, Radien, Konturen und Farben verwendet. Die Implementierung nutzt Style-Arrays für Zustände und führt weder Hexwerte noch `className`, NativeWind oder eine zweite Styling-Runtime ein.

## Data Models

### Datenmodell und Schnittstellen

### 5.1 Produktdaten

Es gibt kein neues Datenmodell. Die bestehende Datenform bleibt die Quelle:

- `profile.tracking_method` und `profile.tracking_day_start_time` speisen den lokalen UI-Zustand.
- `currentGoal` speist Kalorienziel und Makro-Werte.
- `selectedMethod`, `selectedStartTime`, `inputTime` und `inputError` bleiben lokale Zustände des Screens beziehungsweise des `TimePicker`.
- Die Mutationen `useUpdateTrackingMethodMutation` und `useUpdateTrackingDayStartTimeMutation` werden nicht verändert.

### 5.2 Test-Schnittstellen

Falls der Harness für den vollständigen Scrollnachweis imperative Kontrolle braucht, sind nur optionale Refs vorgesehen:

```ts
type TrackingScreenHarnessProps = {
  screenScrollRef?: RefObject<ScrollView | null>;
  dayStartModalScrollRef?: RefObject<ScrollView | null>;
};
```

Die Props werden nicht von Produktionsrouten gesetzt. Die Default-Props bleiben leer, sodass die öffentliche Nutzung ohne Anpassung funktioniert. Es werden keine Produktionsdaten, Testflags oder Netzwerk-Adapter in das Produktmodell eingeführt.

## Error Handling

### Zustände und Fehlerbehandlung

| Zustand | Erwartetes Verhalten |
|---|---|
| Profil und Ziel vorhanden | Aktive Methode, Kalorienziel, Makros und Tagesstart bleiben vollständig sichtbar und erreichbar. |
| Kein aktuelles Ziel | `Nicht festgelegt` und `–` bleiben explizit sichtbar; die längeren Texte wachsen mit ihrem Container. |
| Methode deaktiviert | Radio bleibt deaktiviert, Beschreibung und Status dürfen trotzdem mehrzeilig dargestellt werden. Kein Text wird durch `overflow` entfernt. |
| GLP-1 ausgewählt | Methodenspezifischer Inhalt folgt unter der Methode und verschiebt alle unteren Gruppen innerhalb derselben Screen-Scrollfläche nach unten. |
| Gültige manuelle Zeit | Bestehende Normalisierung und Mutation laufen unverändert; Modal schließt nach erfolgreicher Übernahme. |
| Ungültige manuelle Zeit | Modal bleibt offen, `TextField` zeigt die bestehende Fehlermeldung, der Inhalt wächst und beide Aktionen bleiben nach Scrollen erreichbar. Keine Mutation wird ausgelöst. |
| Abbrechen oder Schließen | Modal schließt ohne Übernahme des ungespeicherten Textes. |
| Ausstehende Tagesstart-Mutation | Bestehendes `disabled`-Verhalten bleibt erhalten. Die Layoutänderung darf keine zusätzliche Sperre oder Mutation erzeugen. |

## Testing Strategy

### Test- und Harness-Design

### 7.1 Bestehende Tracking-Tests

`src/features/profile/tracking-screen.test.tsx` bleibt der Ort für fachliche Beispiele. Die bestehenden Tests für Abschnittssichtbarkeit, Zielnavigation, Methode, Stepper, manuelle Validierung, Erklärung und Feature-Flags bleiben erhalten.

Gezielte Ergänzungen sind nur nötig, wenn sie durch die Layoutänderung berührt werden:

- Ein Fixture ohne `currentGoal` prüft die expliziten Nicht-gesetzt-Zustände.
- Ein gezielter Modalzustand mit Validierungsfehler bestätigt, dass die Fehlermeldung und beide Aktionen weiterhin im Baum vorhanden sind.
- Falls die optionale Scroll-Ref-Schnittstelle eingeführt wird, prüft ein kleiner Render-Test, dass sie nur an die bestehende Screen-/Modal-ScrollView weitergereicht wird. Es wird kein Snapshot des gesamten Screens eingeführt.

Die Tests verwenden weiterhin zugängliche Rollen, Labels und sichtbare Texte. Style-Assertions beschränken sich auf die verhaltensrelevanten Flex-Eigenschaften, wenn ein Layoutvertrag sonst nicht erkennbar wäre.

### 7.2 Zusätzlicher Large-Text-Harness-Fall

`harness/typography-large-text.harness.tsx` erweitert das vorhandene `describe`, ohne bestehende `it`-Blöcke zu ersetzen.

Der neue Fall verwendet ein vollständig deterministisches Fixture:

- Session mit einem festen Benutzer.
- Profil mit einer langen beziehungsweise repräsentativen Tracking-Methode und einem nichttrivialen Tagesstart.
- Ziel mit Kalorien- und Makro-Werten.
- Deaktivierte und aktivierte Methoden, damit Beschreibung und Status in beiden Zuständen vorkommen.
- Mock-Mutationen ohne Netzwerkzugriff.
- Dieselben Provider wie bisher: i18n, `ThemeProvider` und ein retry-freier `QueryClient`.

Der Ablauf ist in sichtbare Zustände geteilt:

1. `tracking-screen-initial`: vollständigen Screen rendern, obere Methode und Zielwerte abfragen, Breite und `fontScale` mit `captureEvidence` erfassen.
2. `tracking-screen-end`: den Screen-eigenen vertikalen Scroll-Owner bis zum Ende scrollen, die Rhythmus-/Zeitfenster-Gruppe und die Tagesstart-Aktion abfragen, zweites Artefakt erfassen.
3. `tracking-modal-initial`: manuelles Tagesstart-Modal öffnen, Überschrift, Eingabe, Erklärung und beide Aktionen abfragen, Artefakt erfassen.
4. `tracking-modal-validation`: ungültige Zeit eingeben und übernehmen, vorhandenen Alert abfragen, Artefakt erfassen.
5. `tracking-modal-end`: die Modal-Scrollfläche bis zum Ende scrollen, Fehlermeldung und beide Aktionen erneut abfragen und das Endartefakt erfassen.

Jeder Tracking-Zustand verwendet die bestehende Evidenzform mit:

- `platform: ios`
- `resolvedLayoutWidth: 320`
- gemessenem `fontScale`, im deterministischen Fall `2`
- Screenshot-URI und Byteanzahl

Der Harness prüft zusätzlich, dass die untere Screen-Gruppe und die Modal-Aktionen nach dem tatsächlichen Scrollvorgang erreichbar sind. Reine DOM-/Tree-Anwesenheit ohne Scrollaktion gilt nicht als ausreichender Nachweis.

Der Tracking Screen wird nicht in eine zusätzliche äußere vertikale ScrollView gelegt. Für den Screen wird der bestehende Scroll-Owner per optionalem Ref oder unterstütztem nativen Scroll-Selektor gesteuert. Das Modal verwendet ausschließlich seine eigene innere Scrollfläche.

### 7.3 Property- und Testtyp-Balance

Die Correctness Properties unten sind universelle Layoutverträge. Weil React-Native-Geometrie, native Font-Metriken und Screenshots UI-/Geräteverhalten sind, werden sie mit deterministischen Harness-Zuständen, Accessibility-Abfragen und gezielten Integrationsbeispielen geprüft, nicht mit zufällig generierten UI-Bäumen.

Für diese Änderung wird keine neue reine Transformationsfunktion eingeführt. Sollte bei der Implementierung doch eine reine Zeit- oder Layoutfunktion extrahiert werden, erhält sie einen separaten Property-Test mit mindestens 100 Iterationen. Fachliche Eingabevalidierung bleibt durch die bestehenden Beispiele abgedeckt.

## 8. Native 414-pt-iPhone-Abnahme

Die reale Abnahme erfolgt erst nach erfolgreichem deterministischem Harness:

1. Vor dem Lauf die logische Breite des verbundenen iPhones zur Laufzeit messen und als 414 pt dokumentieren.
2. Den tatsächlich beobachteten `fontScale` aus der Runtime-Evidenz dokumentieren. Der Wert ist ein Messwert und keine feste Passbedingung.
3. `Mein Tracking` bei nativer großer Schrift von oben nach unten prüfen. Dabei müssen Methodenname, Beschreibung, Status, Tagesziel, alle Makro-Labels/-Werte, Bearbeitungsaktion, Tagesstartanzeige, Stepper, Presets und Erklärung vollständig innerhalb der horizontalen Grenzen liegen.
4. Das Day-Start-Modal öffnen und in den Zuständen initial, mit Validierungsfehler und am Ende der Scrollfläche prüfen. Überschrift, Eingabe, Erklärung, Fehlermeldung, Übernehmen und Abbrechen dürfen nicht überlaufen, clippen oder versteckt werden.
5. Screenshots beziehungsweise vorhandene Runtime-Artefakte zusammen mit Breite und tatsächlichem `fontScale` im Acceptance-Report ablegen.

Die Abnahme bewertet die beobachtete Schriftgröße. Sie verlangt weder `fontScale === 2` auf dem echten Gerät noch eine Änderung der Schriftgröße, um den Test zu bestehen. Erst wenn Harness und iPhone-Abnahme vollständig dokumentiert sind, darf `fam-qu0f` geschlossen werden.

## 9. Verifikation und Reihenfolge

Geplante gezielte Checks nach der Implementierung:

```text
bun run test src/features/profile/tracking-screen.test.tsx
bun run harness:run -- typography-large-text.harness.tsx
bun run typecheck
bun run check
```

Die Checks werden nach der Produktänderung in dieser Reihenfolge bewertet: Layout-/Code-Review, bestehende Tracking-Tests, deterministischer 320-pt-/2,0-Harness, reale 414-pt-iPhone-Abnahme, anschließend Acceptance-Report und Beads-Abschluss. Die vollständige Testsuite wird nicht als Standardcheck eingeplant.

## Correctness Properties

Diese Eigenschaften sind die überprüfbaren Brücken zwischen Requirements und Layout-/Abnahmetests. Für UI-Geometrie bedeutet "für alle" alle unterstützten Zustände und Zielbreiten, die im deterministischen Harness oder auf dem realen iPhone dargestellt werden.

### Property 1: Vollständige content-derived Textdarstellung

**Für jeden** betroffenen Textinhalt, jede unterstützte Zielbreite und jeden beobachteten nativen `fontScale` muss der zugehörige Container seine Höhe aus dem tatsächlich umgebrochenen Inhalt ableiten und den vollständigen Text ohne Schriftverkleinerung, Einzeilenbegrenzung oder Clipping darstellen.

**Validates: Requirements 3.1, 3.2, 4.1, 4.3, 4.4, 4.6, 6.1, 6.2**

### Property 2: Reflow erhält angrenzende Controls

**Für jede** Methoden- oder Tagesstart-Zeile, in der Text horizontal mit einem Control teilt, muss der Textbereich innerhalb der verfügbaren Breite schrumpfen und umbrechen können, während das angrenzende Control innerhalb der Grenzen und erreichbar bleibt.

**Validates: Requirements 4.2**

### Property 3: Responsive Makro-Anordnung

**Für jede** unterstützte Zielbreite und jeden beobachteten nativen `fontScale` muss die Makro-Anordnung die Bereiche umbrechen oder stapeln, sobald drei Bereiche nicht ohne Verlust der lesbaren Label-/Wertdarstellung in eine Reihe passen; jeder Makro-Bereich muss sein vollständiges Label und seinen vollständigen Wert behalten.

**Validates: Requirements 4.5**

### Property 4: Vertikale Reichweite aller Zustände

**Für jeden** unterstützten Tracking-Zustand mit vorhandenem oder fehlendem Ziel, methodenspezifischem Inhalt oder sichtbarer Validierungsmeldung muss das Scrollen des jeweils zuständigen vertikalen Scroll-Owners bis zum Ende jeden unteren Screen-Bereich, jede Modal-Fehlermeldung und beide Modal-Aktionen erreichbar machen.

**Validates: Requirements 5.1, 5.2, 5.3**

## 10. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Ein äußerer Harness-ScrollView verdeckt den echten Screen-Scroll-Owner. | Screen ohne verschachtelten vertikalen Wrapper rendern und den bestehenden Scroll-Owner per optionalem Ref oder nativen Selektor steuern. |
| Flex-Wrap löst nur die äußere Row, aber nicht den Text im Bereich. | Für jeden Textblock `minWidth: 0` und `flexShrink: 1` prüfen; relevante Texte ohne `numberOfLines` und ohne versteckenden Overflow lassen. |
| Große Modal-Fehlermeldung drückt Aktionen aus der sichtbaren Fläche. | Header separat halten, Felder und Aktionen in eine innere `ScrollView` legen, Modalinhalt schrumpfen lassen und Endposition im Harness prüfen. |
| Feste Touch-Ziele werden fälschlich als verbotene feste Höhen entfernt. | 44-/48-pt-Mindestflächen für Controls beibehalten; nur texttragende Höhen dynamisch machen. |
| Ein Screenshot sieht plausibel aus, obwohl ein unterer Bereich nicht erreichbar ist. | Nach realer Scrollaktion Accessibility-Labels und Aktionen abfragen und Endartefakt speichern. |
| Der Gerätewert wird als `fontScale === 2` fehlinterpretiert. | 320-pt-/2,0-Fall nur im deterministischen Harness erzwingen; im 414-pt-Report ausschließlich den gemessenen Runtime-Wert dokumentieren. |
