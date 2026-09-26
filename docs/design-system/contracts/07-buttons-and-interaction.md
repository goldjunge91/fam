# Vertrag: Buttons und Interaktion

## Zweck und öffentliche Grenze

Buttons machen Priorität, Gefahr und Interaktion konsistent. Produktcode importiert
den gemeinsamen Button und `Press` aus `src/constants/ui.tsx`. Die Foundation-API verwendet
`title`, `onPress`, `variant`, `size`, `loading` und `disabled`; `icon`,
`accentKey`, `full`, `haptic`, `flat` und `accessibilityLabel` bleiben unterstützte
Ergänzungen.

Tokens stammen aus `index.ts`, die aktive Palette aus dem ThemeProvider.
Typografie, Farbpaare, Größenrezepte, Zustandsdarstellung, Timing und Haptikzuordnung
werden in `ui.tsx` definiert. Produktkomponenten ergänzen Verhalten und Komposition.

Der bisherige Produkt-Button mit `label` und `default/large/compact` ist eine
entfernte Alt-Implementierung. Die aktive API verwendet ausschließlich
`title` und `sm/md/lg`; `large` und `compact` sind derzeit bewusst keine
öffentlichen Größen-Aliase und dürfen erst nach ausdrücklicher Freigabe ergänzt
werden. Die historische Zuordnung `default → md`, `large → lg` und
`compact → sm` beschreibt nur die frühere Migration, keine aktuell akzeptierte
Prop-Oberfläche. Eine zusätzliche Button-Implementierung oder ein dauerhafter
Adapter bleibt kein zulässiger Endzustand.

## Varianten und Größen

| Variante | Bedeutung und Darstellung |
| --- | --- |
| `primary` | hervorgehobene Aktion, geprüftes Akzentpaar, gefüllt |
| `secondary` | weich hinterlegte Nebenaktion, primärer Text, keine zusätzliche Kontur |
| `danger` | destruktive Aktion, eigenes geprüftes Statuspaar, gefüllt |
| `accent` | belegter Domain-Akzent mit geprüftem Vordergrund, gefüllt |
| `ghost` | transparente Nebenaktion mit primärem Text |
| `link` | transparente Textaktion mit Akzenttext |

Größen bleiben im gemeinsamen Button `sm`, `md`, `lg`. `md` ist die aktuelle
Baseline und der Default: `minHeight: 44`, `minWidth: 44`,
`paddingVertical: space.md` (`rs(12)`), `paddingHorizontal: space.xl` (`rs(20)`),
`radius.md` (16), `font.sizes.base` (`rs(16)`) und Gewicht `700`. Für den
normalen, nicht als Link gerenderten Button hatte die alte `default`-Größe
`minHeight: 44`, keine explizite `minWidth`, `paddingVertical: space.md`
(`rs(12)`), `paddingHorizontal: space.lg` (`rs(16)`), denselben Basistext
`rs(16)`, Radius 16 und Gewicht `700`. Bei Referenzbreite 393 entsprechen die
historischen Abstände daher 12/16 und die aktuelle `md`-Baseline 12/20.
Gleiche Variante und Größe haben in Foundation und Showcase identische Rezepte.
Nicht jede Aktion auf einem Screen verwendet `primary`. Ein `accentKey` ist
keine freie Farbwahl.

## Tiefe und Motion

Gefüllte Varianten besitzen 4 Punkte sichtbare Tiefe und 4 Punkte Druckweg.
Der äußere View trägt eine deckende zentrale Tiefenfarbe und reserviert
`BUTTON_DEPTH`. Die Vorderseite bewegt sich bei `onPressIn` in 60 ms um diese
Tiefe nach unten und federt bei `onPressOut` zurück. Features ergänzen keine
weiteren Press-Overlays oder zeitgesteuerten Animationssequenzen.

Die vorhandene `flat`-Ausnahme für kompakte Header-Aktionen wird im gemeinsamen
Button umgesetzt und darf den Tiefeneffekt entfernen. Sie erzeugt keine zweite
Buttonfamilie. Bei Reduced Motion entfallen
Federüberschwingen und Skalierung. Ein sofortiger Zustand oder ruhiges Farb-/Konturfeedback
bleibt erhalten; die Systempräferenz muss über die reale Implementierung wirken.
Die gemeinsame `Press`-Komponente aus `ui.tsx` umschließt `Pressable` mit einer
Reanimated-Skalierung und bildet Reduced Motion über eine ruhige Opazität ab.
Ihre `style`-Prop kann statisch oder eine Style-Funktion sein; bei `selected`-
und `success`-Flächen kombiniert `Press` diese mit dem semantischen Style.
Der gemeinsame `Button` steuert Druckweg und Reduced-Motion-Feedback separat
über `onPressIn`/`onPressOut` und seine animierte Vorderseite.

Der gemeinsame `Button` setzt seinen gedrückten Zustand über diese bestehenden
Callbacks um und dimmt bei Press-In die Vorderseite mit Opazität `0.78`. Das
gilt für `primary`, `secondary`, `ghost`, `danger`, `accent` und `link`, auch
bei `flat`; gefüllte Buttons mit Tiefe behalten zusätzlich ihren Druckweg.
Disabled und Loading blockieren den gedrückten Zustand, Aktivierung und Haptik.
Reduced Motion zeigt dieselbe ruhige Opazitätsänderung sofort und lässt
Druckweg und Federbewegung aus. Press-Out stellt die normale Opazität wieder her.

Die dynamische `style={({ pressed }) => ...}`-Funktion von React Native
`Pressable` ist im aktuellen App-Setup zulässig. Die native
`PressableCallbackProbe` unter **Design-System → Bedienung** wurde vom
Maintainer auf einem Gerät geprüft; der gedrückte Zustand wurde sichtbar
angewendet. Das bestätigt genau dieses getestete Gerät und den aktuellen
App-Stand, nicht automatisch jede Plattform oder jedes Gerät.

Für einfache zustandsabhängige Styles kann die direkte Style-Funktion verwendet
werden. Bestehende Controls bleiben bei der zentralen `Press`-Basis, wenn sie
deren gemeinsame Interaktionsbehandlung, Reanimated-Feedback oder
Reduced-Motion-Verhalten benötigen. Der erfolgreiche Probe-Test ist kein Anlass
für eine pauschale Migration bestehender Controls. Bei Änderungen an der
nativen Renderstrecke ist das Geräteverhalten gezielt erneut zu prüfen.

Für den gemeinsamen Touch-Slice gilt diese Grenze konkret für `QuantityStepper`,
`FilterChipBar`, `InlineSelect`, `IconButton` und `HeaderIconButton`. Die ersten
drei verwenden die zentrale `Press`-Basis statt eigener roher Pressed-Styles.
`FilterChipBar` beschreibt Auswahl nativ über `accessibilityState.selected`,
nicht über Web-ARIA-Attribute. `IconButton`-Aufrufer liefern für die reine
Icon-Aktion einen verpflichtenden zugänglichen Namen. Die kompakte 39-Punkt-
Visualisierung von `HeaderIconButton` ist nur zulässig, wenn ihr `hitSlop` auf
dem Gerät einen nicht abgeschnittenen und nicht überlappenden Bereich von
mindestens 44 Punkten sicherstellt.

## Zustände, Ereignisse und Haptik

- Loading und Disabled blockieren Aktivierung und Haptik. Loading meldet `busy`,
  Disabled meldet `disabled`. Beschriftung bleibt lesbar und wird nicht durch
  eine unbenannte Ladegrafik ersetzt.
- Ein Ladeindikator verschiebt das Label nicht überraschend. Mehrzeilige Labels
  dürfen die Buttonhöhe erhöhen. Es werden keine dauerhaften dekorativen
  Pulse-/Shimmer-Animationen eingeführt.
- Gemeinsame Press-Wrapper führen interne Effekte und externe `onPressIn`-/
  `onPressOut`-Callbacks pro Ereignis genau einmal aus. Unterstützte Props werden
  an das tatsächliche interaktive Element weitergegeben.
- Abbruch oder Disabled-Wechsel hinterlassen keine dauerhaft gedrückte Fläche.
  Adapter erzeugen keine doppelte Aktivierung, Animation oder Haptik.
- Haptik läuft ausschließlich über `src/lib/platform/haptics.ts`: Der
  gemeinsame Button verwendet standardmäßig Medium, Auswahl Selection,
  generisches Press Light. Vorhandene dokumentierte Overrides und
  Haptikpräferenzen bleiben wirksam.

`Press success` ist die zentrale Success-Flächenrezeptur für kompakte Aktionen,
die einen bestätigten Status oder eine positive Abschlussaktion darstellen.
Sie bündelt Success-Hintergrund, Radius und Innenabstand in `ui.tsx`; Verbraucher
liefern nur Verhalten, Accessibility und lokales Layout. `TextField success`
verwendet dieselbe zentrale Fläche für eine editierbare Zahl innerhalb eines
Success-Workflows.

## Touch, Fokus und Beschriftung

Normale eigenständige Aktionen besitzen mindestens 44 × 44 logische Einheiten
realen Touchbereich. Kleine sichtbare Icons sind erlaubt, wenn der Trefferbereich
wirksam erweitert wird, nicht am Elterncontainer abgeschnitten wird und keine
Nachbaraktion überlappt. Allein `hitSlop` zu setzen ist kein Nachweis.
Inline-Links innerhalb von Fließtext werden gesondert beurteilt; eigenständige
Link-Buttons sind keine pauschale Ausnahme.

Icon-only-Aktionen benötigen einen verständlichen zugänglichen Namen. Dekorative
Icons erzeugen keinen zweiten Fokus. Auf Web sind Fokusindikator und
Tastaturaktivierung erforderlich. Eine freie `backgroundColor`-Prop bleibt
höchstens Kompatibilitäts-/Integrationsgrenze, keine Erlaubnis für ungeprüfte Farbpaare.

## Beispiel der vorgesehenen Verwendung

```tsx
import { Button } from '@/constants/ui';

<Button title="Speichern" loading={isSaving} onPress={save} />
```

Ein eigener 37-Punkte-Pressable mit lokaler Farbe und Textdarstellung umgeht
Mindestgröße, Theme, Zustände und die gemeinsame Basis.

## Nachweis

Gezielte Tests prüfen Blockierung, einmalige Callbacks, Accessibility-States,
Haptikgrenze und zentrale Farb-/Größenrezepte. Native Interaktion belegt reale
Touchflächen, Druckweg, Abbruch und Reduced Motion. Große Schrift und lange Labels
werden in beiden Themes geprüft. Kleine Iconflächen bleiben bis zur jeweiligen
Migration Migrationsbestand; der allgemeine Produkt-Button ist keine zweite
Implementierung mehr.
