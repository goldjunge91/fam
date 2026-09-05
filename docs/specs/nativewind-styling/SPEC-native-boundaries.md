# Spec: `native-boundaries`

## Status

Abgeschlossen und historisch. Die aktuelle Grenze zwischen NativeWind und
StyleSheet steht in
`docs/design-system/contracts/05-nativewind-and-stylesheet.md`.

## Objective

NativeWind und StyleSheet werden an der richtigen Grenze eingesetzt. Das verhindert, dass ein `className` scheinbar vorhanden ist, aber bei nativen Komponenten keine Wirkung hat oder durch die falsche Priorität überschrieben wird.

## Erlaubte NativeWind-Fläche

`className` ist ausschließlich für einfaches statisches Layout auf
interop-kompatiblen React-Native-Core-Primitives und eigenen Komponenten
zulässig, die den Prop explizit weiterreichen. Geeignet sind insbesondere:

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
- Native Integrationsgrenzen mit berechneten Theme-Werten, Shadow-Objekten oder
  nativen Input-Eigenschaften, die nicht durch ein semantisches Primitive
  abgedeckt sind.

Diese Liste entstand aus den damaligen NativeWind- und FlashList-Audits. Der
aktuelle verbindliche Grenzvertrag steht in
`docs/design-system/contracts/05-nativewind-and-stylesheet.md`.

## Bewusst erlaubte Ausnahmen

| Ausnahme | Begründung |
|---|---|
| `TextInput` mit `style` | Schrift, Zeilenhöhe, Placeholder- und Theme-Farbe sind native Laufzeitwerte; `className` bleibt nur für Layout erlaubt. |
| `expo-image` mit `style` | Dimensionen, absolute Füllung und `contentFit` werden über die echte Image-Style-API übergeben. |
| SVG-/Icon- und Glyph-Styles | SVG akzeptiert keine normalen NativeWind-Klassen; Rotation, Größe und dynamische Farbe bleiben am nativen Adapter. |
| benutzer- oder datenbankdefinierte Farben | Markt-, Kategorien- oder Statusfarben sind Laufzeitwerte und werden typisiert über `color`/`style` gesetzt. |
| Provider-unabhängiger Crash-Fallback | Der Fallback darf bei einem Provider-Fehler nicht vom Theme-Provider abhängen; seine statischen Fallback-Farben sind absichtlich lokal. |

Diese Ausnahmen sind keine zweite Styling-Lösung. Sie markieren ausschließlich
Komponenten- und Laufzeitgrenzen, an denen NativeWind den Wert nicht zuverlässig
setzen kann.

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

- [x] Alle `className`-Verwendungen auf inkompatiblen Komponenten sind gefunden und entweder durch `style` ersetzt oder über einen Adapter dokumentiert.
- [x] Button-, Card- und Field-Semantik hängt nicht von unregistrierten Tailwind-Klassen ab.
- [x] NativeWind-Spezifitätsregeln sind in den betroffenen Tests und der Dokumentation berücksichtigt.
- [x] Die gemeinsamen Dateien enthalten die vorgesehenen Layout- und Farbwerte für iOS, Android und Web. Eine Geräteprüfung ist nicht Teil dieser Abnahme.
