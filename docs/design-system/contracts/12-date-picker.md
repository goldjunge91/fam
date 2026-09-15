# Vertrag: Native iOS-DatePicker

## Zweck und Scope

Dieser Vertrag definiert die native SwiftUI-DatePicker-Referenz im Design-
System. Der DatePicker ist ein Eingabe-Control und kein Sheet, Modal oder
allgemeiner Präsentationsmechanismus. Android, eine globale Migration bestehender
Datumskomponenten und ein Produkt-Redesign sind nicht Teil dieses Vertrags.

## Kanonische API

Neue iOS-Referenzen verwenden `DatePicker` aus `@expo/ui/swift-ui` innerhalb
eines `Host`. Die Auswahl bleibt kontrolliert:

- `selection` enthält das aktuell angezeigte `Date`.
- `onDateChange` schreibt eine neue Auswahl zurück in den Consumer-State.
- `displayedComponents` legt fest, ob Datum, Uhrzeit oder beides sichtbar ist.
- `range` begrenzt die auswählbaren Daten, wenn die Fachdomäne dies verlangt.
- `datePickerStyle` aus `@expo/ui/swift-ui/modifiers` ist optional. Erlaubte
  Stile sind `automatic`, `compact`, `graphical` und `wheel`.

Das Referenzbeispiel verwendet `datePickerStyle('compact')`, weil es als
einzeiliges Eingabe-Control in einem informationsdichten Formular wenig Platz
verbraucht. `graphical` und `wheel` sind bewusst Stilvarianten, keine neuen
Produktverträge.

## Grenze zum bestehenden Produktbestand

`src/components/forms/date-picker.tsx` und
`src/components/forms/date-wheel-field.tsx` bleiben unverändert. Sie besitzen
jeweils eigene Produkt- und Plattformsemantik. Eine Migration erfolgt nur nach
einem separaten UX-Nachweis, wenn native Datums-/Zeitformatierung, Wartung oder
Accessibility messbar verbessert werden.

Der Showcase ist daher eine API- und Semantik-Referenz, kein stiller
Migrationsauftrag. Bestehende Eingaben werden nicht nur wegen eines ähnlichen
visuellen Ergebnisses ersetzt.

## Theme und Layout

- `Host` erhält bei Bedarf `seedColor` aus dem aktiven Theme.
- Der native Picker bleibt native SwiftUI-Komposition; eigene Hexfarben,
  Typografierollen oder eine RN-Nachbildung der Kalenderfläche sind verboten.
- Umgebendes RN-Layout verwendet Unistyles und bestehende Tokens.
- `matchContents` wird nicht für einen DatePicker verwendet, weil der Picker
  die verfügbare Breite benötigt und sonst kollabieren kann.

## Accessibility und Datenfluss

- Ein sichtbarer Titel wie `Datum` erklärt das Control; ein Consumer entfernt
  ihn nicht ohne gleichwertige zugängliche Beschriftung.
- Die native Interaktionsfläche und Dynamic-Type-/VoiceOver-Semantik bleiben
  beim SwiftUI-Control.
- Der Consumer verarbeitet `Date` als typisierten Wert und formatiert ihn erst
  für die eigene Anzeige. Keine String-Konkatenation ersetzt die native Auswahl.
- Ungültige oder fachlich nicht erlaubte Bereiche werden über `range` begrenzt,
  nicht nur nachträglich in der Anzeige kaschiert.

## Nachweis

`src/features/settings/dev/design-system/showcase-components.tsx` zeigt ein
kontrolliertes Beispiel mit `selection`, `onDateChange` und dem optionalen
`datePickerStyle('compact')`. Der fokussierte Convention-Test schützt die
API- und Bestandsgrenze. `bun run check` und `bun run typecheck` sind separate
Gates. Eine iOS-Geräteprüfung ist für diesen Showcase-Slice erforderlich, weil
die native Größe und Interaktion nicht durch einen Web- oder Android-Lauf
belegt werden.

## Offizielle Quelle

- [Expo UI SwiftUI DatePicker](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/datepicker/)
