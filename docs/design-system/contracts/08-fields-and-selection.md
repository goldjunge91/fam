# Vertrag: Felder und Auswahl

## Zweck und Zuständigkeit

Eingaben und Auswahl verwenden gemeinsame Darstellung und zeigen Zustand nicht
nur über Farbe. Rezepte für Form, Typografie, Farbpaare, Konturen und Zustände
liegen in `ui.tsx`; Werte stammen aus `index.ts` und dem aktiven ThemeProvider.
NativeWind übernimmt nur lokales Layout.

## Öffentliche Komponenten und gemeinsame Basis

- `TextField` aus `src/components/forms/text-field.tsx` bleibt der Produkteinstieg
  für strukturierte Eingaben. Das bestehende `Field` aus `ui.tsx` verwendet dieselbe
  Eingabebasis. Fokus- und Fehlerfähigkeit dürfen nicht auf zwei unabhängige
  Darstellungen verteilt bleiben.
- Produkt-Einzelauswahl verwendet den `SegmentedControl` aus
  `src/components/ui/segmented-control.tsx` mit Gruppenlabel, `options`, `selected`
  und `onSelect`. Der bestehende `value/onChange`-Einstieg darf diese Basis adaptieren.
- `Pill`, Filter, `Badge`, `QuantityStepper` und domänenspezifische Selects folgen
  denselben Zustands-, Farb- und Interaktionsregeln. Sie müssen deshalb nicht
  dieselbe Komponente oder Accessibility-Rolle sein.

## Gemeinsamer Eingabevertrag

Die Eingabebasis unterstützt Label, Placeholder, Wert, Fehlertext, Fokus,
nicht editierbaren Zustand und optionale trailing action. Native Input-Props,
Autofill, Tastaturtyp, Secure-Text und React-Hook-Form-/Fokus-Refs bleiben nutzbar.

| Zustand | Darstellung | Semantik |
| --- | --- | --- |
| Normal | zentrale Surface, Text-/Placeholderfarben, Basiskontur und primäres Label | Label bezeichnet die Eingabe |
| Fokussiert | Akzentkontur, Akzentlabel, Akzentcursor und Auswahlfarbe | Fokus bleibt bei Themewechsel erhalten |
| Fehler | lesbarer Fehlertext und Fehlerkennzeichnung | Meldung ist dem Feld zugänglich zugeordnet |
| Fehler + Fokus | Fehler bleibt sichtbar; zusätzlicher Fokusindikator | keiner der beiden Zustände wird verdrängt |
| Nicht editierbar | zentrales Disabled-Rezept | Eingabe gesperrt und Zustand erkennbar |

Der bisherige Fokusvertrag mit 1,5-Punkte-Basiskontur und 2-Punkte-Fokuskontur
bleibt als Maßvorgabe erhalten. Das zentrale Rezept muss den Unterschied
geometrisch ausgleichen, sodass weder Feld noch Nachbarlayout springen. Die
Farbzuordnung berücksichtigt Fehler + Fokus; sie wird nicht pro Formular neu erfunden.

Alle Feldbestandteile folgen der App-Präferenz, auch bei abweichendem Systemtheme.
Explizite `accessibilityLabel`-/Hint-Props haben Vorrang vor abgeleiteten Defaults.
Sie dürfen nicht durch spätere JSX-Props versehentlich überschrieben werden.
Die Fehlermeldung bleibt unabhängig von diesen Overrides zugänglich dem Feld zugeordnet.
Fokus-/Blur-Callbacks laufen nach der internen Zustandsaktualisierung genau einmal.

Eine trailing action hat eigenen Namen und ausreichenden Touchbereich; sie verdeckt
weder Eingabetext noch Fehlermeldung. Ein nicht editierbares Feld ist keine
pauschale Erlaubnis, seine trailing action aktiv zu lassen: deren zulässige
Funktion und Disabled-Zustand werden ausdrücklich bestimmt.

## Tastatur und Submit

Einzeilige Felder verwenden standardmäßig `done` und schließen beim Absenden den
Fokus. Formulare mit Next-/Submit-Steuerung sowie mehrzeilige Eingaben dürfen dies
über native Props passend überschreiben. Ein Mehrzeilenfeld verliert keine
Zeilenumbrüche durch einen erzwungenen Done-Default.

Pro aktivem Formular-/Screen-Kontext mit Eingaben gibt es auf nativen Plattformen
eine verantwortliche `KeyboardToolbar`, damit Tastaturen ohne Return-Taste eine
Fertig-Aktion besitzen. Kein Adapter erzeugt eine zusätzliche Toolbar je Feld.
Bei einem darüberliegenden Sheet ist dessen Eingabekontext verantwortlich, ohne
eine zweite gleichzeitig bedienbare Toolbar. Web benötigt keine nachgebaute
native Tastaturleiste und behält seine normale Tastaturbedienung.

## Einzelauswahl, Filter und Badges

- Eine Einzelauswahl besitzt genau einen ausgewählten Wert aus ihren Optionen,
  einen Gruppennamen und erkennbare ausgewählte/gesperrte Zustände.
- Ansichtswechsel können als Tabs auftreten. Fachliche Formulareinzelauswahl
  muss als solche verständlich sein. Nicht jede Auswahl wird pauschal zum Tab.
- Mehrfachfilter lassen sich erneut betätigen und abwählen. Rolle sowie selected-/
  checked-State passen zur Bedeutung. Farbe allein ist keine Auswahlkennzeichnung.
- Disabled-Optionen sind erkennbar und nicht aktivierbar. Ein normaler `Badge`
  ist informativ, besitzt ein geprüftes Farbpaar und ist kein Button.
- Kompakte Segmente erfüllen denselben realen Mindesttouchbereich wie andere
  Aktionen. Große Schrift und lange Labels dürfen zu mehr Höhe, Umbruch oder
  einer ausdrücklich horizontalen Auswahlleiste führen.
- Öffentliche Props müssen wirken. Das bisher ungenutzte `gap` wird entweder
  unterstützt oder nach Aufrufermigration aus der API entfernt. Neue Aufrufer
  verlassen sich bis dahin nicht auf seine Wirkung.

## Beispiel der vorgesehenen Verwendung

```tsx
import { TextField } from '@/components/forms/text-field';
import { SegmentedControl } from '@/components/ui/segmented-control';

<TextField
  label="Produktname"
  value={name}
  onChangeText={setName}
  error={nameError}
/>
<SegmentedControl
  label="Ansicht"
  options={viewOptions}
  selected={view}
  onSelect={setView}
/>
```

Das Beispiel verwendet bestehende Produkt-APIs. Die gemeinsame Rezeptbasis und
vollständigen States sind Zielanforderungen, kein behaupteter Istzustand.
Ein lokales `TextInput` mit eigener Farb-/Konturdefinition oder eine Auswahl nur
mit wechselnder Farbe verletzt den Vertrag.

## Nachweis

Gezielte Tests prüfen Fokus/Fehler, explizite Props, native Events, Ref-Fokussierung,
Disabled sowie Auswählen/Abwählen. VoiceOver/TalkBack prüfen Feldname, Fehler und
Auswahlsemantik. Native Tastaturprüfung bestätigt Submit, Toolbar-Verantwortung und
Erreichbarkeit in Sheets. Beide Themes, große Schrift und schmale Breite sind
Teil der visuellen Prüfung. `Field`/`TextField` und beide SegmentedControls sind
bis zur Konsolidierung ausdrücklich Migrationsbestand.
