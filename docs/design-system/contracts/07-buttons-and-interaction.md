# Vertrag: Buttons und Interaktion

## Zuständigkeit und API

Produktcode verwendet Button und Press aus
[src/constants/ui.tsx](../../../src/constants/ui.tsx). Tokenwerte stammen aus
[index.ts](../../../src/components/theme/index.ts), fertige Schatten-Styles aus
[ui-shadow.ts](../../../src/constants/ui-shadow.ts). Die UI-Dateien definieren
Typografie, Farbpaare, Größenrezepte, Zustände, Motion und Haptikzuordnung.
Feature-Komponenten ergänzen Verhalten und Komposition.

Die Button-API verwendet title, onPress, variant, size, loading und disabled.
Unterstützte Ergänzungen sind icon, accentKey, full, haptic, flat und
accessibilityLabel. Es gibt keine parallele allgemeine Button-Implementierung
und keine alten label- oder default/large/compact-Varianten. Größen sind sm, md
und lg; md ist der Default. Konkrete Stilwerte stehen im UI-Owner.

## Varianten und Verhalten

- primary ist die hervorgehobene Aktion, secondary eine Nebenaktion, danger eine
  destruktive Aktion, accent ein belegter Domain-Akzent, ghost eine transparente
  Nebenaktion und link eine Textaktion.
- Gefüllte Varianten verwenden das zentrale Tiefen- und Druckweg-Rezept. flat
  darf es für kompakte Header-Aktionen abschalten, bildet aber keine zweite
  Buttonfamilie.
- Press und Button verwenden das jeweilige zentrale Feedback. Reduced Motion
  lässt Federbewegung und Skalierung aus, erhält aber ruhiges oder sofortiges
  Zustandsfeedback.
- Disabled und Loading blockieren Aktivierung und Haptik. Sie melden den
  passenden Accessibility-Zustand; das Label bleibt lesbar. Mehrzeilige Labels
  dürfen den Button vergrößern. Ladeindikatoren verschieben den Text nicht
  überraschend.
- Ein Press-Wrapper ruft interne Effekte und externe onPressIn-/onPressOut-
  Callbacks pro Ereignis einmal auf. Abbruch oder ein Wechsel zu Disabled lässt
  keinen gedrückten Zustand zurück. Adapter erzeugen keine doppelte Aktivierung,
  Animation oder Haptik.
- Haptik läuft über src/lib/platform/haptics.ts. Zentrale Zuordnung,
  Nutzerpräferenz und dokumentierte Overrides stehen in ui.tsx.
- Press success ist das zentrale Flächenrezept für kompakte Bestätigungen und
  positive Abschlussaktionen. TextField success verwendet es für editierbare
  Werte in einem Success-Workflow.
- Eine direkte dynamische Pressable-style-Funktion ist im aktuellen App-Setup
  zulässig. Die Probe im Design-System-Showcase wurde auf einem Gerät geprüft;
  das belegt nur dieses Gerät und den getesteten Stand. Bestehende Controls
  bleiben bei Press, wenn sie dessen Feedback oder Reduced-Motion-Verhalten
  benötigen. Keine pauschale Migration ohne konkreten Anlass.

## Touch, Fokus und Namen

Eigenständige Aktionen haben mindestens 44 × 44 logische Einheiten wirksamen
Touchbereich. Kleine Icons dürfen sichtbar kleiner sein, wenn der Trefferbereich
am nativen Element zuverlässig erweitert wird, nicht abgeschnitten wird und
keine Nachbaraktion überlappt. hitSlop allein ist kein Nachweis. Inline-Links
werden gesondert beurteilt.

Icon-only-Aktionen brauchen einen verständlichen zugänglichen Namen. Dekorative
Icons erzeugen keinen zusätzlichen Fokus. Web unterstützt Tastaturaktivierung
und sichtbaren Fokus. Eine freie backgroundColor-Prop ist keine Erlaubnis für
ungeprüfte Farbpaare.

Für QuantityStepper, FilterChipBar und InlineSelect ist die zentrale Press-Basis
vorgesehen. FilterChipBar meldet Auswahl nativ über accessibilityState.selected.
IconButton-Aufrufer geben einen zugänglichen Namen an. HeaderIconButton darf eine
kompakte sichtbare Fläche nur mit nachgewiesenem, nicht abgeschnittenem und
nicht überlappendem Trefferbereich verwenden.

## Nachweis

Gezielte Prüfungen belegen Blockierung, einmalige Callbacks, Accessibility,
Haptik und gemeinsame Rezepte. Geräteprüfungen bewerten echte Touchflächen,
Abbruch, Motion und große Schrift in beiden Themes. Die Probe dynamischer Styles
belegt nur die konkret geprüfte Umgebung.
