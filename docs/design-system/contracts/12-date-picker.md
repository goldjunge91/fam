# Vertrag: Native iOS-DatePicker

## Zweck und Scope

Der Vertrag hält die native SwiftUI-DatePicker-Referenz fest. Der DatePicker ist
ein Eingabe-Control und kein Sheet, Modal oder allgemeiner
Präsentationsmechanismus. Android, eine Migration bestehender Datumskomponenten
und ein Produkt-Redesign sind nicht Teil dieses Vertrags. Die Präsentationsregeln
für Sheets und Dialoge stehen in [Vertrag 11](./11-modal-and-sheets.md).

## Kanonische API

Neue iOS-Referenzen verwenden `DatePicker` aus `@expo/ui/swift-ui` in einem
`Host`. Die Auswahl bleibt kontrolliert:

- `selection` ist das angezeigte `Date`, `onDateChange` schreibt die neue
  Auswahl in den Consumer-State.
- `displayedComponents` wählt `date` und/oder `hourAndMinute`. `range` begrenzt
  die auswählbaren Daten, wenn die Fachdomäne dies verlangt.
- `datePickerStyle` aus `@expo/ui/swift-ui/modifiers` ist optional. Erlaubt sind
  `automatic`, `compact`, `graphical` und `wheel`.

Die Referenz nutzt `datePickerStyle('compact')`, weil der Picker als
einzeiliges Eingabe-Control wenig Platz verbraucht. `graphical` und `wheel` sind
bewusst Stilvarianten, keine eigenen Produktverträge.

## Grenze zum bestehenden Produktbestand

[date-picker.tsx](../../../src/components/forms/date-picker.tsx) und
[date-wheel-field.tsx](../../../src/components/forms/date-wheel-field.tsx)
bleiben unverändert. Sie besitzen jeweils eigene Produkt- und
Plattformsemantik. Eine Migration erfolgt nur nach einem separaten UX-Nachweis,
wenn native Formatierung, Wartung oder Accessibility messbar verbessert werden;
ein ähnliches visuelles Ergebnis ist kein Grund. Der Showcase ist eine API- und
Semantik-Referenz, kein stiller Migrationsauftrag.

## Theme und Layout

- `Host` erhält bei Bedarf `seedColor` aus dem aktiven Theme.
- Der Picker bleibt native SwiftUI-Komposition. Hexfarben, eigene
  Typografierollen und eine RN-Nachbildung der Kalenderfläche sind nicht
  vorgesehen (Vertrag 01, 02). Das umgebende RN-Layout folgt Vertrag 05.
- `matchContents` wird hier nicht gesetzt. Der Picker füllt die gegebene Breite
  und kollabiert sonst auf 0; der Host bekommt eine explizite Größe.

## Accessibility und Datenfluss

- Ein sichtbarer Titel wie `Datum` erklärt das Control und entfällt nicht ohne
  gleichwertige zugängliche Beschriftation.
- Interaktionsfläche und Dynamic-Type- und VoiceOver-Semantik bleiben beim
  SwiftUI-Control.
- Der Consumer hält `Date` typisiert und formatiert erst für die eigene
  Anzeige. Keine String-Konkatenation ersetzt die native Auswahl.
- Fachlich unzulässige Bereiche werden über `range` begrenzt und nicht nur
  nachträglich in der Anzeige kaschiert.

## Nachweis

Der Showcase in
[showcase-components.tsx](../../../src/features/settings/dev/design-system/showcase-components.tsx)
zeigt das kontrollierte Beispiel mit `selection`, `onDateChange` und dem
optionalen `datePickerStyle('compact')`. Geschützt durch
[native-date-picker-showcase-convention.test.ts](../../../test/conventions/native-date-picker-showcase-convention.test.ts).
Die Prüfmaßstände aus Vertrag 10 gelten; die native Größe und Interaktion
brauchen einen iOS-Lauf.

## Offizielle Quelle

- [Expo UI SwiftUI DatePicker](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/datepicker/)
