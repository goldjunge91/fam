# Vertrag: Felder und Auswahl

## Zuständigkeit

Form- und Auswahlrezepte liegen in
[src/constants/ui.tsx](../../../src/constants/ui.tsx); Tokenwerte in
[index.ts](../../../src/components/theme/index.ts). Lokales Layout verwendet
native style-Props und Unistyles-Theme-Callbacks.

## Komponenten

- TextField ist der gemeinsame Einstieg für strukturierte Eingaben. Es bündelt
  Label, Placeholder, Wert, Fehler, Fokus, nicht editierbaren Zustand und
  optionale trailing action. Native Input-Props, Autofill, Tastaturtyp,
  Secure-Text und React-Hook-Form-/Fokus-Refs bleiben nutzbar.
- SegmentedControl bildet eine Einzelauswahl aus label, options, selected und
  onSelect ab. Jede Option hat value und label sowie optional
  accessibilityLabel und disabled. selectionRole ist radio für fachliche
  Einzelauswahl und tab für einen Ansichtswechsel.
- appearance accent/surface und size default/compact sind belegte Varianten.
  Auch kompakte Trefferziele erfüllen den Interaktionsvertrag aus Vertrag 07.
- Pill ist eine benannte Aktion und keine Auswahlgruppe. Badge ist informativ,
  kein Button. Filter, QuantityStepper und domänenspezifische Selects verwenden
  die zu ihrer Funktion passende Rolle und Zustandsmeldung.
- Produktfeatures importieren keine alternative SegmentedControl-Implementierung.
  @expo/ui im Settings-Design-System ist eine Vergleichsvariante, keine
  Produkt-API. Nicht unterstützte gap- oder labelStyle-Props werden nicht ergänzt.

## Feldzustände

| Zustand | Anforderung |
| --- | --- |
| Normal | Zentrales Surface-, Text-, Placeholder-, Kontur- und Labelrezept |
| Fokus | Fokus bleibt beim Themewechsel erhalten und ist zusätzlich erkennbar |
| Fehler | Lesbare, dem Feld zugänglich zugeordnete Meldung |
| Fehler und Fokus | Beide Zustände bleiben gleichzeitig sichtbar |
| Nicht editierbar | Zentraler Disabled-Zustand; Status bleibt erkennbar |
| Success-Workflow | Zentrale Success-Fläche plus verständlicher Kontext |

Konturstärken stammen aus dem Theme-Owner. Der Fokus darf Layout und Nachbarfelder
nicht springen lassen. Farbzuordnungen werden nicht pro Formular neu erfunden.

Explizite accessibilityLabel- und Hint-Props haben Vorrang vor Defaults. Fehler
bleiben dem Feld zugeordnet. Fokus-/Blur-Callbacks laufen nach der internen
Zustandsaktualisierung einmal. Eine trailing action hat eigenen Namen und
wirksamen Touchbereich, verdeckt weder Eingabe noch Fehler und wird bei einem
nicht editierbaren Feld ausdrücklich behandelt.

## Tastatur, Auswahl und Lesbarkeit

Einzeilige Felder verwenden standardmäßig done und schließen beim Absenden den
Fokus. Native Next-/Submit-Formulare und mehrzeilige Eingaben dürfen den Default
über native Props anpassen; Mehrzeilenfelder behalten ihre Umbrüche.

Pro aktivem nativen Formular- oder Screen-Kontext gibt es eine verantwortliche
KeyboardToolbar. Ein Sheet mit Eingaben besitzt diesen Kontext, ohne eine zweite
gleichzeitig bedienbare Toolbar. Web braucht keine nachgebaute native
Tastaturleiste.

Eine Einzelauswahl hat genau einen Wert, einen Gruppennamen und verständliche
ausgewählte/gesperrte Zustände. Mehrfachfilter lassen sich wieder abwählen und
melden selected oder checked passend zur Semantik. Farbe allein zeigt keine
Auswahl. Lange Labels und große Schrift dürfen Umbruch oder mehr Höhe benötigen.

## Nachweis

Gezielte Prüfungen belegen Feldzustände, Props, Events, Ref-Fokus, Disabled,
Auswählen und Abwählen. VoiceOver und TalkBack prüfen Name, Fehler und
Auswahlsemantik. Native Tastatur- und Sheet-Prüfungen bestätigen Toolbar und
Erreichbarkeit. Beide Themes, große Schrift und schmale Breite werden geprüft.
