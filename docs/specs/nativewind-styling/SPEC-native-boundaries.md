# Spec: `native-boundaries`

## Objective

NativeWind und StyleSheet werden an der richtigen Grenze eingesetzt. Das verhindert, dass ein `className` scheinbar vorhanden ist, aber bei nativen Komponenten keine Wirkung hat oder durch die falsche Priorität überschrieben wird.

## Erlaubte NativeWind-Fläche

`className` ist für React-Native-Core-Primitives und für registrierte eigene Komponenten zulässig, sofern die Komponente den Prop explizit weiterreicht. Geeignet sind insbesondere:

- `View`, `Text`, `Pressable`, `TextInput`, `ScrollView`.
- Fam-Komponenten, die `className` bewusst an das zugrunde liegende Primitive weitergeben.
- Layout-Utilities wie `flex-1`, `flex-row`, `items-center`, `justify-between`, `p-*`, `gap-*`, `self-stretch`.

## StyleSheet-Grenze

StyleSheet oder ein expliziter Style-Adapter ist erforderlich für:

- `expo-image`.
- `@shopify/flash-list` v2.
- Bottom-Sheet-Komponenten.
- `react-native-svg` und SVG-basierte Icon-Komponenten.
- Glass-/native Spezialkomponenten.
- Komponenten mit dynamischen Theme-Farben, Shadow-Objekten oder nativen Input-Eigenschaften.

Diese Liste entspricht dem bestehenden Projektwissen in `docs/design-system/nativewind-liquid-glass-migration.md` und den FlashList-Konventionen.

## Konfliktregeln

- Ein semantischer Core-Component entscheidet selbst über seine Hintergrund-, Border-, Text- und Fontwerte.
- `className` darf diese Werte nicht heimlich ersetzen.
- `style` des Callers ist der dokumentierte letzte Override.
- `!`-Utilities sind keine Standardlösung für einen Prioritätsfehler.
- Bei `className` auf einer Custom Component müssen Props korrekt weitergereicht oder bewusst ausgeschlossen werden.
- Die Reihenfolge von `...rest`, `className` und `style` wird in jeder neuen Komponente sichtbar gehalten.

## Android und Web

- Bestehende `.android.tsx`-Dateipaare werden bei der Importmigration synchron aktualisiert.
- Für reine gemeinsame Token- und Primitive-Dateien werden keine künstlichen Android-Stubs angelegt. Eine Plattformkopie entsteht nur, wenn sich Verhalten oder bestehende Resolver-Konventionen tatsächlich unterscheiden.
- Web darf nicht die native StyleSheet-Entscheidung durch eine unregistrierte CSS-Klasse verändern.
- `gap`, Schatten und Font-Familien werden auf allen Zielplattformen manuell gegen die tatsächliche Laufzeit geprüft.

## Acceptance criteria

- [ ] Alle `className`-Verwendungen auf inkompatiblen Komponenten sind gefunden und entweder durch `style` ersetzt oder über einen Adapter dokumentiert.
- [ ] Button-, Card- und Field-Semantik hängt nicht von unregistrierten Tailwind-Klassen ab.
- [ ] NativeWind-Spezifitätsregeln sind in den betroffenen Tests und der Dokumentation berücksichtigt.
- [ ] Die gemeinsamen Dateien enthalten die vorgesehenen Layout- und Farbwerte für iOS, Android und Web. Eine Geräteprüfung ist nicht Teil dieser Abnahme.
